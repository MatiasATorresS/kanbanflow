// ============================================================
// main.js — orquestación de la interfaz y los flujos de usuario
// ============================================================

import {
  state,
  prefs,
  ui,
  PALETTE,
  save,
  savePrefs,
  replaceState,
  snapshotState,
  reloadFromStorage,
  createFilters,
  parseExternalData,
  importBoardPayload,
} from './store.js';
import {
  ACTIONS,
  log,
  getBoard,
  getActiveBoard,
  getTask,
  getTasksForBoard,
  findColumnOfTask,
  setActiveBoard,
  createBoard,
  updateBoard,
  deleteBoard,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  toggleTaskDone,
  clearHistory,
  applyFilters,
} from './model.js';
import { renderAll, requestRender, focusAfterRender, VIEW_LABELS } from './render.js';
import { initDragDrop } from './dragdrop.js';
import { setupDialogs, openDialog, closeDialog, confirmDialog } from './dialogs.js';
import { showToast } from './toast.js';
import { loadSampleBoard } from './seed.js';
import {
  debounce,
  isEditableElement,
  formatLongDate,
  formatDateTime,
  escapeHtml,
  plural,
  todayKey,
} from './utils.js';

/* ------------------------------------------------------------------
   Referencias del documento
------------------------------------------------------------------ */
const app = document.getElementById('app');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');
const topbar = document.querySelector('.topbar');
const topbarMenu = document.querySelector('.topbar__menu');
const searchInput = document.getElementById('search-input');
const searchToggle = document.querySelector('.topbar__search-toggle');
const searchClear = document.querySelector('.search__clear');
const filters = document.getElementById('filters');
const boardView = document.getElementById('board-view');

const taskDialog = document.getElementById('task-dialog');
const taskForm = document.getElementById('task-form');
const taskDialogKicker = document.getElementById('task-dialog-kicker');
const taskDialogTitle = document.getElementById('task-dialog-title');
const taskColumnSelect = document.getElementById('task-column-select');
const labelPicker = document.getElementById('label-picker');
const taskMeta = document.getElementById('task-meta');
const taskDelete = document.querySelector('[data-task-delete]');

const boardDialog = document.getElementById('board-dialog');
const boardForm = document.getElementById('board-form');
const boardDialogKicker = document.getElementById('board-dialog-kicker');
const boardDialogTitle = document.getElementById('board-dialog-title');
const boardSwatches = document.getElementById('board-swatches');
const boardDelete = document.querySelector('[data-board-delete]');

const dayDialog = document.getElementById('day-dialog');
const dayDialogKicker = document.getElementById('day-dialog-kicker');
const dayDialogTitle = document.getElementById('day-dialog-title');
const dayDialogBody = document.getElementById('day-dialog-body');
const dayAddTask = document.getElementById('day-add-task');

const shortcutsDialog = document.getElementById('shortcuts-dialog');
const importInput = document.getElementById('import-input');

/* ------------------------------------------------------------------
   Utilidades de interfaz
------------------------------------------------------------------ */
const mobileQuery = window.matchMedia('(max-width: 980px)');
const isMobile = () => mobileQuery.matches;

let liveRegion = null;
let announceTimer = null;

function setupLiveRegion() {
  liveRegion = document.createElement('div');
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  document.body.appendChild(liveRegion);
}

function announce(message) {
  if (!liveRegion) return;
  liveRegion.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    liveRegion.textContent = message;
  }, 40);
}

function undoToast(message, snapshot, { type = 'success', duration = 5200 } = {}) {
  // Solo el último cambio ofrece deshacer, para no restaurar instantáneas obsoletas.
  document.querySelectorAll('#toasts .toast').forEach((toast) => {
    if (toast.querySelector('.toast__action')) toast.remove();
  });

  showToast(message, {
    type,
    duration,
    action: {
      label: 'Deshacer',
      onClick: () => {
        replaceState(snapshot);
        renderAll();
        announce('Cambio deshecho');
      },
    },
  });
}

