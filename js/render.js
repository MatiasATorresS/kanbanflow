// ============================================================
// render.js — Dibujado y actualización visual de la pantalla
// Usamos requestAnimationFrame para agrupar cambios y no saturar la CPU
// ============================================================

import { state, ui } from './store.js';
import {
  getActiveBoard,
  getTasksForBoard,
  getTasksForColumn,
  boardStats,
  applyFilters,
  hasActiveFilters,
  activeFilterCount,
  doneTaskIds,
  historyForBoard,
} from './model.js';
import {
  progressRing,
  barChart,
  donutChart,
  computeMonthSeries,
  computeMetrics,
  share,
} from './charts.js';
import {
  escapeHtml,
  highlight,
  dueInfo,
  initials,
  formatMonthYear,
  formatDateTime,
  formatTime,
  dayKey,
  todayKey,
  formatLongDate,
  relativeDayLabel,
  plural,
} from './utils.js';
import { icon } from './icons.js';

const el = {
  boardList: document.getElementById('board-list'),
  viewNav: document.getElementById('view-nav'),
  boardTitle: document.getElementById('board-title'),
  viewKicker: document.getElementById('view-kicker'),
  progressChip: document.getElementById('progress-chip'),
  titleEdit: document.querySelector('.title-edit'),
  dashboard: document.getElementById('dashboard'),
  filters: document.getElementById('filters'),
  filterPriority: document.getElementById('filter-priority'),
  filterLabel: document.getElementById('filter-label'),
  filterDue: document.getElementById('filter-due'),
  filterClear: document.querySelector('[data-action="clear-filters"]'),
  filtersCount: document.getElementById('filters-count'),
  boardView: document.getElementById('board-view'),
  calendarView: document.getElementById('calendar-view'),
  statsView: document.getElementById('stats-view'),
  historyView: document.getElementById('history-view'),
  searchInput: document.getElementById('search-input'),
  searchClear: document.querySelector('.search__clear'),
  themeLabel: document.querySelector('[data-theme-label]'),
  themeToggle: document.querySelector('[data-action="toggle-theme"]'),
};

const VIEW_LABELS = {
  board: 'Tablero',
  calendar: 'Calendario',
  stats: 'Estadísticas',
  history: 'Historial',
};

const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const PRIORITY_COLORS = { alta: 'var(--rust)', media: 'var(--ochre)', baja: 'var(--sage)' };
const ACTION_ICONS = {
  create: 'plus',
  edit: 'edit',
  move: 'arrowRight',
  delete: 'trash',
  import: 'download',
  board: 'folder',
};
const ACTION_VERBS = {
  create: 'creó',
  edit: 'editó',
  move: 'movió',
  delete: 'eliminó',
  import: 'importó',
  board: 'creó',
};

/* ------------------------------------------------------------------
   Planificador de render:
   En lugar de repintar el HTML ante cada acción, marcamos las partes
   "sucias" (que cambiaron) y dejamos que el navegador las dibuje
   en el siguiente cuadro de animación (60fps).
------------------------------------------------------------------ */
const dirty = new Set();
let frame = null;
let pendingFocus = null;

export function focusAfterRender(selector) {
  pendingFocus = selector;
}

export function requestRender(...parts) {
  parts.flat().forEach((part) => dirty.add(part));
  if (!frame) frame = requestAnimationFrame(flush);
}

function flush() {
  frame = null;
  const parts = new Set(dirty);
  dirty.clear();

  if (parts.has('all')) {
    renderChrome();
    renderDashboard();
    renderFilters();
    renderCurrentView();
  } else {
    if (parts.has('chrome')) renderChrome();
    if (parts.has('sidebar')) renderSidebar();
    if (parts.has('header')) renderHeader();
    if (parts.has('dashboard')) renderDashboard();
    if (parts.has('filters')) renderFilters();
    if (parts.has('view')) renderCurrentView();
  }

  applyPendingFocus();
}

function applyPendingFocus() {
  if (!pendingFocus) return;
  const target = document.querySelector(pendingFocus);
  pendingFocus = null;
  target?.focus();
}

