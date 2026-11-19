// ============================================================
// store.js — Manejo del estado, persistencia y migraciones
// Guarda todo en el almacenamiento local (localStorage)
// ============================================================

import { uid } from './utils.js';

// Claves usadas en el almacenamiento del navegador
const DATA_KEY = 'kanbanflow.data.v2';
const LEGACY_KEY = 'kanbanflow_data_v1';
const PREFS_KEY = 'kanbanflow.prefs.v1';

export const APP_VERSION = 2;

export const PALETTE = [
  '#2F5B4C',
  '#B8452C',
  '#3A6B8A',
  '#A9761C',
  '#6E5AA8',
  '#4F7A5F',
  '#B55A7E',
  '#5E6B3F',
];

export const DEFAULT_LABELS = [
  { id: 'lbl-frontend', name: 'Frontend', color: '#3A6B8A' },
  { id: 'lbl-backend', name: 'Backend', color: '#4F7A5F' },
  { id: 'lbl-bug', name: 'Bug', color: '#B8452C' },
  { id: 'lbl-diseno', name: 'Diseño', color: '#A9761C' },
  { id: 'lbl-importante', name: 'Importante', color: '#6E5AA8' },
  { id: 'lbl-universidad', name: 'Universidad', color: '#B55A7E' },
];

const KIND_COLORS = {
  backlog: '#8B8173',
  active: '#3A6B8A',
  review: '#A9761C',
  done: '#4F7A5F',
};

const KINDS = ['backlog', 'active', 'review', 'done'];
const PRIORITIES = ['alta', 'media', 'baja'];
const ACTIONS = ['create', 'edit', 'move', 'delete', 'import', 'board'];

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_ID = /^[A-Za-z0-9_-]{1,90}$/;
const RESERVED_IDS = new Set(['__proto__', 'prototype', 'constructor']);

