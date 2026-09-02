// board.js
// Modelo y operaciones sobre tableros. No toca el DOM.

import { uid, Storage } from './storage.js';
import { getTasksForBoard } from './task.js';

const BOARD_COLORS = ['#4F5AE8', '#3E8C6C', '#D96049', '#C98A19', '#B55A9E', '#3D86B8'];

export function createBoard(data, name, color) {
  const board = {
    id: uid('board'),
    name: name.trim(),
    color: color || BOARD_COLORS[data.boards.length % BOARD_COLORS.length],
    columns: Storage.createColumnSet(),
    createdAt: new Date().toISOString()
  };
  data.boards.push(board);
  data.activeBoardId = board.id;
  return board;
}

export function renameBoard(data, boardId, name) {
  const board = data.boards.find(b => b.id === boardId);
  if (!board) return null;
  board.name = name.trim();
  return board;
}

export function deleteBoard(data, boardId) {
  const idx = data.boards.findIndex(b => b.id === boardId);
  if (idx === -1) return false;

  // Borrar tareas asociadas
  const taskIds = getTasksForBoard(data, boardId).map(t => t.id);
  taskIds.forEach(id => delete data.tasks[id]);

  data.boards.splice(idx, 1);

  if (data.activeBoardId === boardId) {
    data.activeBoardId = data.boards[0]?.id || null;
  }
  return true;
}

export function getActiveBoard(data) {
  return data.boards.find(b => b.id === data.activeBoardId) || data.boards[0] || null;
}

export function setActiveBoard(data, boardId) {
  const exists = data.boards.some(b => b.id === boardId);
  if (exists) data.activeBoardId = boardId;
  return exists;
}

export function getBoardStats(data, boardId) {
  const tasks = getTasksForBoard(data, boardId);
  const board = data.boards.find(b => b.id === boardId);
  const completedCol = board?.columns.find(c => c.id === 'col-completado');
  const completedIds = new Set(completedCol?.taskIds || []);

  return {
    total: tasks.length,
    pendiente: tasks.filter(t => isInColumn(board, t.id, 'col-pendiente')).length,
    progreso: tasks.filter(t => isInColumn(board, t.id, 'col-progreso')).length,
    revision: tasks.filter(t => isInColumn(board, t.id, 'col-revision')).length,
    completado: tasks.filter(t => completedIds.has(t.id)).length,
    prioridadAlta: tasks.filter(t => t.priority === 'alta').length
  };
}

function isInColumn(board, taskId, columnId) {
  const col = board?.columns.find(c => c.id === columnId);
  return col ? col.taskIds.includes(taskId) : false;
}

export { BOARD_COLORS };