function pluralTasks(count) {
  return plural(count, 'tarea', 'tareas');
}

/* ------------------------------------------------------------------
   Cajón lateral y búsqueda móvil
------------------------------------------------------------------ */
function openSidebar() {
  sidebar.classList.add('is-open');
  scrim.hidden = false;
  topbarMenu?.setAttribute('aria-expanded', 'true');
}

function closeSidebar() {
  if (!sidebar.classList.contains('is-open')) return;
  sidebar.classList.remove('is-open');
  scrim.hidden = true;
  topbarMenu?.setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
  if (isMobile()) {
    if (sidebar.classList.contains('is-open')) closeSidebar();
    else openSidebar();
    return;
  }

  prefs.sidebarCollapsed = !prefs.sidebarCollapsed;
  app.classList.toggle('is-collapsed', prefs.sidebarCollapsed);
  savePrefs();
}

function setSearchOpen(open, { focus = false } = {}) {
  ui.searchOpen = open;
  topbar.classList.toggle('is-searching', open);
  searchToggle?.setAttribute('aria-expanded', String(open));

  if (open) {
    // En móvil el aspa también sirve para cerrar el buscador cuando está vacío.
    searchClear.hidden = false;
    if (focus) {
      requestAnimationFrame(() => {
        searchInput.focus();
        searchInput.select();
      });
    }
    return;
  }

  ui.filters.search = '';
  searchInput.value = '';
  searchClear.hidden = true;
  requestRender('filters', 'view');
  if (focus) searchInput.blur();
}

function focusSearch() {
  setSearchOpen(true, { focus: true });
}

function clearSearch() {
  ui.filters.search = '';
  searchInput.value = '';
  searchClear.hidden = true;
  requestRender('filters', 'view');
  searchInput.focus();
  announce('Búsqueda limpia');
}

/* ------------------------------------------------------------------
   Navegación
------------------------------------------------------------------ */
function setView(view) {
  if (!VIEW_LABELS[view] || ui.view === view) {
    closeSidebar();
    return;
  }

  ui.view = view;
  ui.quickAdd = null;

  // En móvil, al cambiar de vista se cierra el buscador desplegado.
  if (ui.searchOpen) {
    ui.searchOpen = false;
    topbar.classList.remove('is-searching');
    searchToggle?.setAttribute('aria-expanded', 'false');
  }

  closeSidebar();
  requestRender('all');
}

function selectBoard(boardId) {
  if (!setActiveBoard(boardId)) return;
  ui.quickAdd = null;
  save();
  closeSidebar();
  requestRender('all');
  if (!isMobile()) {
    focusAfterRender(`[data-action="select-board"][data-id="${boardId}"]`);
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  prefs.theme = next;
  savePrefs();
  requestRender('chrome');
  announce(next === 'dark' ? 'Tema oscuro activado' : 'Tema claro activado');
}

/* ------------------------------------------------------------------
   Diálogo de tablero
------------------------------------------------------------------ */
let boardEditingId = null;

function openBoardDialog(board = null) {
  boardEditingId = board?.id || null;

  boardForm.reset();
  boardForm.elements.boardId.value = board?.id || '';
  boardForm.elements.boardName.value = board?.name || '';

  boardDialogKicker.textContent = board ? 'Editar tablero' : 'Nuevo tablero';
  boardDialogTitle.textContent = board
    ? 'Ajustes del tablero'
    : 'Un espacio para cada proyecto';
  boardDelete.hidden = !board;

  const selected = board?.color || PALETTE[state.boards.length % PALETTE.length];
  boardSwatches.innerHTML = PALETTE.map((color, index) => `
    <label class="swatch" style="--sw:${color}">
      <input type="radio" name="boardColor" value="${color}"
        ${color === selected ? 'checked' : ''} aria-label="Color de identidad ${index + 1}">
      <span class="swatch__dot" aria-hidden="true"></span>
    </label>
  `).join('');

  openDialog(boardDialog);
  setTimeout(() => boardForm.elements.boardName.focus(), 40);
}

boardForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const data = new FormData(boardForm);
  const name = String(data.get('boardName') || '').trim().slice(0, 50);
  const color = String(data.get('boardColor') || PALETTE[0]);
  const boardId = String(data.get('boardId') || '');

  if (!name) {
    boardForm.elements.boardName.focus();
    showToast('Ponle un nombre al tablero.', { type: 'warn' });
    return;
  }

  if (boardId) {
    const board = updateBoard(boardId, { name, color });
    if (board) {
      log({ action: ACTIONS.BOARD, title: name, detail: 'Tablero actualizado', boardId });
    }
    showToast('Tablero actualizado', { type: 'success' });
  } else {
    createBoard({ name, color });
    showToast('Tablero creado', { type: 'success' });
  }

  save();
  closeDialog(boardDialog);
  requestRender('all');
  announce(boardId ? 'Tablero actualizado' : 'Tablero creado');
});