function validColor(value, fallback) {
  return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

function safeId(value, prefix) {
  return typeof value === 'string' && SAFE_ID.test(value) && !RESERVED_IDS.has(value)
    ? value
    : uid(prefix);
}

function isoDate(value, fallback = null) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

export function createColumns() {
  return [
    { id: uid('col'), name: 'Pendiente', kind: 'backlog', color: KIND_COLORS.backlog, taskIds: [] },
    { id: uid('col'), name: 'En progreso', kind: 'active', color: KIND_COLORS.active, taskIds: [] },
    { id: uid('col'), name: 'En revisión', kind: 'review', color: KIND_COLORS.review, taskIds: [] },
    { id: uid('col'), name: 'Completado', kind: 'done', color: KIND_COLORS.done, taskIds: [] },
  ];
}

export function createFilters() {
  return { priority: 'all', label: 'all', due: 'all', search: '' };
}

function createInitialData() {
  const boardId = uid('board');
  return {
    version: APP_VERSION,
    activeBoardId: boardId,
    boards: [
      {
        id: boardId,
        name: 'Mi tablero',
        color: PALETTE[0],
        columns: createColumns(),
        createdAt: new Date().toISOString(),
      },
    ],
    tasks: {},
    labels: DEFAULT_LABELS.map((label) => ({ ...label })),
    history: [],
  };
}

function inferKind(column, index) {
  if (KINDS.includes(column?.kind)) return column.kind;
  const haystack = `${column?.id || ''} ${column?.name || ''}`.toLowerCase();
  if (/complet|done|listo|finaliz|archive/.test(haystack)) return 'done';
  if (/revis|review|qa|valid/.test(haystack)) return 'review';
  if (/progres|doing|curso|activ|wip/.test(haystack)) return 'active';
  if (/pend|backlog|todo|por hacer/.test(haystack)) return 'backlog';
  return KINDS[index] || 'backlog';
}

function normalizeTask(raw, id, boardId, labelIds) {
  const now = new Date().toISOString();
  return {
    id,
    boardId,
    title: String(raw.title ?? 'Sin título').trim().slice(0, 120) || 'Sin título',
    description: String(raw.description ?? '').slice(0, 2000),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : null,
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : 'media',
    labelIds: Array.isArray(labelIds) ? labelIds.filter((value) => typeof value === 'string') : [],
    assignee: String(raw.assignee ?? '').trim().slice(0, 60),
    createdAt: isoDate(raw.createdAt, now),
    updatedAt: isoDate(raw.updatedAt, now),
    completedAt: isoDate(raw.completedAt, null),
  };
}

function normalizeBoard(raw, index, usedIds) {
  if (!raw || typeof raw !== 'object') return null;

  let id = safeId(raw.id, 'board');
  if (usedIds.has(id)) id = uid('board');
  usedIds.add(id);

  const usedColumnIds = new Set();
  const rawColumns = Array.isArray(raw.columns) && raw.columns.length ? raw.columns : createColumns();
  const columns = rawColumns.map((column, columnIndex) => {
    const kind = inferKind(column, columnIndex);
    let columnId = safeId(column?.id, 'col');
    if (usedColumnIds.has(columnId)) columnId = uid('col');
    usedColumnIds.add(columnId);
    return {
      id: columnId,
      name: String(column?.name || kind).slice(0, 40),
      kind,
      color: validColor(column?.color, KIND_COLORS[kind]),
      taskIds: Array.isArray(column?.taskIds) ? column.taskIds.filter((v) => typeof v === 'string') : [],
    };
  });

  return {
    id,
    name: String(raw.name || `Tablero ${index + 1}`).trim().slice(0, 50) || `Tablero ${index + 1}`,
    color: validColor(raw.color, PALETTE[index % PALETTE.length]),
    columns,
    createdAt: isoDate(raw.createdAt, new Date().toISOString()),
  };
}

function normalizeLabels(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_LABELS;
  const seen = new Set();
  const map = new Map();
  const labels = source
    .filter((label) => label && typeof label === 'object')
    .map((label, index) => {
      const originalId = typeof label.id === 'string' && label.id ? label.id : null;
      let id = safeId(label.id, 'lbl');
      if (seen.has(id)) id = uid('lbl');
      seen.add(id);
      if (originalId) map.set(originalId, id);
      return {
        id,
        name: String(label.name || 'Etiqueta').slice(0, 30),
        color: validColor(label.color, DEFAULT_LABELS[index % DEFAULT_LABELS.length].color),
      };
    });

  return { labels, map };
}

const LEGACY_ACTIONS = { creó: 'create', editó: 'edit', movió: 'move', eliminó: 'delete' };

function normalizeHistory(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry, index) => {
      const rawAction = entry.action;
      const action = LEGACY_ACTIONS[rawAction] || (ACTIONS.includes(rawAction) ? rawAction : 'edit');
      const at = entry.at || entry.timestamp;
      return {
        id: typeof entry.id === 'string' ? entry.id : `evt-${index}-${Date.now().toString(36)}`,
        action,
        title: String(entry.title || entry.taskTitle || 'Elemento').slice(0, 120),
        detail: String(entry.detail || '').slice(0, 160),
        at: isoDate(at, new Date().toISOString()),
        boardId: typeof entry.boardId === 'string' ? entry.boardId : null,
      };
    })
    .slice(0, 500);
}

