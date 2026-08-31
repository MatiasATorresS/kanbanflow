// history.js
// Registro de actividad: crear, editar, mover, eliminar tareas.

import { Storage, uid } from './storage.js';

const ACTIONS = {
  CREATE: 'creó',
  EDIT: 'editó',
  MOVE: 'movió',
  DELETE: 'eliminó'
};

export const History = {
  ACTIONS,

  log(data, { action, taskTitle, detail = '' }) {
    const entry = {
      id: uid('hist'),
      action,
      taskTitle,
      detail,
      timestamp: new Date().toISOString()
    };
    data.history.unshift(entry);
    // Mantener un máximo razonable para no inflar localStorage
    if (data.history.length > 300) {
      data.history.length = 300;
    }
    return entry;
  },

  getAll(data) {
    return data.history;
  },

  clear(data) {
    data.history = [];
  }
};
