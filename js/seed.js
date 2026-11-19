// ============================================================
// seed.js — tablero de ejemplo con datos realistas
// ============================================================

import { state, PALETTE } from './store.js';
import {
  getActiveBoard,
  getTasksForBoard,
  createBoard,
  updateBoard,
  createTask,
  log,
} from './model.js';
import { addDays, dayKey } from './utils.js';

function dueIn(days) {
  return dayKey(addDays(new Date(), days));
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const SAMPLE_TASKS = [
  {
    column: 'done',
    title: 'Definir el sistema de diseño',
    description: 'Tipografía, escala de color, radios y componentes base documentados en Figma.',
    priority: 'media',
    labels: ['lbl-diseno'],
    assignee: 'Matías Torres',
    createdDaysAgo: 30,
    completedDaysAgo: 22,
  },
  {
    column: 'done',
    title: 'Configurar el entorno de despliegue',
    description: 'Pipeline de previews por rama y variables de entorno separadas.',
    priority: 'media',
    labels: ['lbl-backend'],
    assignee: 'Diego Soto',
    createdDaysAgo: 19,
    completedDaysAgo: 11,
  },
  {
    column: 'done',
    title: 'Auditar el flujo de registro',
    description: 'Se corrigieron tres validaciones y el estado de carga del botón.',
    priority: 'alta',
    labels: ['lbl-bug', 'lbl-frontend'],
    assignee: 'Camila Rojas',
    createdDaysAgo: 14,
    completedDaysAgo: 4,
  },
  {
    column: 'done',
    title: 'Migrar los textos de la landing',
    description: 'Nuevo tono de voz, títulos más cortos y llamadas a la acción consistentes.',
    priority: 'baja',
    labels: ['lbl-diseno'],
    assignee: 'Camila Rojas',
    createdDaysAgo: 9,
    completedDaysAgo: 1,
  },
  {
    column: 'review',
    title: 'Revisar accesibilidad del menú principal',
    description: 'Foco visible, orden de tabulación y etiquetas ARIA del cajón móvil.',
    priority: 'alta',
    labels: ['lbl-frontend', 'lbl-bug'],
    assignee: 'Diego Soto',
    dueDate: dueIn(-1),
    updatedDaysAgo: 1,
  },
  {
    column: 'review',
    title: 'Validar los textos de la nueva landing',
    description: 'Revisión de copy con el equipo antes de publicar la campaña.',
    priority: 'media',
    labels: ['lbl-diseno', 'lbl-importante'],
    assignee: 'Camila Rojas',
    dueDate: dueIn(2),
    updatedDaysAgo: 0,
  },
  {
    column: 'active',
    title: 'Maquetar la pantalla de inicio',
    description: 'Hero editorial, rail de métricas y tarjetas de proyecto con estados vacíos.',
    priority: 'alta',
    labels: ['lbl-frontend', 'lbl-diseno'],
    assignee: 'Matías Torres',
    dueDate: dueIn(0),
    updatedDaysAgo: 0,
  },
  {
    column: 'active',
    title: 'Migrar el formulario de registro',
    description: 'Validación en cliente, mensajes de error claros y estados de éxito.',
    priority: 'media',
    labels: ['lbl-frontend'],
    assignee: 'Camila Rojas',
    dueDate: dueIn(3),
    updatedDaysAgo: 0,
  },
  {
    column: 'backlog',
    title: 'Entrevistar a cinco usuarios del panel',
    description: 'Guion de 20 minutos enfocado en la creación rápida de tareas.',
    priority: 'media',
    labels: ['lbl-importante'],
    assignee: 'Diego Soto',
    dueDate: dueIn(6),
    updatedDaysAgo: 2,
  },
  {
    column: 'backlog',
    title: 'Documentar la API de tareas',
    description: 'Ejemplos de creación, movimiento y filtros con respuestas de error.',
    priority: 'baja',
    labels: ['lbl-backend'],
    assignee: 'Matías Torres',
    dueDate: dueIn(9),
    updatedDaysAgo: 3,
  },
  {
    column: 'backlog',
    title: 'Explorar modo oscuro en la app móvil',
    description: 'Probar contraste de la paleta cálida sobre pantallas OLED.',
    priority: 'baja',
    labels: ['lbl-frontend', 'lbl-diseno'],
    assignee: 'Camila Rojas',
    dueDate: null,
    updatedDaysAgo: 5,
  },
  {
    column: 'backlog',
    title: 'Preparar la demo para el equipo',
    description: 'Recorrido de 8 minutos: tablero, calendario, métricas y atajos.',
    priority: 'alta',
    labels: ['lbl-importante'],
    assignee: 'Matías Torres',
    dueDate: dueIn(1),
    updatedDaysAgo: 0,
  },
];

export function loadSampleBoard() {
  const current = getActiveBoard();
  const currentIsEmpty = current ? getTasksForBoard(current.id).length === 0 : false;

  let target;
  if (currentIsEmpty && current) {
    updateBoard(current.id, { name: 'Rediseño del producto', color: PALETTE[0] });
    target = current;
  } else {
    target = createBoard({ name: 'Rediseño del producto', color: PALETTE[0] });
  }

  state.activeBoardId = target.id;

  const columnId = (kind) => target.columns.find((column) => column.kind === kind)?.id;

  const historyBefore = state.history.length;

  SAMPLE_TASKS.forEach((sample) => {
    const task = createTask({
      boardId: target.id,
      columnId: columnId(sample.column),
      title: sample.title,
      description: sample.description,
      dueDate: sample.dueDate || null,
      priority: sample.priority,
      labelIds: sample.labels,
      assignee: sample.assignee,
    });

    if (!task) return;

    if (sample.createdDaysAgo !== undefined) {
      task.createdAt = isoDaysAgo(sample.createdDaysAgo);
    }
    if (sample.completedDaysAgo !== undefined) {
      task.completedAt = isoDaysAgo(sample.completedDaysAgo);
    }
    task.updatedAt = sample.completedDaysAgo !== undefined
      ? task.completedAt
      : isoDaysAgo(sample.updatedDaysAgo ?? 0);
  });

  // Elimina el ruido de creación masiva y registra una sola entrada.
  state.history = state.history.slice(historyBefore);
  log({
    action: 'import',
    title: target.name,
    detail: 'Tablero de ejemplo cargado',
    boardId: target.id,
  });

  return target;
}
