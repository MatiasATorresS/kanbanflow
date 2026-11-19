// ============================================================
// model.js — operaciones puras sobre tableros, tareas e historial
// ============================================================

import { state, ui, PALETTE, createColumns } from './store.js';
import { uid, daysUntil, todayKey } from './utils.js';

export const ACTIONS = {
  CREATE: 'create',
  EDIT: 'edit',
  MOVE: 'move',
  DELETE: 'delete',
  IMPORT: 'import',
  BOARD: 'board',
};

const HEX = /^#[0-9a-f]{6}$/i;
const PRIORITIES = ['alta', 'media', 'baja'];
const MAX_HISTORY = 500;

function now() {
  return new Date().toISOString();
}

export function log({ action, title, detail = '', boardId = state.activeBoardId }) {
  state.history.unshift({
    id: uid('evt'),
    action,
    title: String(title || 'Elemento').slice(0, 120),
    detail: String(detail || '').slice(0, 160),
    at: now(),
    boardId: boardId || null,
  });
  if (state.history.length > MAX_HISTORY) {
    state.history.length = MAX_HISTORY;
  }
}

/* ------------------------------------------------------------------
   Selectores
------------------------------------------------------------------ */
export function getBoard(boardId) {
  return state.boards.find((board) => board.id === boardId) || null;
}

export function getActiveBoard() {
  return getBoard(state.activeBoardId) || state.boards[0] || null;
}

export function getTask(taskId) {
  return state.tasks[taskId] || null;
}

export function getTasksForBoard(boardId = state.activeBoardId) {
  return Object.values(state.tasks).filter((task) => task.boardId === boardId);
}

export function getTasksForColumn(column) {
  return column.taskIds.map((id) => state.tasks[id]).filter(Boolean);
}

export function findColumnOfTask(board, taskId) {
  if (!board) return null;
  return board.columns.find((column) => column.taskIds.includes(taskId)) || null;
}

export function doneTaskIds(board = getActiveBoard()) {
  if (!board) return new Set();
  return new Set(
    board.columns
      .filter((column) => column.kind === 'done')
      .flatMap((column) => column.taskIds),
  );
}