function normalizeData(input) {
  if (!input || typeof input !== 'object') throw new Error('Datos vacíos');
  if (!Array.isArray(input.boards) || input.boards.length === 0) throw new Error('Sin tableros');
  if (!input.tasks || typeof input.tasks !== 'object') throw new Error('Sin tareas');

  const usedIds = new Set();
  const boards = input.boards
    .map((board, index) => normalizeBoard(board, index, usedIds))
    .filter(Boolean);

  if (!boards.length) throw new Error('Tableros inválidos');

  const boardIds = new Set(boards.map((board) => board.id));
  const { labels, map: labelMap } = normalizeLabels(input.labels);
  const validLabelIds = new Set(labels.map((label) => label.id));
  const tasks = {};
  const taskIdMap = new Map();

  for (const [key, raw] of Object.entries(input.tasks)) {
    if (!raw || typeof raw !== 'object') continue;

    const boardId = boardIds.has(raw.boardId) ? raw.boardId : boards[0].id;
    const originalId = typeof raw.id === 'string' && raw.id ? raw.id : key;

    // IDs seguros: evita inyección de atributos al importar datos externos.
    let taskId = safeId(originalId, 'task');
    if (tasks[taskId]) taskId = uid('task');

    const mappedLabels = Array.isArray(raw.labelIds)
      ? raw.labelIds
        .map((value) => labelMap.get(value) || value)
        .filter((value) => validLabelIds.has(value))
      : [];

    const task = normalizeTask(raw, taskId, boardId, [...new Set(mappedLabels)]);
    tasks[task.id] = task;

    taskIdMap.set(key, task.id);
    if (!taskIdMap.has(originalId)) taskIdMap.set(originalId, task.id);
  }

  // Reasigna las referencias de las columnas a los IDs saneados.
  boards.forEach((board) => {
    board.columns.forEach((column) => {
      column.taskIds = column.taskIds.map((taskId) => taskIdMap.get(taskId) || taskId);
    });
  });

  // Limpia referencias rotas/duplicadas y reasigna tareas huérfanas.
  const placed = new Set();
  boards.forEach((board) => {
    board.columns.forEach((column) => {
      column.taskIds = column.taskIds.filter((taskId) => {
        if (!tasks[taskId] || placed.has(taskId)) return false;
        placed.add(taskId);
        tasks[taskId].boardId = board.id;
        return true;
      });
    });
  });

  Object.values(tasks).forEach((task) => {
    if (placed.has(task.id)) return;
    const board = boards.find((b) => b.id === task.boardId) || boards[0];
    board.columns[0].taskIds.push(task.id);
    task.boardId = board.id;
    placed.add(task.id);
  });

  // Coherencia de completedAt con las columnas de tipo "done".
  boards.forEach((board) => {
    const doneColumns = board.columns.filter((column) => column.kind === 'done');
    const doneIds = new Set(doneColumns.flatMap((column) => column.taskIds));
    Object.values(tasks).forEach((task) => {
      if (task.boardId !== board.id) return;
      if (doneIds.has(task.id)) {
        if (!task.completedAt) task.completedAt = task.updatedAt;
      } else {
        task.completedAt = null;
      }
    });
  });

  const activeBoardId = boardIds.has(input.activeBoardId) ? input.activeBoardId : boards[0].id;

  return {
    version: APP_VERSION,
    activeBoardId,
    boards,
    tasks,
    labels,
    history: normalizeHistory(input.history),
  };
}

/** Valida y sanea datos externos (importación) antes de reemplazar el estado. */
export function parseExternalData(input) {
  return normalizeData(input);
}

/**
 * Importa una exportación antigua de un solo tablero
 * (`{ kanbanflowExport: true, board, tasks, labels }`) como tablero nuevo.
 * Genera IDs frescos para evitar colisiones con los datos actuales.
 */