boardDelete.addEventListener('click', async () => {
  if (!boardEditingId) return;
  const boardId = boardEditingId;
  closeDialog(boardDialog);
  await removeBoard(boardId);
});

async function removeBoard(boardId) {
  const board = getBoard(boardId);
  if (!board) return;

  const count = getTasksForBoard(boardId).length;
  const detail = count ? ` y ${pluralTasks(count)}` : '';
  const ok = await confirmDialog({
    title: 'Eliminar tablero',
    message: `Se eliminará «${board.name}»${detail}. Podrás deshacerlo justo después.`,
    confirmText: 'Eliminar tablero',
  });
  if (!ok) return;

  const snapshot = snapshotState();
  if (!deleteBoard(boardId)) return;

  ui.quickAdd = null;
  save();
  requestRender('all');
  undoToast('Tablero eliminado', snapshot);
  focusAfterRender('#main');
  announce('Tablero eliminado');
}

/* ------------------------------------------------------------------
   Diálogo de tarea
------------------------------------------------------------------ */
let taskEditingId = null;

function openTaskDialog(task = null, options = {}) {
  const board = getActiveBoard();
  if (!board) {
    showToast('Crea un tablero antes de añadir tareas.', { type: 'warn' });
    return;
  }

  taskEditingId = task?.id || null;
  taskForm.reset();
  taskForm.elements.taskId.value = task?.id || '';

  taskColumnSelect.innerHTML = board.columns
    .map((column) => `<option value="${column.id}">${escapeHtml(column.name)}</option>`)
    .join('');

  const currentColumn = task ? findColumnOfTask(board, task.id) : null;
  const columnId = options.columnId || currentColumn?.id || board.columns[0]?.id || '';
  if (columnId) taskColumnSelect.value = columnId;

  taskForm.elements.title.value = task?.title || '';
  taskForm.elements.description.value = task?.description || '';
  taskForm.elements.dueDate.value = task?.dueDate || options.dueDate || '';
  taskForm.elements.assignee.value = task?.assignee || '';

  const priority = task?.priority || 'media';
  taskForm.querySelectorAll('input[name="priority"]').forEach((input) => {
    input.checked = input.value === priority;
  });

  labelPicker.innerHTML = state.labels.map((label) => {
    const checked = Boolean(task?.labelIds?.includes(label.id));
    return `
      <label class="label-toggle" style="--label-color:${label.color}">
        <input type="checkbox" name="labels" value="${label.id}" ${checked ? 'checked' : ''}>
        <span class="label-toggle__dot" aria-hidden="true"></span>
        <span>${escapeHtml(label.name)}</span>
      </label>`;
  }).join('');

  taskDialogKicker.textContent = task ? 'Editar tarea' : 'Nueva tarea';
  taskDialogTitle.textContent = task ? 'Detalles de la tarea' : 'Añadir al tablero';
  taskDelete.hidden = !task;

  if (task) {
    const created = formatDateTime(task.createdAt);
    const updated = formatDateTime(task.updatedAt);
    taskMeta.hidden = false;
    taskMeta.textContent = [
      created && `Creada ${created}`,
      updated && `Editada ${updated}`,
    ].filter(Boolean).join(' · ');
  } else {
    taskMeta.hidden = true;
    taskMeta.textContent = '';
  }

  ui.quickAdd = null;
  openDialog(taskDialog);
  setTimeout(() => taskForm.elements.title.focus(), 40);
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const board = getActiveBoard();
  if (!board) return;

  const title = taskForm.elements.title.value.trim();
  if (!title) {
    taskForm.elements.title.focus();
    showToast('Escribe un título para la tarea.', { type: 'warn' });
    return;
  }

  const changes = {
    columnId: taskColumnSelect.value,
    title,
    description: taskForm.elements.description.value,
    dueDate: taskForm.elements.dueDate.value || null,
    priority: taskForm.querySelector('input[name="priority"]:checked')?.value || 'media',
    labelIds: [...labelPicker.querySelectorAll('input:checked')].map((input) => input.value),
    assignee: taskForm.elements.assignee.value,
  };

  const editing = Boolean(taskEditingId);
  let savedId = taskEditingId;

  if (editing) {
    updateTask(taskEditingId, changes);
  } else {
    const created = createTask({ boardId: board.id, ...changes });
    savedId = created?.id || null;
  }

  save();
  closeDialog(taskDialog);
  requestRender('all');

  if (savedId && ui.view === 'board') {
    focusAfterRender(`[data-task-id="${savedId}"] .task-card__title`);
  }

  showToast(editing ? 'Tarea actualizada' : 'Tarea creada', { type: 'success' });
  announce(editing ? 'Tarea actualizada' : 'Tarea creada');
});