export function boardStats(board = getActiveBoard()) {
  const stats = {
    total: 0,
    backlog: 0,
    active: 0,
    review: 0,
    done: 0,
    high: 0,
    overdue: 0,
    dueToday: 0,
    progress: 0,
  };
  if (!board) return stats;

  const today = todayKey();
  for (const column of board.columns) {
    for (const taskId of column.taskIds) {
      const task = state.tasks[taskId];
      if (!task || task.boardId !== board.id) continue;
      stats.total += 1;
      stats[column.kind] = (stats[column.kind] || 0) + 1;
      if (task.priority === 'alta') stats.high += 1;
      if (column.kind !== 'done' && task.dueDate) {
        if (task.dueDate < today) stats.overdue += 1;
        else if (task.dueDate === today) stats.dueToday += 1;
      }
    }
  }

  stats.progress = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

export function historyForBoard(boardId = state.activeBoardId) {
  return state.history.filter((entry) => !entry.boardId || entry.boardId === boardId);
}

/* ------------------------------------------------------------------
   Tableros
------------------------------------------------------------------ */
export function setActiveBoard(boardId) {
  if (!getBoard(boardId)) return false;
  state.activeBoardId = boardId;
  return true;
}

export function createBoard({ name, color }) {
  const cleanName = String(name || '').trim().slice(0, 50) || 'Nuevo tablero';
  const board = {
    id: uid('board'),
    name: cleanName,
    color: HEX.test(color) ? color : PALETTE[state.boards.length % PALETTE.length],
    columns: createColumns(),
    createdAt: now(),
  };
  state.boards.push(board);
  state.activeBoardId = board.id;
  log({ action: ACTIONS.BOARD, title: board.name, detail: 'Tablero creado', boardId: board.id });
  return board;
}

export function updateBoard(boardId, { name, color }) {
  const board = getBoard(boardId);
  if (!board) return null;
  if (typeof name === 'string' && name.trim()) board.name = name.trim().slice(0, 50);
  if (HEX.test(color)) board.color = color;
  return board;
}

export function deleteBoard(boardId) {
  const board = getBoard(boardId);
  if (!board) return false;

  for (const task of Object.values(state.tasks)) {
    if (task.boardId === boardId) delete state.tasks[task.id];
  }

  state.boards = state.boards.filter((item) => item.id !== boardId);

  if (state.activeBoardId === boardId) {
    state.activeBoardId = state.boards[0]?.id || null;
  }

  if (!state.boards.length) {
    const fallbackId = uid('board');
    state.boards.push({
      id: fallbackId,
      name: 'Mi tablero',
      color: PALETTE[0],
      columns: createColumns(),
      createdAt: now(),
    });
    state.activeBoardId = fallbackId;
  }

  log({ action: ACTIONS.DELETE, title: board.name, detail: 'Tablero eliminado', boardId: null });
  return true;
}

/* ------------------------------------------------------------------
   Tareas
------------------------------------------------------------------ */
function normalizeLabels(labelIds) {
  if (!Array.isArray(labelIds)) return [];
  const valid = new Set(state.labels.map((label) => label.id));
  return [...new Set(labelIds.filter((id) => valid.has(id)))];
}

export function createTask({
  boardId = state.activeBoardId,
  columnId,
  title,
  description = '',
  dueDate = null,
  priority = 'media',
  labelIds = [],
  assignee = '',
}) {
  const board = getBoard(boardId);
  if (!board) return null;

  const column = board.columns.find((item) => item.id === columnId) || board.columns[0];
  if (!column) return null;

  const timestamp = now();
  const isDone = column.kind === 'done';
  const task = {
    id: uid('task'),
    boardId: board.id,
    title: String(title || '').trim().slice(0, 120) || 'Sin título',
    description: String(description || '').trim().slice(0, 2000),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate || '') ? dueDate : null,
    priority: PRIORITIES.includes(priority) ? priority : 'media',
    labelIds: normalizeLabels(labelIds),
    assignee: String(assignee || '').trim().slice(0, 60),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: isDone ? timestamp : null,
  };

  state.tasks[task.id] = task;
  column.taskIds.push(task.id);
  log({ action: ACTIONS.CREATE, title: task.title, detail: column.name, boardId: board.id });
  return task;
}

function relocate(task, board, toColumnId, beforeTaskId = null) {
  const fromColumn = findColumnOfTask(board, task.id);
  const toColumn = board.columns.find((column) => column.id === toColumnId);
  if (!toColumn || !fromColumn) return null;

  fromColumn.taskIds = fromColumn.taskIds.filter((id) => id !== task.id);

  let index = toColumn.taskIds.length;
  if (beforeTaskId && beforeTaskId !== task.id) {
    const beforeIndex = toColumn.taskIds.indexOf(beforeTaskId);
    if (beforeIndex !== -1) index = beforeIndex;
  }
  toColumn.taskIds.splice(index, 0, task.id);

  if (toColumn.kind === 'done') {
    if (!task.completedAt) task.completedAt = now();
  } else {
    task.completedAt = null;
  }

  task.updatedAt = now();
  return { fromColumn, toColumn };
}

