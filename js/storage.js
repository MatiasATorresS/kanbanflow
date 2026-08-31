// storage.js
// Capa de persistencia. Todo el acceso a localStorage pasa por aquí.

const STORAGE_KEY = 'kanbanflow_data_v1';
const THEME_KEY = 'kanbanflow_theme';

const DEFAULT_LABELS = [
  { id: 'lbl-frontend', name: 'Frontend', color: '#5B5FEF' },
  { id: 'lbl-backend', name: 'Backend', color: '#4D8B6F' },
  { id: 'lbl-bug', name: 'Bug', color: '#E0654F' },
  { id: 'lbl-diseno', name: 'Diseño', color: '#D9A53D' },
  { id: 'lbl-importante', name: 'Importante', color: '#C2469A' },
  { id: 'lbl-universidad', name: 'Universidad', color: '#3D8BC4' }
];

const COLUMN_TEMPLATE = () => ([
  { id: 'col-pendiente', name: 'Pendiente', taskIds: [] },
  { id: 'col-progreso', name: 'En progreso', taskIds: [] },
  { id: 'col-revision', name: 'En revisión', taskIds: [] },
  { id: 'col-completado', name: 'Completado', taskIds: [] }
]);

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultData() {
  const boardId = uid('board');
  return {
    version: 1,
    activeBoardId: boardId,
    boards: [
      {
        id: boardId,
        name: 'Desarrollo Web',
        color: '#5B5FEF',
        columns: COLUMN_TEMPLATE(),
        createdAt: new Date().toISOString()
      }
    ],
    tasks: {},
    labels: DEFAULT_LABELS,
    history: []
  };
}

export const Storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = defaultData();
        this.save(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.boards || !parsed.tasks || !parsed.labels) {
        throw new Error('Estructura inválida');
      }
      if (!parsed.history || !Array.isArray(parsed.history)) {
        parsed.history = [];
      }
      return parsed;
    } catch (err) {
      console.warn('[storage] Datos corruptos, regenerando.', err);
      const fresh = defaultData();
      this.save(fresh);
      return fresh;
    }
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error('[storage] No se pudo guardar:', err);
      return false;
    }
  },

  getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
  },

  setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  },

  createColumnSet() {
    return COLUMN_TEMPLATE();
  },

  uid
};
