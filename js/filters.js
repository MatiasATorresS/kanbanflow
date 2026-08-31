// filters.js
// Filtrado de tareas por prioridad, etiqueta, fecha y búsqueda de texto.

export function createEmptyFilterState() {
  return {
    priority: 'all',     // 'all' | 'alta' | 'media' | 'baja'
    labelId: 'all',      // 'all' | labelId
    dateRange: 'all',    // 'all' | 'today' | 'week' | 'overdue' | 'none'
    search: ''
  };
}

export function applyFilters(tasks, filters) {
  let result = tasks;

  if (filters.priority !== 'all') {
    result = result.filter(t => t.priority === filters.priority);
  }

  if (filters.labelId !== 'all') {
    result = result.filter(t => t.labelIds.includes(filters.labelId));
  }

  if (filters.dateRange !== 'all') {
    result = result.filter(t => matchesDateRange(t.dueDate, filters.dateRange));
  }

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.assignee || '').toLowerCase().includes(q)
    );
  }

  return result;
}

function matchesDateRange(dueDate, range) {
  if (range === 'none') return !dueDate;
  if (!dueDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  switch (range) {
    case 'today': return diffDays === 0;
    case 'week': return diffDays >= 0 && diffDays <= 7;
    case 'overdue': return diffDays < 0;
    default: return true;
  }
}

export function hasActiveFilters(filters) {
  return (
    filters.priority !== 'all' ||
    filters.labelId !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.search.trim() !== ''
  );
}