export function updateTask(taskId, changes) {
  const task = state.tasks[taskId];
  if (!task) return null;
  const board = getBoard(task.boardId);
  if (!board) return null;

  let movedFrom = null;
  let movedTo = null;

  if (changes.columnId) {
    const target = board.columns.find((column) => column.id === changes.columnId);
    const current = findColumnOfTask(board, task.id);
    if (target && current && target.id !== current.id) {
      const result = relocate(task, board, target.id, null);
      if (result) {
        movedFrom = result.fromColumn;
        movedTo = result.toColumn;
      }
    }
  }

  if (typeof changes.title === 'string' && changes.title.trim()) {
    task.title = changes.title.trim().slice(0, 120);
  }
  if (typeof changes.description === 'string') {
    task.description = changes.description.trim().slice(0, 2000);
  }
  if (changes.dueDate !== undefined) {
    task.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(changes.dueDate || '') ? changes.dueDate : null;
  }
  if (PRIORITIES.includes(changes.priority)) {
    task.priority = changes.priority;
  }
  if (changes.labelIds !== undefined) {
    task.labelIds = normalizeLabels(changes.labelIds);
  }
  if (typeof changes.assignee === 'string') {
    task.assignee = changes.assignee.trim().slice(0, 60);
  }

  task.updatedAt = now();
  log({
    action: ACTIONS.EDIT,
    title: task.title,
    detail: movedFrom ? `${movedFrom.name} → ${movedTo.name}` : '',
    boardId: board.id,
  });
  return task;
}

export function deleteTask(taskId) {
  const task = state.tasks[taskId];
  if (!task) return null;
  const board = getBoard(task.boardId);
  if (board) {
    for (const column of board.columns) {
      column.taskIds = column.taskIds.filter((id) => id !== taskId);
    }
  }
  delete state.tasks[taskId];
  log({ action: ACTIONS.DELETE, title: task.title, boardId: task.boardId });
  return task;
}

export function moveTask(taskId, { toColumnId, beforeTaskId = null }) {
  const task = state.tasks[taskId];
  if (!task) return false;
  const board = getBoard(task.boardId);
  if (!board) return false;

  const result = relocate(task, board, toColumnId, beforeTaskId);
  if (!result) return false;

  log({
    action: ACTIONS.MOVE,
    title: task.title,
    detail: result.fromColumn.id === result.toColumn.id
      ? 'Reordenada'
      : `${result.fromColumn.name} → ${result.toColumn.name}`,
    boardId: board.id,
  });
  return true;
}

/** Alternativa de un solo puntero: completa o reabre una tarea. */
export function toggleTaskDone(taskId) {
  const task = state.tasks[taskId];
  if (!task) return false;
  const board = getBoard(task.boardId);
  if (!board) return false;

  const current = findColumnOfTask(board, task.id);
  if (!current) return false;

  let target;
  if (current.kind === 'done') {
    target = board.columns.find((column) => column.kind !== 'done');
  } else {
    target = board.columns.find((column) => column.kind === 'done');
  }
  if (!target) return false;

  return moveTask(task.id, { toColumnId: target.id });
}

export function clearHistory(boardId = state.activeBoardId) {
  const before = state.history.length;
  state.history = state.history.filter((entry) => entry.boardId && entry.boardId !== boardId);
  return before - state.history.length;
}

/* ------------------------------------------------------------------
   Filtros
------------------------------------------------------------------ */
function matchesDue(dueDate, range) {
  if (range === 'none') return !dueDate;
  if (!dueDate) return false;
  const diff = daysUntil(dueDate);
  if (diff === null) return false;
  if (range === 'today') return diff === 0;
  if (range === 'week') return diff >= 0 && diff <= 7;
  if (range === 'overdue') return diff < 0;
  return true;
}

export function applyFilters(tasks, filters, labels = state.labels) {
  const search = filters.search.trim().toLowerCase();
  const labelNames = new Map(labels.map((label) => [label.id, label.name.toLowerCase()]));

  return tasks.filter((task) => {
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.label !== 'all' && !task.labelIds.includes(filters.label)) return false;
    if (filters.due !== 'all' && !matchesDue(task.dueDate, filters.due)) return false;

    if (search) {
      const haystack = [
        task.title,
        task.description,
        task.assignee,
        ...task.labelIds.map((id) => labelNames.get(id) || ''),
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export function activeFilterCount(filters = ui.filters) {
  let count = 0;
  if (filters.priority !== 'all') count += 1;
  if (filters.label !== 'all') count += 1;
  if (filters.due !== 'all') count += 1;
  if (filters.search.trim()) count += 1;
  return count;
}

export function hasActiveFilters(filters = ui.filters) {
  return activeFilterCount(filters) > 0;
}