export function importBoardPayload(payload) {
  if (!payload || typeof payload !== 'object' || !payload.board || !payload.tasks) {
    throw new Error('Formato de tablero inválido');
  }

  const normalized = normalizeData({
    version: APP_VERSION,
    activeBoardId: payload.board.id,
    boards: [payload.board],
    tasks: payload.tasks,
    labels: payload.labels,
    history: [],
  });

  const source = normalized.boards[0];
  const boardId = uid('board');
  const columnIds = new Map();
  const taskIds = new Map();

  source.columns.forEach((column) => {
    columnIds.set(column.id, uid('col'));
  });

  const tasks = {};
  Object.values(normalized.tasks).forEach((task) => {
    const id = uid('task');
    taskIds.set(task.id, id);
    tasks[id] = { ...task, id, boardId };
  });

  const columns = source.columns.map((column) => ({
    ...column,
    id: columnIds.get(column.id),
    taskIds: column.taskIds.map((id) => taskIds.get(id)).filter(Boolean),
  }));

  let name = source.name;
  if (state.boards.some((board) => board.name === name)) {
    name = `${name} (importado)`.slice(0, 50);
  }

  const board = {
    ...source,
    id: boardId,
    name,
    columns,
    createdAt: new Date().toISOString(),
  };

  // Reutiliza etiquetas existentes por id y agrega las que falten.
  const knownLabels = new Set(state.labels.map((label) => label.id));
  normalized.labels.forEach((label) => {
    if (!knownLabels.has(label.id)) {
      state.labels.push(label);
      knownLabels.add(label.id);
    }
  });

  state.boards.push(board);
  state.activeBoardId = boardId;
  Object.assign(state.tasks, tasks);
  state.history.unshift({
    id: uid('evt'),
    action: 'import',
    title: board.name,
    detail: 'Tablero importado',
    at: new Date().toISOString(),
    boardId,
  });
  if (state.history.length > 500) state.history.length = 500;

  return board;
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadData() {
  const stored = readJSON(DATA_KEY);
  if (stored) {
    try {
      return { data: normalizeData(stored), fresh: false, migrated: false };
    } catch (error) {
      console.warn('[kanbanflow] Datos guardados inválidos; se intentará migrar o reiniciar.', error);
    }
  }

  const legacy = readJSON(LEGACY_KEY);
  if (legacy) {
    try {
      return { data: normalizeData(legacy), fresh: false, migrated: true };
    } catch (error) {
      console.warn('[kanbanflow] No se pudieron migrar los datos anteriores.', error);
    }
  }

  return { data: createInitialData(), fresh: true, migrated: false };
}

function loadPrefs() {
  const raw = (() => {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  })();

  let legacyTheme = null;
  try {
    legacyTheme = localStorage.getItem('kanbanflow_theme');
  } catch {
    // Sin acceso a localStorage: se usa el tema del sistema.
  }

  const bootTheme = document.documentElement.dataset.theme;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  return {
    theme: raw.theme === 'dark' || raw.theme === 'light'
      ? raw.theme
      : (legacyTheme === 'dark' || legacyTheme === 'light'
        ? legacyTheme
        : (bootTheme === 'dark' || (!bootTheme && systemDark) ? 'dark' : 'light')),
    sidebarCollapsed: Boolean(raw.sidebarCollapsed),
  };
}

const loaded = loadData();

export const state = loaded.data;
export const prefs = loadPrefs();

export const ui = {
  view: 'board',
  filters: createFilters(),
  quickAdd: null,
  calendarCursor: new Date(),
  dayDate: null,
  searchOpen: false,
};

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('[kanbanflow] No se pudieron guardar las preferencias.', error);
  }
}

let saveTimer = null;

// Escribe directamente en localStorage
function writeNow() {
  saveTimer = null;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[kanbanflow] No se pudo guardar el estado.', error);
    window.dispatchEvent(new CustomEvent('kanbanflow:storage-error', { detail: error }));
  }
}

// Guardado optimizado (debounce de 180ms):
// Si el usuario teclea rápido o arrastra muchas tarjetas, no escribimos a disco
// en cada microsegundo, sino que esperamos un pequeño silencio para no congelar la pantalla.
export function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 180);
}

// Guarda de inmediato sin esperar el temporizador (por ejemplo, al cerrar la ventana)
export function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  writeNow();
}

export function replaceState(next) {
  if (!next || typeof next !== 'object') return;
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, next);
  save();
}

export function snapshotState() {
  return structuredClone(state);
}

/** Recarga el estado desde localStorage (por ejemplo, cambios de otra pestaña). */
export function reloadFromStorage() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const next = loadData();
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, next.data);
  return next;
}

if (loaded.fresh) {
  writeNow();
}

if (loaded.migrated) {
  console.info('[kanbanflow] Datos migrados desde la versión anterior.');
  writeNow();
}

window.addEventListener('beforeunload', flushSave);
window.addEventListener('pagehide', flushSave);

// En móvil, visibilitychange es más fiable que beforeunload.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

// Si otra pestaña modifica los datos, avisa para recargar de forma segura.
window.addEventListener('storage', (event) => {
  if (event.key === DATA_KEY) {
    window.dispatchEvent(new CustomEvent('kanbanflow:external-change'));
  }
});