/* ------------------------------------------------------------------
   Chrome: sidebar, cabecera, navegación y visibilidad de vistas
------------------------------------------------------------------ */
export function renderAll() {
  renderChrome();
  renderDashboard();
  renderFilters();
  renderCurrentView();
  applyPendingFocus();
}

function renderChrome() {
  renderSidebar();
  renderHeader();

  const isBoard = ui.view === 'board';
  el.dashboard.hidden = !isBoard;
  el.filters.hidden = !isBoard;
  el.boardView.hidden = ui.view !== 'board';
  el.calendarView.hidden = ui.view !== 'calendar';
  el.statsView.hidden = ui.view !== 'stats';
  el.historyView.hidden = ui.view !== 'history';

  document.querySelectorAll('[data-view]').forEach((button) => {
    if (button.dataset.view === ui.view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });

  const dark = document.documentElement.dataset.theme === 'dark';
  if (el.themeLabel) el.themeLabel.textContent = dark ? 'Tema claro' : 'Tema oscuro';
  el.themeToggle?.setAttribute('aria-label', dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
}

function renderSidebar() {
  const activeId = state.activeBoardId;
  el.boardList.innerHTML = state.boards.map((board, index) => {
    const stats = boardStats(board);
    const active = board.id === activeId;
    const name = escapeHtml(board.name);
    return `
      <div class="board-item${active ? ' is-active' : ''}">
        <button class="board-item__main" type="button" data-action="select-board" data-id="${board.id}"
          ${active ? 'aria-current="page"' : ''} title="${name} — ${plural(stats.total, 'tarea', 'tareas')}">
          <span class="board-item__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <span class="board-item__dot" style="--dot:${board.color}" aria-hidden="true"></span>
          <span class="board-item__name">${name}</span>
          <span class="board-item__count" aria-label="${plural(stats.total, 'tarea', 'tareas')}">${stats.total}</span>
        </button>
        <button class="board-item__del" type="button" data-action="delete-board" data-id="${board.id}"
          aria-label="Eliminar tablero ${name}" title="Eliminar tablero">${icon('trash', 13)}</button>
      </div>`;
  }).join('');
}

function renderHeader() {
  const board = getActiveBoard();
  const view = ui.view;

  if (view === 'board') {
    el.viewKicker.textContent = 'Tablero';
    el.boardTitle.textContent = board?.name || 'Sin tablero';
    el.titleEdit.hidden = !board;

    if (board) {
      const stats = boardStats(board);
      el.progressChip.hidden = false;
      el.progressChip.textContent = stats.total ? `${stats.progress}% completado` : 'Sin tareas';
      el.progressChip.title = stats.total
        ? `${stats.done} de ${stats.total} tareas completadas`
        : 'Aún no hay tareas en este tablero';
    } else {
      el.progressChip.hidden = true;
    }

    document.title = board ? `${board.name} · KanbanFlow` : 'KanbanFlow';
  } else {
    el.viewKicker.textContent = board?.name || 'KanbanFlow';
    el.boardTitle.textContent = VIEW_LABELS[view] || 'KanbanFlow';
    el.titleEdit.hidden = true;
    el.progressChip.hidden = true;
    document.title = `${VIEW_LABELS[view]} · ${board?.name || 'KanbanFlow'} — KanbanFlow`;
  }

  el.searchInput.value = ui.filters.search;
  el.searchClear.hidden = !ui.filters.search && !ui.searchOpen;
}

/* ------------------------------------------------------------------
   Dashboard y filtros
------------------------------------------------------------------ */
function renderDashboard() {
  const board = getActiveBoard();
  if (!board) {
    el.dashboard.innerHTML = '';
    return;
  }

  const stats = boardStats(board);
  const activeTotal = stats.active + stats.review;

  const metric = (label, value, pct, color) => `
    <div class="stat" style="--stat-color:${color}">
      <p class="stat__label">${label}</p>
      <p class="stat__value">${value}</p>
      <span class="stat__bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
    </div>`;

  el.dashboard.innerHTML = `
    <div class="stat stat--progress">
      <div class="stat__ring">${progressRing(stats.progress, {
        size: 62,
        stroke: 7,
        label: `${stats.progress}% de tareas completadas`,
      })}</div>
      <div class="stat__stack">
        <p class="stat__label" style="--stat-color:var(--accent)">Progreso</p>
        <p class="stat__value">${stats.progress}<span>%</span></p>
        <p class="stat__sub">${stats.done} de ${stats.total} tareas completadas</p>
      </div>
    </div>
    ${metric('Pendientes', stats.backlog, share(stats.backlog, stats.total), 'var(--ink-3)')}
    ${metric('En curso', activeTotal, share(activeTotal, stats.total), 'var(--blue)')}
    ${metric('Vencidas', stats.overdue, share(stats.overdue, stats.total), 'var(--rust)')}
    ${metric('Prioridad alta', stats.high, share(stats.high, stats.total), 'var(--ochre)')}
  `;
}

function renderFilters() {
  const board = getActiveBoard();
  const currentLabel = ui.filters.label;

  el.filterLabel.innerHTML = '<option value="all">Etiqueta</option>' +
    state.labels
      .map((label) => `<option value="${label.id}">${escapeHtml(label.name)}</option>`)
      .join('');

  el.filterPriority.value = ui.filters.priority;
  el.filterLabel.value = currentLabel;
  el.filterDue.value = ui.filters.due;

  el.filterPriority.dataset.active = String(ui.filters.priority !== 'all');
  el.filterLabel.dataset.active = String(ui.filters.label !== 'all');
  el.filterDue.dataset.active = String(ui.filters.due !== 'all');

  el.filterClear.hidden = !hasActiveFilters();
  el.filterClear.textContent = `Limpiar${activeFilterCount() ? ` (${activeFilterCount()})` : ''}`;

  if (!board) {
    el.filtersCount.textContent = '';
    return;
  }

  const tasks = getTasksForBoard(board.id);
  const filtered = applyFilters(tasks, ui.filters, state.labels);

  el.filtersCount.innerHTML = hasActiveFilters()
    ? `Mostrando <strong>${filtered.length}</strong> de ${tasks.length}`
    : `${plural(tasks.length, 'tarea', 'tareas')}`;
}

/* ------------------------------------------------------------------
   Tablero
------------------------------------------------------------------ */
function renderCurrentView() {
  if (ui.view === 'board') renderBoard();
  else if (ui.view === 'calendar') renderCalendar();
  else if (ui.view === 'stats') renderStats();
  else if (ui.view === 'history') renderHistory();
}

function renderBoard() {
  const board = getActiveBoard();
  if (!board) {
    el.boardView.innerHTML = boardEmptyState();
    return;
  }

  const tasks = getTasksForBoard(board.id);
  const filtering = hasActiveFilters();
  const filtered = filtering ? applyFilters(tasks, ui.filters, state.labels) : tasks;
  const visibleIds = new Set(filtered.map((task) => task.id));
  const labels = new Map(state.labels.map((label) => [label.id, label]));
  const query = ui.filters.search.trim();

  const emptyBoard = !tasks.length && !filtering;

  // Conserva la posición de scroll horizontal y de cada columna.
  const previousWrapper = el.boardView.querySelector('.columns');
  const scrollLeft = previousWrapper?.scrollLeft || 0;
  const listScroll = new Map();
  el.boardView.querySelectorAll('.task-list').forEach((list) => {
    listScroll.set(list.dataset.columnId, list.scrollTop);
  });

  el.boardView.innerHTML = `
    <div class="board-canvas">
      ${emptyBoard ? boardHint() : ''}
      <div class="columns" aria-label="Columnas del tablero">
        ${board.columns.map((column) => renderColumn(column, visibleIds, filtering, labels, query)).join('')}
      </div>
    </div>
  `;

  const wrapper = el.boardView.querySelector('.columns');
  if (wrapper) wrapper.scrollLeft = scrollLeft;
  el.boardView.querySelectorAll('.task-list').forEach((list) => {
    const top = listScroll.get(list.dataset.columnId);
    if (typeof top === 'number') list.scrollTop = top;
  });
}

function renderColumn(column, visibleIds, filtering, labels, query) {
  const allTasks = getTasksForColumn(column);
  const tasks = filtering ? allTasks.filter((task) => visibleIds.has(task.id)) : allTasks;
  const doneIds = new Set(
    (getActiveBoard()?.columns || [])
      .filter((item) => item.kind === 'done')
      .flatMap((item) => item.taskIds),
  );

  const cards = tasks.map((task) => taskCard(task, labels, query, doneIds)).join('');
  const empty = filtering
    ? `<div class="column__empty">${icon('search', 18)}<span>Sin coincidencias</span><small>Prueba con otros filtros</small></div>`
    : `<div class="column__empty">${icon('inbox', 18)}<span>Sin tareas</span><small>Arrastra una tarjeta o crea una nueva</small></div>`;

  const quickAdd = ui.quickAdd === column.id
    ? `<form class="quick-add" data-quick-add="${column.id}">
         <input type="text" name="title" maxlength="120" autocomplete="off"
           placeholder="Nueva tarea…" aria-label="Título de la nueva tarea en ${escapeHtml(column.name)}">
         <span class="quick-add__hint"><kbd>Enter</kbd> guardar · <kbd>Esc</kbd> cerrar</span>
       </form>`
    : `<button class="quick-add-btn" type="button" data-action="quick-add" data-column="${column.id}">
         ${icon('plus', 13)} Añadir tarea
       </button>`;

  return `
    <section class="column" data-column-id="${column.id}" style="--col-color:${column.color}"
      aria-label="${escapeHtml(column.name)}">
      <header class="column__head">
        <span class="column__dot" aria-hidden="true"></span>
        <h2 class="column__name">${escapeHtml(column.name)}</h2>
        <span class="column__count" aria-label="${plural(tasks.length, 'tarea', 'tareas')}">${tasks.length}</span>
        <button class="column__add" type="button" data-action="add-task" data-column="${column.id}"
          aria-label="Añadir tarea a ${escapeHtml(column.name)}" title="Añadir tarea">
          ${icon('plus', 15)}
        </button>
      </header>
      <div class="task-list" data-column-id="${column.id}" role="list"
        aria-label="${escapeHtml(column.name)}">
        ${cards || empty}
      </div>
      ${quickAdd}
    </section>`;
}

function taskCard(task, labels, query, doneIds) {
  const done = doneIds.has(task.id);
  const due = dueInfo(task.dueDate);
  const chips = task.labelIds
    .map((id) => labels.get(id))
    .filter(Boolean)
    .map((label) => `<span class="label-chip" style="--label-color:${label.color}">${escapeHtml(label.name)}</span>`)
    .join('');

  return `
    <article class="task-card priority-${task.priority}${done ? ' is-done' : ''}" data-task-id="${task.id}" role="listitem">
      <div class="task-card__main">
        <button class="task-check" type="button" data-action="toggle-done" data-id="${task.id}"
          aria-pressed="${done}" aria-label="${done ? 'Marcar como pendiente' : 'Marcar como completada'}: ${escapeHtml(task.title)}"
          title="${done ? 'Reabrir tarea' : 'Completar tarea'}">${icon('check', 11)}</button>
        <div class="task-card__body">
          <button class="task-card__title" type="button" data-action="open-task" data-id="${task.id}">${highlight(task.title, query)}</button>
          ${task.description ? `<p class="task-card__desc">${highlight(task.description, query)}</p>` : ''}
          ${chips ? `<div class="task-card__labels">${chips}</div>` : ''}
        </div>
        <button class="task-card__handle" type="button" data-drag-handle
          aria-label="Arrastrar tarea ${escapeHtml(task.title)}" title="Arrastrar">${icon('grip', 15)}</button>
      </div>
      <div class="task-card__foot">
        <div class="task-card__meta">
          ${due ? `<span class="due-pill due-pill--${due.level}">${icon('clock', 10)}${escapeHtml(due.text)}</span>` : ''}
          <span class="prio-pill">${PRIORITY_LABELS[task.priority]}</span>
        </div>
        ${task.assignee
          ? `<span class="avatar" title="${escapeHtml(task.assignee)}" aria-label="Responsable: ${escapeHtml(task.assignee)}">${escapeHtml(initials(task.assignee))}</span>`
          : ''}
      </div>
    </article>`;
}

function boardHint() {
  return `
    <div class="board-hint">
      <span class="board-hint__art" aria-hidden="true">${icon('layers', 22)}</span>
      <div class="board-hint__text">
        <p class="board-hint__title">Tu tablero está listo</p>
        <p class="board-hint__copy">Crea una tarea en cualquier columna o carga el ejemplo para explorar la app.</p>
      </div>
      <div class="board-hint__actions">
        <button class="btn btn--primary" type="button" data-action="new-task">${icon('plus', 14)} Crear tarea</button>
        <button class="btn btn--ghost" type="button" data-action="load-sample">${icon('sparkles', 14)} Cargar ejemplo</button>
      </div>
    </div>`;
}

function boardEmptyState() {
  return `
    <div class="board-empty">
      <div class="board-empty__card">
        <span class="board-empty__art">${icon('layers', 34)}</span>
        <h2 class="board-empty__title">Un tablero en blanco, listo para ti</h2>
        <p class="board-empty__copy">Crea tu primera tarea o carga un tablero de ejemplo para explorar todo lo que KanbanFlow puede hacer.</p>
        <div class="board-empty__actions">
          <button class="btn btn--primary" type="button" data-action="new-task">${icon('plus', 14)} Crear primera tarea</button>
          <button class="btn btn--ghost" type="button" data-action="load-sample">${icon('sparkles', 14)} Cargar ejemplo</button>
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------
   Calendario
------------------------------------------------------------------ */
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function monthCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dayKey(date),
      inMonth: date.getMonth() === month,
    };
  });
}

function renderCalendar() {
  const board = getActiveBoard();
  if (!board) {
    el.calendarView.innerHTML = emptyState('calendar', 'Sin tablero', 'Crea un tablero para ver tu agenda.');
    return;
  }

  const byDate = new Map();
  getTasksForBoard(board.id).forEach((task) => {
    if (!task.dueDate) return;
    if (!byDate.has(task.dueDate)) byDate.set(task.dueDate, []);
    byDate.get(task.dueDate).push(task);
  });

  const cursor = ui.calendarCursor instanceof Date && !Number.isNaN(ui.calendarCursor.getTime())
    ? ui.calendarCursor
    : new Date();
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthTasks = [...byDate.entries()]
    .filter(([key]) => {
      const [y, m] = key.split('-').map(Number);
      return y === year && m === month + 1;
    })
    .reduce((sum, [, tasks]) => sum + tasks.length, 0);

  const today = todayKey();
  const doneIds = doneTaskIds(board);
  const cells = monthCells(cursor);

  el.calendarView.innerHTML = `
    <div class="calendar-head">
      <div class="calendar-head__title">
        <h2 class="calendar-head__month">${MONTH_NAMES[month]} ${year}</h2>
        <span class="calendar-head__meta">${monthTasks ? plural(monthTasks, 'tarea con fecha', 'tareas con fecha') : 'Sin vencimientos'}</span>
      </div>
      <div class="calendar-nav">
        <button class="icon-btn" type="button" data-action="cal-prev" aria-label="Mes anterior">
          ${icon('chevronLeft', 16)}
        </button>
        <button class="calendar-today" type="button" data-action="cal-today">Hoy</button>
        <button class="icon-btn" type="button" data-action="cal-next" aria-label="Mes siguiente">
          ${icon('chevronRight', 16)}
        </button>
      </div>
    </div>
    <div class="calendar-weekdays" aria-hidden="true">
      ${WEEKDAYS.map((day) => `<span>${day}</span>`).join('')}
    </div>
    <div class="calendar-grid">
      ${cells.map((cell) => calendarCell(cell, byDate.get(cell.key) || [], today, doneIds)).join('')}
    </div>`;

  el.calendarView.scrollTop = 0;
}

function calendarCell(cell, tasks, today, doneIds) {
  const isToday = cell.key === today;
  const visible = tasks.slice(0, 3);
  const extra = tasks.length - visible.length;
  const dots = tasks.slice(0, 4)
    .map((task) => `<i style="--dot:${PRIORITY_COLORS[task.priority] || 'var(--ink-3)'}" aria-hidden="true"></i>`)
    .join('');

  return `
    <div class="cal-cell${cell.inMonth ? '' : ' is-outside'}${isToday ? ' is-today' : ''}">
      <button class="cal-cell__date" type="button" data-action="open-day" data-date="${cell.key}"
        ${isToday ? 'aria-current="date"' : ''}
        aria-label="${formatLongDate(cell.date)}${tasks.length ? `, ${plural(tasks.length, 'tarea', 'tareas')}` : ', sin tareas'}">
        ${cell.date.getDate()}
      </button>
      ${dots ? `<span class="cal-dots">${dots}</span>` : ''}
      <div class="cal-cell__tasks">
        ${visible.map((task) => `
          <button class="cal-chip priority-${task.priority}${doneIds.has(task.id) ? ' is-done' : ''}"
            type="button" data-action="open-task" data-id="${task.id}"
            title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</button>
        `).join('')}
        ${extra > 0
          ? `<button class="cal-more" type="button" data-action="open-day" data-date="${cell.key}">+${extra} más</button>`
          : ''}
      </div>
    </div>`;
}

/* ------------------------------------------------------------------
   Estadísticas
------------------------------------------------------------------ */
function renderStats() {
  const board = getActiveBoard();
  if (!board) {
    el.statsView.innerHTML = emptyState('chart', 'Sin datos', 'Crea un tablero y añade tareas para ver métricas.');
    return;
  }

  const tasks = getTasksForBoard(board.id);
  const stats = boardStats(board);
  const doneIds = doneTaskIds(board);
  const metrics = computeMetrics(tasks, doneIds);
  const months = computeMonthSeries(tasks, 6);

  const segments = [
    { label: 'Pendiente', value: stats.backlog, color: 'var(--ink-3)' },
    { label: 'En progreso', value: stats.active, color: 'var(--blue)' },
    { label: 'En revisión', value: stats.review, color: 'var(--ochre)' },
    { label: 'Completado', value: stats.done, color: 'var(--sage)' },
  ];

  const avg = metrics.avgDays === null ? '—' : metrics.avgDays.toFixed(1);

  el.statsView.innerHTML = `
    <div class="stats-grid">
      <section class="stat-card stat-card--bars">
        <div class="stat-card__head">
          <h2 class="stat-card__title">Ritmo de creación</h2>
          <span class="stat-card__hint">últimos 6 meses</span>
        </div>
        <div class="chart">
          ${months.total
            ? barChart({ labels: months.labels, values: months.values, caption: 'Tareas creadas por mes en los últimos 6 meses' })
            : `<p class="empty-state__copy">Aún no hay tareas creadas. Cuando añadas algunas, aquí verás tu ritmo.</p>`}
        </div>
      </section>

      <section class="stat-card stat-card--donut">
        <div class="stat-card__head">
          <h2 class="stat-card__title">Distribución</h2>
          <span class="stat-card__hint">${stats.total} tareas</span>
        </div>
        <div class="donut-wrap">
          ${donutChart({ segments, caption: 'Distribución de tareas por estado' })}
          <ul class="legend">
            ${segments.map((segment) => `
              <li><span class="legend__dot" style="--legend-color:${segment.color}"></span>${segment.label}
                <span class="legend__value" style="--legend-color:${segment.color}">${segment.value}</span></li>
            `).join('')}
          </ul>
        </div>
      </section>

      <section class="stat-card stat-card--kpi">
        <div class="stat-card__head">
          <h2 class="stat-card__title">Productividad</h2>
          <span class="stat-card__hint">${metrics.doneCount}/${stats.total}</span>
        </div>
        <div class="kpi">
          <div class="kpi__ring">${progressRing(metrics.productivity, {
            size: 82,
            stroke: 8,
            label: `${metrics.productivity}% de productividad`,
          })}</div>
          <div>
            <p class="kpi__number">${metrics.productivity}<span>%</span></p>
            <p class="kpi__sub">de tareas completadas</p>
          </div>
        </div>
      </section>

      <section class="stat-card stat-card--kpi">
        <div class="stat-card__head">
          <h2 class="stat-card__title">Tiempo de cierre</h2>
          <span class="stat-card__hint">promedio</span>
        </div>
        <div class="kpi">
          <div>
            <p class="kpi__number">${avg}<span>${avg === '—' ? '' : ' d'}</span></p>
            <p class="kpi__sub">${metrics.avgDays === null ? 'Sin tareas completadas todavía' : 'días desde la creación hasta el cierre'}</p>
          </div>
          <span class="kpi__icon" style="--kpi-color:var(--blue);--kpi-soft:var(--blue-soft)">${icon('clock', 19)}</span>
        </div>
      </section>

      <section class="stat-card stat-card--kpi">
        <div class="stat-card__head">
          <h2 class="stat-card__title">Impulso</h2>
          <span class="stat-card__hint">7 días</span>
        </div>
        <div class="kpi">
          <div>
            <p class="kpi__number">${metrics.completedLast7}</p>
            <p class="kpi__sub">tareas cerradas en los últimos 7 días</p>
          </div>
          <span class="kpi__icon" style="--kpi-color:var(--sage);--kpi-soft:var(--sage-soft)">${icon('bolt', 19)}</span>
        </div>
      </section>
    </div>`;

  el.statsView.scrollTop = 0;
}

/* ------------------------------------------------------------------
   Historial
------------------------------------------------------------------ */
function renderHistory() {
  const board = getActiveBoard();
  const entries = historyForBoard(board?.id);

  const toolbar = `
    <div class="history-toolbar">
      <div>
        <h2 class="history-toolbar__title">Actividad reciente</h2>
        <p class="history-toolbar__meta">${entries.length ? plural(entries.length, 'evento', 'eventos') : 'Sin registros'}${board ? ` · ${escapeHtml(board.name)}` : ''}</p>
      </div>
      ${entries.length
        ? `<button class="btn btn--ghost btn--danger-text" type="button" data-action="clear-history">Limpiar historial</button>`
        : ''}
    </div>`;

  if (!entries.length) {
    el.historyView.innerHTML = toolbar + emptyState(
      'history',
      'Sin actividad todavía',
      'Cada tarea que crees, muevas o completes aparecerá aquí.',
    );
    return;
  }

  const groups = new Map();
  entries.forEach((entry) => {
    const key = dayKey(new Date(entry.at));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  el.historyView.innerHTML = toolbar + `
    <div class="history-list">
      ${[...groups.entries()].map(([key, items]) => `
        <section class="history-group" aria-label="${relativeDayLabel(key)}">
          <h3 class="history-group__label">${relativeDayLabel(key)}</h3>
          ${items.map((entry) => `
            <div class="history-item action-${entry.action}">
              <span class="history-item__icon" aria-hidden="true">${icon(ACTION_ICONS[entry.action] || 'sparkles', 14)}</span>
              <span class="history-item__text">
                <b>${ACTION_VERBS[entry.action] || 'actualizó'}</b> «${escapeHtml(entry.title)}»
                ${entry.detail ? `<span class="history-item__detail">· ${escapeHtml(entry.detail)}</span>` : ''}
              </span>
              <time class="history-item__time" datetime="${entry.at}" title="${formatDateTime(entry.at)}">${formatTime(entry.at)}</time>
            </div>
          `).join('')}
        </section>
      `).join('')}
    </div>`;

  el.historyView.scrollTop = 0;
}

/* ------------------------------------------------------------------
   Auxiliares
------------------------------------------------------------------ */
function emptyState(iconName, title, copy) {
  return `
    <div class="empty-state">
      <span class="empty-state__icon">${icon(iconName, 24)}</span>
      <h2 class="empty-state__title">${escapeHtml(title)}</h2>
      <p class="empty-state__copy">${escapeHtml(copy)}</p>
    </div>`;
}

export { VIEW_LABELS };