// Ctrl/Cmd + Enter guarda sin salir del teclado.
taskForm.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    taskForm.requestSubmit();
  }
});

taskDelete.addEventListener('click', async () => {
  if (!taskEditingId) return;
  const taskId = taskEditingId;

  const ok = await confirmDialog({
    title: 'Eliminar tarea',
    message: 'La tarea se quitará del tablero. Podrás deshacerlo justo después.',
    confirmText: 'Eliminar tarea',
  });
  if (!ok) return;

  const snapshot = snapshotState();
  closeDialog(taskDialog);
  if (!deleteTask(taskId)) return;

  save();
  requestRender('all');
  undoToast('Tarea eliminada', snapshot);
  focusAfterRender('#main');
  announce('Tarea eliminada');
});

function openTaskFromId(taskId) {
  const task = getTask(taskId);
  if (!task) {
    showToast('La tarea ya no existe.', { type: 'warn' });
    return;
  }
  if (dayDialog.open) closeDialog(dayDialog);
  openTaskDialog(task);
}

function completeTask(taskId) {
  const task = getTask(taskId);
  if (!task) return;

  const board = getBoard(task.boardId);
  const current = board ? findColumnOfTask(board, taskId) : null;
  const reopening = current?.kind === 'done';

  if (!toggleTaskDone(taskId)) return;

  save();
  requestRender('sidebar', 'dashboard', 'filters', 'view');
  focusAfterRender(`[data-task-id="${taskId}"] .task-card__title`);
  announce(reopening ? 'Tarea reabierta' : 'Tarea completada');
}

/* ------------------------------------------------------------------
   Añadido rápido en columna
------------------------------------------------------------------ */
function openQuickAdd(columnId) {
  if (!columnId) return;
  ui.quickAdd = columnId;
  requestRender('view');
  focusAfterRender(`[data-quick-add="${columnId}"] input`);
}

function closeQuickAdd({ restoreFocus = false } = {}) {
  if (!ui.quickAdd) return;
  const columnId = ui.quickAdd;
  ui.quickAdd = null;
  requestRender('view');
  if (restoreFocus) {
    focusAfterRender(`[data-action="quick-add"][data-column="${columnId}"]`);
  }
}

