// ============================================================
// utils.js — helpers puros de fecha, texto y rendimiento
// ============================================================

const DAY_MS = 86_400_000;
const DATE_FMT = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' });
const DATE_LONG_FMT = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const WEEKDAY_FMT = new Intl.DateTimeFormat('es-CL', { weekday: 'long' });

export function uid(prefix = 'id') {
  let random;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    random = crypto.randomUUID().slice(0, 8);
  } else {
    random = Math.random().toString(36).slice(2, 10);
  }
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function debounce(fn, wait = 200) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Clave local YYYY-MM-DD (nunca UTC). */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey() {
  return dayKey(new Date());
}

/** Convierte 'YYYY-MM-DD' en una fecha local a medianoche. */
export function parseDay(value) {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date, amount) {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function daysUntil(value) {
  const target = parseDay(value);
  if (!target) return null;
  return Math.round((target - startOfDay()) / DAY_MS);
}

export function dueInfo(value) {
  const diff = daysUntil(value);
  if (diff === null) return null;
  if (diff < 0) return { text: `Venció hace ${Math.abs(diff)}d`, level: 'overdue', diff };
  if (diff === 0) return { text: 'Vence hoy', level: 'today', diff };
  if (diff === 1) return { text: 'Vence mañana', level: 'soon', diff };
  if (diff <= 6) return { text: `Vence en ${diff}d`, level: 'soon', diff };
  return { text: formatShortDate(value), level: 'normal', diff };
}

export function formatShortDate(value) {
  const date = parseDay(value);
  return date ? DATE_FMT.format(date).replace('.', '') : '';
}

export function formatLongDate(value) {
  const date = value instanceof Date ? value : parseDay(value);
  return date ? DATE_LONG_FMT.format(date) : '';
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(date);
}

export function formatDateTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : DATETIME_FMT.format(date);
}

export function formatTime(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function weekdayName(date) {
  return WEEKDAY_FMT.format(date);
}

export function relativeDayLabel(key) {
  const today = todayKey();
  const yesterday = dayKey(addDays(new Date(), -1));
  if (key === today) return 'Hoy';
  if (key === yesterday) return 'Ayer';
  return formatLongDate(key);
}

export function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
}

/**
 * Resalta la primera coincidencia de `query` dentro de `text`.
 * Escapa el HTML antes de insertar <mark>, por lo que es seguro.
 */
export function highlight(text, query) {
  const raw = String(text ?? '');
  const needle = String(query ?? '').trim();
  if (!needle) return escapeHtml(raw);

  const index = raw.toLowerCase().indexOf(needle.toLowerCase());
  if (index === -1) return escapeHtml(raw);

  return (
    escapeHtml(raw.slice(0, index)) +
    '<mark>' +
    escapeHtml(raw.slice(index, index + needle.length)) +
    '</mark>' +
    escapeHtml(raw.slice(index + needle.length))
  );
}

export function isEditableElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable
  );
}

export function isActivationKey(event) {
  return event.key === 'Enter' || event.key === ' ';
}

export function focusLater(selector, timeout = 30) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelector(selector)?.focus();
    }, timeout);
  });
}
