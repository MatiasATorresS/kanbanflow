// charts.js
// Gráficos simples renderizados en SVG puro (sin librerías externas).

import { monthKey, monthLabel } from './utils.js';

export function renderBarChart(container, { data, labels, colors }) {
  const max = Math.max(...data, 1);
  const width = 200;
  const height = 100;
  const topMargin = 16;    // espacio para la etiqueta de valor
  const bottomMargin = 14; // espacio para la etiqueta del eje (mes)
  const usableHeight = height - topMargin - bottomMargin;
  const barWidth = width / data.length;
  const gap = Math.min(barWidth * 0.35, 14);
  const slotBarWidth = barWidth - gap;
  // Si solo hay una barra, no debe ocupar todo el ancho disponible
  const actualBarWidth = data.length === 1 ? 36 : slotBarWidth;

  let bars = '';
  data.forEach((value, i) => {
    const barH = max > 0 ? (value / max) * usableHeight : 0;
    const slotCenter = i * barWidth + barWidth / 2;
    const x = slotCenter - actualBarWidth / 2;
    const y = height - bottomMargin - barH;
    const color = colors?.[i] || 'var(--accent-primary)';
    bars += `
      <rect x="${x}" y="${y}" width="${actualBarWidth}" height="${Math.max(barH, 2)}" rx="3" fill="${color}">
        <title>${labels[i]}: ${value}</title>
      </rect>
      <text x="${slotCenter}" y="${height - 2}" text-anchor="middle" class="chart-axis-label">${labels[i]}</text>
      <text x="${slotCenter}" y="${Math.max(y - 5, 11)}" text-anchor="middle" class="chart-value-label">${value}</text>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="none">
      ${bars}
    </svg>
  `;
}

export function renderDonutChart(container, { segments }) {
  // segments: [{ label, value, color }]
  const realTotal = segments.reduce((s, seg) => s + seg.value, 0);
  const total = realTotal || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  let circles = '';
  segments.forEach(seg => {
    const fraction = seg.value / total;
    const dash = fraction * circumference;
    circles += `
      <circle r="${radius}" cx="50" cy="50" fill="transparent"
        stroke="${seg.color}" stroke-width="14"
        stroke-dasharray="${dash} ${circumference - dash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 50 50)">
        <title>${seg.label}: ${seg.value}</title>
      </circle>
    `;
    offset += dash;
  });

  container.innerHTML = `
    <svg viewBox="0 0 100 100" class="chart-svg-donut">
      ${circles}
      <text x="50" y="46" text-anchor="middle" class="chart-donut-total">${realTotal}</text>
      <text x="50" y="60" text-anchor="middle" class="chart-donut-label">tareas</text>
    </svg>
  `;
}

export function computeTasksPerMonth(tasks) {
  const counts = {};
  tasks.forEach(t => {
    const key = monthKey(t.createdAt);
    counts[key] = (counts[key] || 0) + 1;
  });
  const keys = Object.keys(counts).sort().slice(-6);
  return {
    labels: keys.map(monthLabel),
    data: keys.map(k => counts[k])
  };
}

export function computeAvgCompletionTime(tasks, completedTaskIds) {
  const completed = tasks.filter(t => completedTaskIds.has(t.id));
  if (completed.length === 0) return null;

  let validCount = 0;
  const totalMs = completed.reduce((sum, t) => {
    const created = new Date(t.createdAt);
    const updated = new Date(t.updatedAt);
    if (isNaN(created.getTime()) || isNaN(updated.getTime())) return sum;
    validCount++;
    return sum + Math.max(0, updated - created);
  }, 0);

  if (validCount === 0) return null;
  const avgMs = totalMs / validCount;
  const avgDays = avgMs / (1000 * 60 * 60 * 24);
  return avgDays;
}

export function computeProductivity(tasks, completedTaskIds) {
  if (tasks.length === 0) return 0;
  return Math.round((completedTaskIds.size / tasks.length) * 100);
}
