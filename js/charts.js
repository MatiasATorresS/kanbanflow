// ============================================================
// charts.js — cálculos y gráficos SVG sin librerías
// ============================================================

import { escapeHtml } from './utils.js';

const MONTH_FMT = new Intl.DateTimeFormat('es-CL', { month: 'short' });

export function computeMonthSeries(tasks, months = 6) {
  const now = new Date();
  const buckets = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      date,
      label: `${MONTH_FMT.format(date).replace('.', '')} ${String(date.getFullYear()).slice(2)}`,
      value: 0,
    });
  }

  const index = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  tasks.forEach((task) => {
    const created = new Date(task.createdAt);
    if (Number.isNaN(created.getTime())) return;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = index.get(key);
    if (bucket) bucket.value += 1;
  });

  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => bucket.value),
    total: buckets.reduce((sum, bucket) => sum + bucket.value, 0),
  };
}

export function computeMetrics(tasks, doneIds) {
  const doneTasks = tasks.filter((task) => doneIds.has(task.id));
  const productivity = tasks.length ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  let totalMs = 0;
  let valid = 0;

  doneTasks.forEach((task) => {
    const start = new Date(task.createdAt).getTime();
    const end = new Date(task.completedAt || task.updatedAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return;
    totalMs += end - start;
    valid += 1;
  });

  const cutoff = Date.now() - 7 * 86_400_000;
  const completedLast7 = doneTasks.filter((task) => {
    const end = new Date(task.completedAt || task.updatedAt).getTime();
    return !Number.isNaN(end) && end >= cutoff;
  }).length;

  return {
    productivity,
    avgDays: valid ? totalMs / valid / 86_400_000 : null,
    completedLast7,
    doneCount: doneTasks.length,
  };
}

/* ------------------------------------------------------------------
   Barras
------------------------------------------------------------------ */
export function barChart({ labels, values, caption = 'Tareas creadas por mes' }) {
  const width = 640;
  const height = 220;
  const left = 18;
  const right = 626;
  const top = 32;
  const bottom = 188;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const count = Math.max(labels.length, 1);
  const slot = plotWidth / count;
  const max = Math.max(...values, 1);
  const niceMax = Math.max(1, Math.ceil(max / 2) * 2);
  const barWidth = Math.min(slot * 0.5, 46);

  const gridLines = [0, 0.5, 1]
    .map((ratio) => {
      const y = bottom - plotHeight * ratio;
      return `<line class="chart-grid" x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke-dasharray="${ratio === 0 ? '' : '3 5'}"/>`;
    })
    .join('');

  const bars = values
    .map((value, index) => {
      const center = left + slot * index + slot / 2;
      const barHeight = (value / niceMax) * plotHeight;
      const x = center - barWidth / 2;
      const y = bottom - barHeight;
      return `
        <rect class="chart-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(barHeight, value > 0 ? 3 : 0).toFixed(1)}" rx="5">
          <title>${escapeHtml(labels[index] || '')}: ${value}</title>
        </rect>
        <text class="chart-value" x="${center.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle">${value}</text>
        <text class="chart-axis" x="${center.toFixed(1)}" y="207" text-anchor="middle">${escapeHtml(labels[index] || '')}</text>
      `;
    })
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(caption)}">
    ${gridLines}
    ${bars}
  </svg>`;
}

/* ------------------------------------------------------------------
   Donut
------------------------------------------------------------------ */
export function donutChart({ segments, caption = 'Distribución por estado' }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = 58;
  const center = 80;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const rings = total
    ? segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const fraction = segment.value / total;
        const dash = fraction * circumference;
        const gap = segments.length > 1 ? Math.min(3, dash * 0.25) : 0;
        const circle = `
          <circle class="donut-seg" cx="${center}" cy="${center}" r="${radius}"
            stroke="${segment.color}"
            stroke-dasharray="${Math.max(dash - gap, 0.5).toFixed(2)} ${(circumference - Math.max(dash - gap, 0.5)).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 ${center} ${center})">
            <title>${escapeHtml(segment.label)}: ${segment.value}</title>
          </circle>`;
        offset += dash;
        return circle;
      })
      .join('')
    : `<circle class="donut-track" cx="${center}" cy="${center}" r="${radius}"/>`;

  return `<svg class="donut" viewBox="0 0 160 160" role="img" aria-label="${escapeHtml(caption)}">
    ${total ? '' : ''}
    ${rings}
    <text class="donut-center" x="${center}" y="79" text-anchor="middle">${total}</text>
    <text class="donut-label" x="${center}" y="94" text-anchor="middle">TAREAS</text>
  </svg>`;
}

/* ------------------------------------------------------------------
   Anillo de progreso
------------------------------------------------------------------ */
export function progressRing(percent, { size = 62, stroke = 7, color = 'var(--accent)', label = '' } = {}) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = (64 - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return `<svg viewBox="0 0 64 64" role="img" aria-label="${escapeHtml(label || `${clamped}% completado`)}">
    <circle class="ring-track" cx="32" cy="32" r="${radius}" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="32" cy="32" r="${radius}" stroke-width="${stroke}"
      stroke="${color}"
      stroke-dasharray="${circumference.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"/>
  </svg>`;
}

/* ------------------------------------------------------------------
   Mini barra de proporción
------------------------------------------------------------------ */
export function share(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
