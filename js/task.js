// task.js
// Modelo y operaciones CRUD sobre tareas. No toca el DOM.

import { uid } from './storage.js';
import { History } from './history.js';

export function createTask(data, { boardId, columnId, title, description, dueDate, priority, labelIds, assignee, color }) {
  const id = uid('task');
  const task = {
    id,
    boardId,
    title: title.trim(),
    description: description?.trim() || '',
    dueDate: dueDate || null,
    priority: priority || 'media',
    labelIds: labelIds || [],
    assignee: assignee?.trim() || '',
    color: color || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notifiedOverdue: false
  };
  data.tasks[id] = task;

  const board = data.boards.find(b => b.id === boardId);
  const column = board.columns.find(c => c.id === columnId);
  column.taskIds.push(id);

  History.log(data, { action: History.ACTIONS.CREATE, taskTitle: task.title });
  return task;
}

export function updateTask(data, taskId, changes) {
  const task = data.tasks[taskId];
  if (!task) return null;
  Object.assign(task, changes, { updatedAt: new Date().toISOString() });
  History.log(data, { action: History.ACTIONS.EDIT, taskTitle: task.title });
  return task;
}

export function deleteTask(data, taskId) {
  const task = data.tasks[taskId];
  if (!task) return false;

  const board = data.boards.find(b => b.id === task.boardId);
  if (board) {
    for (const col of board.columns) {
      const idx = col.taskIds.indexOf(taskId);
      if (idx !== -1) col.taskIds.splice(idx, 1);
    }
  }
  delete data.tasks[taskId];
  History.log(data, { action: History.ACTIONS.DELETE, taskTitle: task.title });
  return true;
}

export function moveTask(data, taskId, { fromColumnId, toColumnId, toIndex }) {
  const task = data.tasks[taskId];
  if (!task) return false;
  const board = data.boards.find(b => b.id === task.boardId);
  const fromCol = board.columns.find(c => c.id === fromColumnId);
  const toCol = board.columns.find(c => c.id === toColumnId);
  if (!fromCol || !toCol) return false;

  const idx = fromCol.taskIds.indexOf(taskId);
  if (idx !== -1) fromCol.taskIds.splice(idx, 1);

  const insertAt = typeof toIndex === 'number' ? toIndex : toCol.taskIds.length;
  toCol.taskIds.splice(insertAt, 0, taskId);

  task.updatedAt = new Date().toISOString();
  History.log(data, {
    action: History.ACTIONS.MOVE,
    taskTitle: task.title,
    detail: `${fromCol.name} → ${toCol.name}`
  });
  return true;
}

export function getTasksForBoard(data, boardId) {
  return Object.values(data.tasks).filter(t => t.boardId === boardId);
}

export function getTasksForColumn(data, column) {
  return column.taskIds.map(id => data.tasks[id]).filter(Boolean);
}
