// ============================================================
// icons.js — set de iconos SVG en línea (sin dependencias)
// ============================================================

const BODIES = {
  plus: '<path d="M10 4.5v11M4.5 10h11"/>',
  minus: '<path d="M4.5 10h11"/>',
  x: '<path d="m5.5 5.5 9 9M14.5 5.5l-9 9"/>',
  check: '<path d="m4.5 10.4 3.6 3.6 7.4-8"/>',
  trash: '<path d="M3.5 5.5h13M8 5.5v-2h4v2M5.5 5.5l.7 10.2h7.6l.7-10.2"/>',
  grip: '<circle cx="7.8" cy="5.6" r="1.35" fill="currentColor" stroke="none"/><circle cx="12.2" cy="5.6" r="1.35" fill="currentColor" stroke="none"/><circle cx="7.8" cy="10" r="1.35" fill="currentColor" stroke="none"/><circle cx="12.2" cy="10" r="1.35" fill="currentColor" stroke="none"/><circle cx="7.8" cy="14.4" r="1.35" fill="currentColor" stroke="none"/><circle cx="12.2" cy="14.4" r="1.35" fill="currentColor" stroke="none"/>',
  arrowRight: '<path d="M3.5 10h13M12 5.5l4.5 4.5-4.5 4.5"/>',
  arrowUpRight: '<path d="M6 14 14 6M7.5 6H14v6.5"/>',
  chevronLeft: '<path d="M12 5 7 10l5 5"/>',
  chevronRight: '<path d="M8 5l5 5-5 5"/>',
  calendar: '<rect x="3" y="4.5" width="14" height="12.5" rx="2.5"/><path d="M3 8.5h14M7 2.5v4M13 2.5v4"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l2.8 1.8"/>',
  chart: '<path d="M3.5 16.5v-6M10 16.5v-13M16.5 16.5v-8.5"/>',
  board: '<rect x="2.5" y="3.5" width="6" height="13" rx="2"/><rect x="11.5" y="3.5" width="6" height="8" rx="2"/>',
  history: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l2.8 1.8"/>',
  folder: '<path d="M2.5 6.5a2 2 0 0 1 2-2h3l1.5 2h6.5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-8Z"/>',
  download: '<path d="M10 3.5v9.5m0 0 3.4-3.4M10 13l-3.4-3.4M3.5 16.5h13"/>',
  upload: '<path d="M10 13V3.5m0 0L6.6 6.9M10 3.5l3.4 3.4M3.5 16.5h13"/>',
  edit: '<path d="M12.6 3.9a1.9 1.9 0 0 1 2.7 2.7L6.5 15.4l-3.4.8.8-3.4 8.7-8.9Z"/>',
  sparkles: '<path d="M9 2.8l1.25 3.45L13.7 7.5l-3.45 1.25L9 12.2 7.75 8.75 4.3 7.5l3.45-1.25L9 2.8Z"/><path d="M15 12.2l.72 1.88L17.6 14.8l-1.88.72L15 17.4l-.72-1.88L12.4 14.8l1.88-.72L15 12.2Z"/>',
  alert: '<path d="M10 3.2 17.5 16h-15L10 3.2Z"/><path d="M10 8v3.2M10 14h.01"/>',
  inbox: '<path d="M3 10.5 5.5 4h9L17 10.5V15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15v-4.5Z"/><path d="M3 10.5h4l1 2h4l1-2h4"/>',
  undo: '<path d="M4.5 8.5h7.2a3.8 3.8 0 1 1 0 7.6H8"/><path d="M7.5 5.5 4.5 8.5l3 3"/>',
  user: '<circle cx="10" cy="7" r="3"/><path d="M4.5 16.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/>',
  flag: '<path d="M5 3.5v13M5 4.5h9.5l-1.7 3 1.7 3H5"/>',
  move: '<path d="M10 3v14M6.5 6.5 10 3l3.5 3.5M6.5 13.5 10 17l3.5-3.5M3 10h14M6.5 6.5 3 10l3.5 3.5M13.5 6.5 17 10l-3.5 3.5"/>',
  dots: '<circle cx="4.5" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.4" fill="currentColor" stroke="none"/>',
  target: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="1" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M11 2.5 4.5 11H9l-.5 6.5L15.5 9H11l0-6.5Z"/>',
  search: '<circle cx="9" cy="9" r="5.6"/><path d="m13.4 13.4 3.3 3.3"/>',
  filter: '<path d="M3 5h14M6 10h8M9 15h2"/>',
  layers: '<path d="m10 3 7 3.8-7 3.8-7-3.8L10 3Z"/><path d="m3.5 10 6.5 3.5L16.5 10M3.5 13.2 10 16.7l6.5-3.5"/>',
  external: '<path d="M11 3.5h5.5V9M16.5 3.5 9 11"/><path d="M15 11.5v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5h4"/>',
};

export function icon(name, size = 16, className = '') {
  const body = BODIES[name] || '';
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function brandMark(size = 33) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="1.25" y="1.25" width="25.5" height="25.5" rx="8" fill="var(--accent-soft)"/>
    <rect x="1.25" y="1.25" width="25.5" height="25.5" rx="8" stroke="var(--accent)" stroke-width="1.4" opacity=".45"/>
    <rect x="6.5" y="7" width="4" height="14" rx="1.6" fill="currentColor" opacity=".95"/>
    <rect x="11.9" y="7" width="4" height="9" rx="1.6" fill="currentColor" opacity=".68"/>
    <rect x="17.3" y="7" width="4" height="11.5" rx="1.6" fill="currentColor" opacity=".42"/>
  </svg>`;
}