boardView.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-quick-add]');
  if (!form) return;
  event.preventDefault();

  const board = getActiveBoard();
  if (!board) return;

  const columnId = form.dataset.quickAdd;
  const input = form.querySelector('input[name="title"]');
  const title = input?.value.trim();
  if (!title) {
    input?.focus();
    return;
  }

  const task = createTask({ boardId: board.id, columnId, title });
  if (!task) return;

  save();
  requestRender('sidebar', 'dashboard', 'filters', 'view');
  focusAfterRender(`[data-quick-add="${columnId}"] input`);
  announce('Tarea añadida');
});

boardView.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const form = event.target.closest('[data-quick-add]');
  if (!form) return;
  event.preventDefault();
  closeQuickAdd({ restoreFocus: true });
});

/* ------------------------------------------------------------------
   Filtros y búsqueda
------------------------------------------------------------------ */
function announceFilterCount() {
  const board = getActiveBoard();
  if (!board) return;
  const tasks = getTasksForBoard(board.id);
  const visible = applyFilters(tasks, ui.filters, state.labels).length;
  announce(tasks.length === visible
    ? `Mostrando ${pluralTasks(tasks.length)}`
    : `Mostrando ${visible} de ${pluralTasks(tasks.length)}`);
}

filters.addEventListener('change', (event) => {
  const select = event.target.closest('[data-filter]');
  if (!select) return;
  ui.filters[select.dataset.filter] = select.value;
  requestRender('filters', 'view');
  announceFilterCount();
});

const runSearch = debounce(() => {
  ui.filters.search = searchInput.value.trim();
  requestRender('filters', 'view');
  announceFilterCount();
}, 150);

searchInput.addEventListener('input', () => {
  searchClear.hidden = !searchInput.value && !ui.searchOpen;
  runSearch();
});

function resetFilters() {
  ui.filters = createFilters();
  ui.searchOpen = false;
  topbar.classList.remove('is-searching');
  searchToggle?.setAttribute('aria-expanded', 'false');
  requestRender('header', 'filters', 'view');
  announce('Filtros restablecidos');
}

/* ------------------------------------------------------------------
   Arrastrar y soltar
------------------------------------------------------------------ */
function handleDrop({ taskId, toColumnId, beforeTaskId }) {
  const board = getActiveBoard();
  const task = getTask(taskId);
  if (!board || !task) return;

  const from = findColumnOfTask(board, taskId);
  if (!from) return;

  const sameColumn = from.id === toColumnId;
  const snapshot = snapshotState();

  if (!moveTask(taskId, { toColumnId, beforeTaskId })) return;

  save();
  requestRender('sidebar', 'dashboard', 'filters', 'view');

  if (sameColumn) {
    announce(`«${task.title}» reordenada`);
    return;
  }

  const to = board.columns.find((column) => column.id === toColumnId);
  undoToast(`Movida a ${to?.name || 'otra columna'}`, snapshot, { duration: 4600 });
  announce(`«${task.title}» movida a ${to?.name || 'otra columna'}`);
}

/* ------------------------------------------------------------------
   Calendario y diálogo de día
------------------------------------------------------------------ */
function shiftCalendar(delta) {
  const cursor = ui.calendarCursor instanceof Date && !Number.isNaN(ui.calendarCursor.getTime())
    ? ui.calendarCursor
    : new Date();
  ui.calendarCursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
  requestRender('view');
}

