// app.js
// Orquestador principal de KanbanFlow. Conecta storage, modelo y DOM.

import { Storage, uid } from './storage.js';
import {
  createBoard, deleteBoard, getActiveBoard, setActiveBoard, getBoardStats, renameBoard
} from './board.js';
import {
  createTask, updateTask, deleteTask, moveTask, getTasksForBoard, getTasksForColumn
} from './task.js';
import { History } from './history.js';
import { makeDraggable, makeDropZone } from './dragdrop.js';
import {
  openModal, closeModal, closeActiveModal, getActiveModal,
  setupModalDismiss, renderLabelOptions, readTaskForm, fillTaskForm, confirmDialog
} from './modal.js';
import { createEmptyFilterState, applyFilters, hasActiveFilters } from './filters.js';
import { buildMonthGrid, toDateKey, groupTasksByDueDate, MONTH_NAMES, WEEKDAY_NAMES } from './calendar.js';
import {
  renderBarChart, renderDonutChart, computeTasksPerMonth,
  computeAvgCompletionTime, computeProductivity
} from './charts.js';
import {
  debounce, dueLabel, escapeHtml, getInitials, formatDateTime, daysUntil
} from './utils.js';

// ============================================
// ESTADO GLOBAL EN MEMORIA
// ============================================
let data = Storage.load();
let currentView = 'board'; // 'board' | 'calendar' | 'stats' | 'history'
let filters = createEmptyFilterState();
let calendarCursor = new Date();
let editingTaskId = null;

// ============================================
// PERSISTENCIA
// ============================================
function persist() {
  Storage.save(data);
}

// ============================================
// TOASTS
// ============================================
function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${type !== 'default' ? ` toast-${type}` : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-leaving');
    setTimeout(() => toast.remove(), 200);
  }, 2600);
}

