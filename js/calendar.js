// calendar.js
// Construye la grilla de calendario mensual y agrupa tareas por fecha límite.

export function buildMonthGrid(year, month) {
  // month: 0-indexed (0 = enero)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  // Lunes = 0 ... Domingo = 6
  const startOffset = (firstDay.getDay() + 6) % 7;

  const cells = [];

  // Días del mes anterior para rellenar la primera semana
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      inCurrentMonth: false
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      inCurrentMonth: true
    });
  }

  // Completar hasta múltiplo de 7
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      date: new Date(year, month + 1, nextDay++),
      inCurrentMonth: false
    });
  }

  return cells;
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function groupTasksByDueDate(tasks) {
  const map = {};
  for (const task of tasks) {
    if (!task.dueDate) continue;
    if (!map[task.dueDate]) map[task.dueDate] = [];
    map[task.dueDate].push(task);
  }
  return map;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