function openDay(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return;

  const board = getActiveBoard();
  const tasks = board ? getTasksForBoard(board.id).filter((task) => task.dueDate === dateKey) : [];
  const order = { alta: 0, media: 1, baja: 2 };
  tasks.sort((a, b) => (order[a.priority] - order[b.priority]) || a.title.localeCompare(b.title, 'es'));

  ui.dayDate = dateKey;
  dayDialogKicker.textContent = tasks.length ? pluralTasks(tasks.length) : 'Agenda';
  dayDialogTitle.textContent = formatLongDate(dateKey);

  dayDialogBody.innerHTML = tasks.length
    ? `<div class="day-list">
        ${tasks.map((task) => {
          const column = board ? findColumnOfTask(board, task.id) : null;
          const meta = [column?.name, task.assignee].filter(Boolean).map(escapeHtml).join(' · ');
          return `
            <button class="day-task priority-${task.priority}" type="button"
              data-action="open-task" data-id="${task.id}">
              <span class="day-task__dot" aria-hidden="true"></span>
              <span class="day-task__body">
                <span class="day-task__title">${escapeHtml(task.title)}</span>
                <span class="day-task__meta">${meta}</span>
              </span>
            </button>`;
        }).join('')}
      </div>`
    : `<p class="day-empty">No hay tareas programadas para este día. Puedes añadir una con el botón de abajo.</p>`;

  openDialog(dayDialog);
}

dayAddTask.addEventListener('click', () => {
  const dueDate = ui.dayDate;
  closeDialog(dayDialog);
  openTaskDialog(null, { dueDate });
});

/* ------------------------------------------------------------------
   Historial
------------------------------------------------------------------ */
async function clearHistoryForBoard() {
  const board = getActiveBoard();
  if (!board) return;

  const ok = await confirmDialog({
    title: 'Limpiar historial',
    message: 'Se borrará la actividad registrada de este tablero. Las tareas no se verán afectadas.',
    confirmText: 'Limpiar historial',
  });
  if (!ok) return;

  const snapshot = snapshotState();
  const removed = clearHistory(board.id);
  save();
  requestRender('view');

  if (removed) {
    undoToast('Historial limpiado', snapshot);
    focusAfterRender('#main');
    announce('Historial limpiado');
  } else {
    showToast('No hay actividad para borrar.', { type: 'info' });
  }
}

/* ------------------------------------------------------------------
   Tablero de ejemplo
------------------------------------------------------------------ */
function loadSample() {
  const snapshot = snapshotState();
  const board = loadSampleBoard();
  if (!board) return;

  ui.view = 'board';
  ui.filters = createFilters();
  ui.quickAdd = null;
  save();
  requestRender('all');
  undoToast('Tablero de ejemplo cargado', snapshot, { duration: 6000 });
  announce('Tablero de ejemplo cargado');
}

/* ------------------------------------------------------------------
   Exportar e importar
------------------------------------------------------------------ */
function exportData() {
  const payload = {
    version: state.version,
    activeBoardId: state.activeBoardId,
    boards: state.boards,
    tasks: state.tasks,
    labels: state.labels,
    history: state.history,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kanbanflow-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Copia de seguridad exportada', { type: 'success' });
}

function resetTransientUi() {
  ui.view = 'board';
  ui.filters = createFilters();
  ui.quickAdd = null;
  ui.searchOpen = false;
  ui.calendarCursor = new Date();
  ui.dayDate = null;
  topbar.classList.remove('is-searching');
  searchToggle?.setAttribute('aria-expanded', 'false');
}

async function importFile(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Exportación antigua de un solo tablero: se añade sin tocar lo existente.
    const isLegacyBoard = parsed
      && typeof parsed === 'object'
      && !Array.isArray(parsed.boards)
      && parsed.board
      && typeof parsed.board === 'object'
      && parsed.tasks
      && typeof parsed.tasks === 'object';

    if (isLegacyBoard) {
      const boardName = String(parsed.board.name || 'Tablero importado');
      const ok = await confirmDialog({
        title: 'Importar tablero',
        message: `Se añadirá «${boardName}» como un tablero nuevo. Tus tableros actuales no se modificarán.`,
        confirmText: 'Añadir tablero',
        tone: 'primary',
      });
      if (!ok) return;

      const snapshot = snapshotState();
      const board = importBoardPayload(parsed);
      resetTransientUi();
      save();
      renderAll();
      undoToast('Tablero importado', snapshot, { duration: 6500 });
      announce(`Tablero ${board.name} importado`);
      return;
    }

    const normalized = parseExternalData(parsed);
    const ok = await confirmDialog({
      title: 'Importar datos',
      message: 'Los tableros actuales se reemplazarán por los del archivo. Podrás deshacerlo justo después.',
      confirmText: 'Importar',
      tone: 'primary',
    });
    if (!ok) return;

    const snapshot = snapshotState();
    replaceState(normalized);
    resetTransientUi();
    renderAll();
    undoToast('Datos importados', snapshot, { duration: 6500 });
    announce('Datos importados');
  } catch (error) {
    console.error('[kanbanflow] Importación fallida', error);
    showToast('El archivo no es un JSON válido de KanbanFlow.', { type: 'danger', duration: 5200 });
  }
}