// ============================================
// SIDEBAR: TABLEROS
// ============================================
function renderBoardList() {
  const list = document.getElementById('board-list');
  list.innerHTML = data.boards.map(board => {
    const stats = getBoardStats(data, board.id);
    const active = board.id === data.activeBoardId;
    return `
      <button class="board-link ${active ? 'active' : ''}" data-board-id="${board.id}">
        <span class="board-link-dot" style="background:${board.color}"></span>
        <span class="board-link-name">${escapeHtml(board.name)}</span>
        <span class="board-link-count">${stats.total}</span>
        <span class="board-link-delete" data-delete-board="${board.id}" title="Eliminar tablero">
          <svg viewBox="0 0 16 16" width="13" height="13"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.5 9.5h6l.5-9.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </button>
    `;
  }).join('');

  list.querySelectorAll('.board-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-board]')) return;
      setActiveBoard(data, btn.dataset.boardId);
      persist();
      switchView('board');
      renderAll();
    });
  });

  list.querySelectorAll('[data-delete-board]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const boardId = btn.dataset.deleteBoard;
      const board = data.boards.find(b => b.id === boardId);
      if (data.boards.length === 1) {
        showToast('Debe quedar al menos un tablero', 'danger');
        return;
      }
      const ok = await confirmDialog({
        title: 'Eliminar tablero',
        message: `Se eliminará "${board.name}" y todas sus tareas. Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar tablero'
      });
      if (ok) {
        deleteBoard(data, boardId);
        persist();
        renderAll();
        showToast('Tablero eliminado');
      }
    });
  });
}

// ============================================
// DASHBOARD (STATS DEL TABLERO ACTIVO)
// ============================================
function renderDashboard() {
  const board = getActiveBoard(data);
  const container = document.getElementById('dashboard');
  if (!board) { container.innerHTML = ''; return; }
  const stats = getBoardStats(data, board.id);

  const cards = [
    { key: 'total', label: 'Total de tareas', value: stats.total },
    { key: 'pendiente', label: 'Pendientes', value: stats.pendiente },
    { key: 'progreso', label: 'En progreso', value: stats.progreso },
    { key: 'completado', label: 'Terminadas', value: stats.completado },
    { key: 'prioridad-alta', label: 'Prioridad alta', value: stats.prioridadAlta }
  ];

  container.innerHTML = cards.map(c => `
    <div class="dash-card ${c.key}">
      <div class="dash-card-bar"></div>
      <span class="dash-card-value">${c.value}</span>
      <span class="dash-card-label">${c.label}</span>
    </div>
  `).join('');

  const progressChip = document.getElementById('board-progress-chip');
  const pct = stats.total ? Math.round((stats.completado / stats.total) * 100) : 0;
  progressChip.textContent = stats.total ? `${pct}% completado` : 'Sin tareas';

  document.getElementById('board-title').textContent = board.name;
}

// ============================================
// FILTROS
// ============================================
function renderLabelFilterOptions() {
  const select = document.getElementById('filter-label');
  const current = select.value;
  select.innerHTML = '<option value="all">Toda etiqueta</option>' +
    data.labels.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
  select.value = current || 'all';
}

function syncFilterControls() {
  document.getElementById('filter-priority').value = filters.priority;
  document.getElementById('filter-label').value = filters.labelId;
  document.getElementById('filter-date').value = filters.dateRange;
  document.getElementById('search-input').value = filters.search;
  document.getElementById('filter-clear-btn').hidden = !hasActiveFilters(filters);
}

// ============================================
// TABLERO (COLUMNAS + TARJETAS)
// ============================================
function renderBoardView() {
  const board = getActiveBoard(data);
  const wrapper = document.getElementById('columns-wrapper');
  if (!board) { wrapper.innerHTML = ''; return; }

  const allTasks = getTasksForBoard(data, board.id);
  const filtered = new Set(applyFilters(allTasks, filters).map(t => t.id));
  const isFiltering = hasActiveFilters(filters);

  wrapper.innerHTML = board.columns.map(col => {
    const tasks = getTasksForColumn(data, col).filter(t => !isFiltering || filtered.has(t.id));
    return `
      <div class="column" data-column-id="${col.id}">
        <div class="column-header">
          <div class="column-header-left">
            <span class="column-dot ${col.id}"></span>
            <span class="column-name">${escapeHtml(col.name)}</span>
            <span class="column-count">${tasks.length}</span>
          </div>
          <button class="column-add-btn" data-add-to="${col.id}" title="Agregar tarea">
            <svg viewBox="0 0 16 16" width="13" height="13"><path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="task-list" data-column-id="${col.id}">
          ${tasks.length ? tasks.map(t => taskCardHTML(t)).join('') : columnEmptyHTML(isFiltering)}
        </div>
      </div>
    `;
  }).join('');

  // Wire up cards
  wrapper.querySelectorAll('.task-card').forEach(cardEl => {
    const taskId = cardEl.dataset.taskId;
    const columnId = cardEl.closest('.task-list').dataset.columnId;
    makeDraggable(cardEl, taskId, columnId);
    cardEl.addEventListener('click', () => openTaskModal({ taskId }));
  });

  // Wire up drop zones
  wrapper.querySelectorAll('.task-list').forEach(listEl => {
    makeDropZone(listEl, listEl.dataset.columnId, handleTaskDrop);
  });

  // Wire up "add to column" buttons
  wrapper.querySelectorAll('[data-add-to]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal({ columnId: btn.dataset.addTo }));
  });
}

function columnEmptyHTML(isFiltering) {
  return `
    <div class="column-empty">
      ${isFiltering ? 'Sin coincidencias con los filtros' : 'Sin tareas todavía'}
    </div>
  `;
}

function taskCardHTML(task) {
  const labels = task.labelIds.map(id => data.labels.find(l => l.id === id)).filter(Boolean);
  const due = dueLabel(task.dueDate);

  return `
    <div class="task-card priority-${task.priority}" data-task-id="${task.id}">
      <div class="task-card-top">
        <span class="task-card-title">${escapeHtml(task.title)}</span>
        ${task.color ? `<span class="task-card-color-dot" style="background:${task.color}"></span>` : ''}
      </div>
      ${task.description ? `<p class="task-card-desc">${escapeHtml(task.description)}</p>` : ''}
      ${labels.length ? `
        <div class="task-card-labels">
          ${labels.map(l => `<span class="task-card-label" style="background:${l.color}22;color:${l.color}">${escapeHtml(l.name)}</span>`).join('')}
        </div>` : ''}
      <div class="task-card-footer">
        ${due ? `<span class="task-card-due ${due.level}">${due.level === 'today' ? '⚠️ ' : ''}${due.text}</span>` : '<span></span>'}
        ${task.assignee ? `<span class="task-card-assignee" title="${escapeHtml(task.assignee)}">${getInitials(task.assignee)}</span>` : ''}
      </div>
    </div>
  `;
}

function handleTaskDrop({ taskId, fromColumnId, toColumnId, toIndex }) {
  if (fromColumnId === toColumnId) {
    // Reordenar dentro de la misma columna
    const board = getActiveBoard(data);
    const col = board.columns.find(c => c.id === toColumnId);
    const idx = col.taskIds.indexOf(taskId);
    if (idx !== -1) col.taskIds.splice(idx, 1);
    col.taskIds.splice(toIndex, 0, taskId);
    persist();
    renderBoardView();
    return;
  }
  moveTask(data, taskId, { fromColumnId, toColumnId, toIndex });
  persist();
  renderBoardView();
  renderDashboard();
  checkDueNotifications();
  if (currentView === 'history') renderHistoryView();
}

// ============================================
// MODAL DE TAREA
// ============================================
function openTaskModal({ taskId, columnId }) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  form.reset();
  renderLabelOptions(document.getElementById('label-chip-grid'), data.labels, []);

  const deleteBtn = document.getElementById('task-delete-btn');

  if (taskId) {
    editingTaskId = taskId;
    const task = data.tasks[taskId];
    document.getElementById('task-modal-title').textContent = 'Editar tarea';
    document.getElementById('task-id-field').value = taskId;
    fillTaskForm(form, task);
    renderLabelOptions(document.getElementById('label-chip-grid'), data.labels, task.labelIds);
    deleteBtn.hidden = false;
  } else {
    editingTaskId = null;
    document.getElementById('task-modal-title').textContent = 'Nueva tarea';
    document.getElementById('task-id-field').value = '';
    document.getElementById('task-column-field').value = columnId || getActiveBoard(data).columns[0].id;
    deleteBtn.hidden = true;
  }

  openModal(modal);
}

function setupTaskModal() {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  setupModalDismiss(modal);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const values = readTaskForm(form);
    if (!values.title.trim()) return;

    if (editingTaskId) {
      updateTask(data, editingTaskId, values);
      showToast('Tarea actualizada');
    } else {
      const board = getActiveBoard(data);
      const columnId = document.getElementById('task-column-field').value;
      createTask(data, { boardId: board.id, columnId, ...values });
      showToast('Tarea creada', 'success');
    }
    persist();
    closeModal(modal);
    renderBoardView();
    renderDashboard();
    checkDueNotifications();
    if (currentView === 'calendar') renderCalendarView();
    if (currentView === 'history') renderHistoryView();
  });

  document.getElementById('task-delete-btn').addEventListener('click', async () => {
    if (!editingTaskId) return;
    const task = data.tasks[editingTaskId];
    const ok = await confirmDialog({
      title: 'Eliminar tarea',
      message: `¿Eliminar "${task.title}"? Esta acción no se puede deshacer.`
    });
    if (ok) {
      deleteTask(data, editingTaskId);
      persist();
      closeModal(modal);
      renderBoardView();
      renderDashboard();
      checkDueNotifications();
      showToast('Tarea eliminada', 'danger');
      if (currentView === 'history') renderHistoryView();
    }
  });
}

// ============================================
// MODAL DE NUEVO TABLERO
// ============================================
function setupBoardModal() {
  const modal = document.getElementById('board-modal');
  const form = document.getElementById('board-form');
  setupModalDismiss(modal);

  document.getElementById('new-board-btn').addEventListener('click', () => {
    form.reset();
    openModal(modal);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('[name="boardName"]').value.trim();
    if (!name) return;
    createBoard(data, name);
    persist();
    closeModal(modal);
    renderAll();
    showToast('Tablero creado', 'success');
  });
}

// ============================================
// VISTA CALENDARIO
// ============================================
function renderCalendarView() {
  const board = getActiveBoard(data);
  const tasks = board ? getTasksForBoard(data, board.id) : [];
  const byDate = groupTasksByDueDate(tasks);

  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  document.getElementById('calendar-month-label').textContent = `${MONTH_NAMES[month]} ${year}`;

  document.getElementById('calendar-weekdays').innerHTML =
    WEEKDAY_NAMES.map(d => `<span>${d}</span>`).join('');

  const cells = buildMonthGrid(year, month);
  const todayKey = toDateKey(new Date());

  document.getElementById('calendar-grid').innerHTML = cells.map(cell => {
    const key = toDateKey(cell.date);
    const dayTasks = byDate[key] || [];
    const isToday = key === todayKey;
    const visible = dayTasks.slice(0, 3);
    const extra = dayTasks.length - visible.length;

    return `
      <div class="calendar-cell ${cell.inCurrentMonth ? '' : 'outside'} ${isToday ? 'is-today' : ''}">
        <span class="calendar-cell-date">${cell.date.getDate()}</span>
        ${visible.map(t => `
          <span class="calendar-task-chip priority-${t.priority}" data-task-id="${t.id}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
        `).join('')}
        ${extra > 0 ? `<span class="calendar-more">+${extra} más</span>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('calendar-grid').querySelectorAll('.calendar-task-chip').forEach(chip => {
    chip.addEventListener('click', () => openTaskModal({ taskId: chip.dataset.taskId }));
  });
}

function setupCalendarControls() {
  document.getElementById('cal-prev-btn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() - 1);
    renderCalendarView();
  });
  document.getElementById('cal-next-btn').addEventListener('click', () => {
    calendarCursor.setMonth(calendarCursor.getMonth() + 1);
    renderCalendarView();
  });
  document.getElementById('cal-today-btn').addEventListener('click', () => {
    calendarCursor = new Date();
    renderCalendarView();
  });
}

// ============================================
// VISTA ESTADÍSTICAS
// ============================================
function renderStatsView() {
  const board = getActiveBoard(data);
  const tasks = board ? getTasksForBoard(data, board.id) : [];
  const completedCol = board?.columns.find(c => c.id === 'col-completado');
  const completedIds = new Set(completedCol?.taskIds || []);

  const { labels, data: monthData } = computeTasksPerMonth(tasks);
  renderBarChart(document.getElementById('chart-tasks-per-month'), {
    data: monthData.length ? monthData : [0],
    labels: labels.length ? labels : ['—']
  });

  const statusSegments = [
    { label: 'Pendiente', value: countInColumn(board, 'col-pendiente'), color: 'var(--text-tertiary)' },
    { label: 'En progreso', value: countInColumn(board, 'col-progreso'), color: 'var(--color-info)' },
    { label: 'En revisión', value: countInColumn(board, 'col-revision'), color: 'var(--color-warning)' },
    { label: 'Completado', value: countInColumn(board, 'col-completado'), color: 'var(--color-success)' }
  ];
  renderDonutChart(document.getElementById('chart-status-donut'), { segments: statusSegments });
  document.getElementById('chart-status-legend').innerHTML = statusSegments.map(s => `
    <li><span class="chart-legend-dot" style="background:${s.color}"></span>${s.label}: ${s.value}</li>
  `).join('');

  document.getElementById('stat-productivity').textContent = `${computeProductivity(tasks, completedIds)}%`;

  const avgDays = computeAvgCompletionTime(tasks, completedIds);
  document.getElementById('stat-avg-time').textContent = avgDays === null ? '—' : avgDays.toFixed(1);
}

function countInColumn(board, columnId) {
  const col = board?.columns.find(c => c.id === columnId);
  return col ? col.taskIds.length : 0;
}

// ============================================
// VISTA HISTORIAL
// ============================================
function renderHistoryView() {
  const list = document.getElementById('history-list');
  const entries = History.getAll(data);

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-title">Sin actividad todavía</span>
        <span class="empty-state-sub">Las acciones sobre tus tareas aparecerán aquí.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = entries.map(entry => `
    <div class="history-item action-${entry.action}">
      <span class="history-action-dot"></span>
      <span class="history-text">
        <b>${entry.action}</b> "${escapeHtml(entry.taskTitle)}"
        ${entry.detail ? `<span class="history-detail">· ${escapeHtml(entry.detail)}</span>` : ''}
      </span>
      <span class="history-time">${formatDateTime(entry.timestamp)}</span>
    </div>
  `).join('');
}

// ============================================
// CAMBIO DE VISTA
// ============================================
function switchView(view) {
  currentView = view;
  const views = {
    board: document.getElementById('board-view'),
    calendar: document.getElementById('calendar-view'),
    stats: document.getElementById('stats-view'),
    history: document.getElementById('history-view')
  };
  const filtersBar = document.getElementById('filters-bar');

  Object.entries(views).forEach(([key, el]) => { el.hidden = key !== view; });
  filtersBar.hidden = view !== 'board';

  document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });

  if (view === 'calendar') renderCalendarView();
  if (view === 'stats') renderStatsView();
  if (view === 'history') renderHistoryView();
}

// ============================================
// EXPORT / IMPORT
// ============================================
function exportBoard() {
  const board = getActiveBoard(data);
  if (!board) return;
  const tasks = getTasksForBoard(data, board.id);
  const taskMap = {};
  tasks.forEach(t => { taskMap[t.id] = t; });

  const payload = {
    kanbanflowExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    board,
    tasks: taskMap,
    labels: data.labels
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanbanflow-${board.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Tablero exportado');
}

function importBoard(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload.board || !payload.tasks) throw new Error('Formato inválido');

      // Generar nuevos IDs para evitar colisiones
      const idMap = {};
      const newBoardId = uid('board');
      idMap[payload.board.id] = newBoardId;

      const newColumns = payload.board.columns.map(col => ({
        ...col,
        taskIds: col.taskIds.map(oldId => {
          if (!idMap[oldId]) idMap[oldId] = uid('task');
          return idMap[oldId];
        })
      }));

      const newBoard = {
        ...payload.board,
        id: newBoardId,
        name: `${payload.board.name} (importado)`,
        columns: newColumns,
        createdAt: new Date().toISOString()
      };

      Object.entries(payload.tasks).forEach(([oldId, task]) => {
        const newId = idMap[oldId] || uid('task');
        data.tasks[newId] = { ...task, id: newId, boardId: newBoardId };
      });

      // Importar etiquetas nuevas que no existan ya (por id)
      (payload.labels || []).forEach(label => {
        if (!data.labels.some(l => l.id === label.id)) {
          data.labels.push(label);
        }
      });

      data.boards.push(newBoard);
      data.activeBoardId = newBoardId;
      History.log(data, { action: History.ACTIONS.CREATE, taskTitle: newBoard.name, detail: 'Tablero importado' });
      persist();
      renderAll();
      showToast('Tablero importado correctamente', 'success');
    } catch (err) {
      console.error(err);
      showToast('No se pudo importar: archivo inválido', 'danger');
    }
  };
  reader.readAsText(file);
}

function setupExportImport() {
  document.getElementById('export-btn').addEventListener('click', exportBoard);

  const importInput = document.getElementById('import-input');
  document.getElementById('import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    const file = importInput.files[0];
    if (file) importBoard(file);
    importInput.value = '';
  });
}

// ============================================
// TEMA OSCURO
// ============================================
function setupTheme() {
  const theme = Storage.getTheme();
  document.documentElement.setAttribute('data-theme', theme);

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.setTheme(next);
  });
}

// ============================================
// SIDEBAR COLAPSABLE / MÓVIL
// ============================================
function setupSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  const overlay = document.getElementById('sidebar-overlay');
  const openMobile = () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('visible');
  };
  const closeMobile = () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('visible');
  };
  document.getElementById('mobile-sidebar-btn').addEventListener('click', openMobile);
  overlay.addEventListener('click', closeMobile);
  sidebar.querySelectorAll('.board-link, .sidebar-link').forEach(el => {
    el.addEventListener('click', closeMobile);
  });
}

// ============================================
// NOTIFICACIONES DE VENCIMIENTO
// ============================================
function checkDueNotifications() {
  const board = getActiveBoard(data);
  if (!board) return;
  const completedCol = board.columns.find(c => c.id === 'col-completado');
  const completedIds = new Set(completedCol?.taskIds || []);

  const dueToday = getTasksForBoard(data, board.id).filter(t =>
    t.dueDate && daysUntil(t.dueDate) === 0 && !completedIds.has(t.id)
  );

  const banner = document.getElementById('due-banner');
  if (dueToday.length === 0) {
    banner.hidden = true;
    return;
  }

  const text = dueToday.length === 1
    ? `⚠️ La tarea "${dueToday[0].title}" vence hoy.`
    : `⚠️ Tienes ${dueToday.length} tareas que vencen hoy.`;
  document.getElementById('due-banner-text').textContent = text;
  banner.hidden = false;
}

function setupDueBanner() {
  document.getElementById('due-banner-close').addEventListener('click', () => {
    document.getElementById('due-banner').hidden = true;
  });
}

// ============================================
// ATAJOS DE TECLADO
// ============================================
function setupKeyboardShortcuts() {
  document.getElementById('shortcuts-btn').addEventListener('click', () => {
    openModal(document.getElementById('shortcuts-modal'));
  });

  document.addEventListener('keydown', (e) => {
    const activeModal = getActiveModal();
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if (e.key === 'Escape') {
      if (activeModal) {
        e.preventDefault();
        closeActiveModal();
      }
      return;
    }

    if (activeModal || isTyping) return;

    if (e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openTaskModal({});
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('search-input').focus();
    }
  });
}

// ============================================
// FILTROS: EVENTOS
// ============================================
function setupFilters() {
  document.getElementById('filter-priority').addEventListener('change', (e) => {
    filters.priority = e.target.value;
    renderBoardView();
    syncFilterControls();
  });
  document.getElementById('filter-label').addEventListener('change', (e) => {
    filters.labelId = e.target.value;
    renderBoardView();
    syncFilterControls();
  });
  document.getElementById('filter-date').addEventListener('change', (e) => {
    filters.dateRange = e.target.value;
    renderBoardView();
    syncFilterControls();
  });

  const debouncedSearch = debounce((value) => {
    filters.search = value;
    renderBoardView();
    syncFilterControls();
  }, 200);
  document.getElementById('search-input').addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  document.getElementById('filter-clear-btn').addEventListener('click', () => {
    filters = createEmptyFilterState();
    syncFilterControls();
    renderBoardView();
  });
}

// ============================================
// NAV LATERAL: VISTAS
// ============================================
function setupViewNav() {
  document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
    link.addEventListener('click', () => switchView(link.dataset.view));
  });
}

// ============================================
// NUEVA TAREA (BOTÓN PRINCIPAL)
// ============================================
function setupNewTaskButton() {
  document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal({}));
}

// ============================================
// RENDER GENERAL
// ============================================
function renderAll() {
  renderBoardList();
  renderDashboard();
  renderLabelFilterOptions();
  syncFilterControls();
  renderBoardView();
  checkDueNotifications();
  if (currentView !== 'board') switchView(currentView);
}

// ============================================
// INIT
// ============================================
function init() {
  setupTheme();
  setupSidebarToggle();
  setupTaskModal();
  setupBoardModal();
  setupCalendarControls();
  setupExportImport();
  setupDueBanner();
  setupKeyboardShortcuts();
  setupFilters();
  setupViewNav();
  setupNewTaskButton();

  // Setup modal dismiss for shortcuts-modal (task-modal and board-modal are already handled in their setup functions)
  setupModalDismiss(document.getElementById('shortcuts-modal'));

  renderAll();

  // Revisión periódica de vencimientos (cada 5 min)
  setInterval(checkDueNotifications, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