importInput.addEventListener('change', async () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (file) await importFile(file);
});

/* ------------------------------------------------------------------
   Acciones delegadas
------------------------------------------------------------------ */
async function handleAction(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;

  const action = trigger.dataset.action;

  switch (action) {
    case 'go-board':
      event.preventDefault();
      setView('board');
      break;
    case 'toggle-sidebar':
      toggleSidebar();
      break;
    case 'open-sidebar':
      openSidebar();
      break;
    case 'new-board':
      openBoardDialog();
      break;
    case 'edit-board':
      openBoardDialog(getActiveBoard());
      break;
    case 'select-board':
      selectBoard(trigger.dataset.id);
      break;
    case 'delete-board':
      await removeBoard(trigger.dataset.id);
      break;
    case 'new-task':
      openTaskDialog();
      break;
    case 'add-task':
      openTaskDialog(null, { columnId: trigger.dataset.column });
      break;
    case 'open-task':
      openTaskFromId(trigger.dataset.id);
      break;
    case 'toggle-done':
      completeTask(trigger.dataset.id);
      break;
    case 'quick-add':
      openQuickAdd(trigger.dataset.column);
      break;
    case 'clear-filters':
      resetFilters();
      break;
    case 'clear-search':
      clearSearch();
      break;
    case 'toggle-search':
      setSearchOpen(!ui.searchOpen, { focus: true });
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      importInput.click();
      break;
    case 'shortcuts':
      openDialog(shortcutsDialog);
      break;
    case 'toggle-theme':
      toggleTheme();
      break;
    case 'cal-prev':
      shiftCalendar(-1);
      break;
    case 'cal-next':
      shiftCalendar(1);
      break;
    case 'cal-today':
      ui.calendarCursor = new Date();
      requestRender('view');
      break;
    case 'open-day':
      openDay(trigger.dataset.date);
      break;
    case 'clear-history':
      await clearHistoryForBoard();
      break;
    case 'load-sample':
      loadSample();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------
   Atajos de teclado
------------------------------------------------------------------ */
function moveFocusedTask(key) {
  const card = document.activeElement?.closest?.('.task-card');
  if (!card) return;

  const taskId = card.dataset.taskId;
  const task = getTask(taskId);
  const board = getActiveBoard();
  if (!task || !board) return;

  const column = findColumnOfTask(board, taskId);
  if (!column) return;

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const index = board.columns.findIndex((item) => item.id === column.id);
    const target = board.columns[index + (key === 'ArrowRight' ? 1 : -1)];
    if (!target) {
      announce('No hay más columnas en esa dirección');
      return;
    }

    if (!moveTask(taskId, { toColumnId: target.id })) return;
    save();
    requestRender('sidebar', 'dashboard', 'filters', 'view');
    focusAfterRender(`[data-task-id="${taskId}"] .task-card__title`);
    announce(`«${task.title}» movida a ${target.name}`);
    return;
  }

  const ids = column.taskIds;
  const position = ids.indexOf(taskId);
  if (position === -1) return;

  if (key === 'ArrowUp' && position === 0) return;
  if (key === 'ArrowDown' && position === ids.length - 1) return;

  const beforeTaskId = key === 'ArrowUp'
    ? ids[position - 1]
    : (ids[position + 2] || null);

  if (!moveTask(taskId, { toColumnId: column.id, beforeTaskId })) return;

  save();
  requestRender('sidebar', 'dashboard', 'filters', 'view');
  focusAfterRender(`[data-task-id="${taskId}"] .task-card__title`);
  announce(key === 'ArrowUp' ? 'Tarea movida arriba' : 'Tarea movida abajo');
}

function onKeyDown(event) {
  if (event.defaultPrevented) return;

  // Escape: cierra capas de interfaz. Los diálogos nativos se cierran solos.
  if (event.key === 'Escape') {
    if (document.querySelector('dialog[open]')) return;
    if (sidebar.classList.contains('is-open')) {
      event.preventDefault();
      closeSidebar();
      return;
    }
    if (ui.quickAdd) {
      event.preventDefault();
      closeQuickAdd({ restoreFocus: true });
      return;
    }
    if (ui.searchOpen) {
      event.preventDefault();
      setSearchOpen(false);
      return;
    }
    if (document.activeElement === searchInput && searchInput.value) {
      event.preventDefault();
      clearSearch();
      return;
    }
    return;
  }

  if (document.querySelector('dialog[open]')) return;
  if (isEditableElement(event.target)) return;

  if (event.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    moveFocusedTask(event.key);
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    openTaskDialog();
    return;
  }

  if (event.key === 'f' || event.key === 'F' || event.key === '/') {
    event.preventDefault();
    focusSearch();
    return;
  }

  if (event.key === '?') {
    event.preventDefault();
    openDialog(shortcutsDialog);
  }
}

/* ------------------------------------------------------------------
   Eventos globales y arranque
------------------------------------------------------------------ */
function bindEvents() {
  document.addEventListener('click', handleAction);
  document.addEventListener('keydown', onKeyDown);

  // Cierra el añadido rápido al pulsar fuera.
  document.addEventListener('click', (event) => {
    if (!ui.quickAdd) return;
    if (event.target.closest('[data-quick-add]') || event.target.closest('[data-action="quick-add"]')) return;
    ui.quickAdd = null;
    requestRender('view');
  });

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  scrim.addEventListener('click', closeSidebar);

  window.addEventListener('resize', debounce(() => {
    if (!isMobile()) {
      closeSidebar();
      if (ui.searchOpen && window.innerWidth > 760) {
        ui.searchOpen = false;
        topbar.classList.remove('is-searching');
        searchToggle?.setAttribute('aria-expanded', 'false');
        requestRender('header');
      }
    }
  }, 150));

  let externalNotified = false;
  window.addEventListener('kanbanflow:external-change', () => {
    if (externalNotified) return;
    externalNotified = true;
    showToast('Los datos cambiaron en otra pestaña.', {
      type: 'warn',
      duration: 9000,
      action: {
        label: 'Recargar',
        onClick: () => {
          reloadFromStorage();
          externalNotified = false;
          ui.quickAdd = null;
          renderAll();
          showToast('Datos actualizados', { type: 'success' });
        },
      },
    });
  });

  let storageErrorNotified = false;
  window.addEventListener('kanbanflow:storage-error', () => {
    if (storageErrorNotified) return;
    storageErrorNotified = true;
    setTimeout(() => { storageErrorNotified = false; }, 10000);
    showToast('No se pudo guardar en este navegador. Revisa el espacio disponible.', {
      type: 'danger',
      duration: 9000,
    });
  });
}

function init() {
  app.classList.toggle('is-collapsed', Boolean(prefs.sidebarCollapsed));
  setupLiveRegion();
  setupDialogs();
  bindEvents();
  initDragDrop(boardView, handleDrop);
  renderAll();
}

init();
