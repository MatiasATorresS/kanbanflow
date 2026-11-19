// ============================================================
// dragdrop.js — Sistema de arrastrar y soltar (Drag & Drop)
// Compatible con mouse, pantalla táctil y stylus.
// ============================================================

// Estado de la sesión actual de arrastre
let session = null;
let suppressClick = false;
let autoScrollFrame = null;
let lastPoint = { x: 0, y: 0 };
let activeBoardView = null;

// Umbrales para que no se confunda un clic o tap con un arrastre
const DRAG_THRESHOLD = 5;       // Píxeles que debe moverse el cursor/dedo
const LONG_PRESS_MS = 170;      // Tiempo en móvil sobre el icono para iniciar arrastre
const EDGE = 56;                // Distancia al borde de la pantalla para activar autoscroll
const MAX_SPEED = 16;           // Velocidad máxima de scroll automático

// Guardamos en memoria las posiciones de las columnas durante el arrastre.
// Así evitamos recalcular getBoundingClientRect() en cada pixel de movimiento,
// lo que mantiene la pantalla fluida a 60/120 fps en teléfonos móviles.
let listRectCache = [];

// Limpia el resaltado visual de las columnas cuando soltamos la tarjeta
function clearDropTargets() {
  activeBoardView?.querySelectorAll('.task-list.is-drop-target').forEach((list) => {
    list.classList.remove('is-drop-target');
  });
}

// Guarda las coordenadas de cada columna para comparar rápido durante el movimiento
function refreshListCache() {
  if (!activeBoardView) {
    listRectCache = [];
    return;
  }
  listRectCache = Array.from(activeBoardView.querySelectorAll('.task-list')).map((list) => ({
    list,
    rect: list.getBoundingClientRect(),
  }));
}

// Averigua sobre qué columna se encuentra el dedo o el mouse en la coordenada (x, y)
function findListAt(x, y) {
  if (!activeBoardView) return null;

  // Primero probamos directo con el elemento debajo del cursor
  const direct = document.elementFromPoint(x, y)?.closest('.task-list');
  if (direct && activeBoardView.contains(direct)) return direct;

  if (!listRectCache.length) refreshListCache();

  let best = null;
  let bestDistance = Infinity;

  // Si el cursor está entre medio o cerca de una columna, elegimos la más próxima
  for (let i = 0; i < listRectCache.length; i++) {
    const { list, rect } = listRectCache[i];
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = list;
    }
  }

  return bestDistance <= 180 * 180 ? best : null;
}

// Mueve la tarjeta fantasma y acomoda el hueco (placeholder) donde caería la tarjeta
function updatePlacement(x, y) {
  if (!session?.started) return;

  const list = findListAt(x, y);
  if (!list) return;

  const placeholder = session.placeholder;
  const cards = [...list.querySelectorAll('.task-card')];
  
  // Buscamos antes de qué tarjeta debe quedar la que estamos arrastrando
  const reference = cards.find((card) => {
    if (card === session.card) return false;
    const rect = card.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  }) || null;

  if (reference === placeholder) return;
  if (reference) list.insertBefore(placeholder, reference);
  else list.appendChild(placeholder);

  clearDropTargets();
  list.classList.add('is-drop-target');

  session.currentList = list;
  session.targetColumnId = list.dataset.columnId || null;
  session.beforeTaskId = reference?.dataset.taskId || null;
}

function autoScrollStep() {
  if (!session?.started) {
    autoScrollFrame = null;
    return;
  }

  if (!session.wrapper) session.wrapper = activeBoardView?.querySelector('.columns') || null;
  const { x, y } = lastPoint;

  if (session.wrapper) {
    const rect = session.wrapper.getBoundingClientRect();
    let scrolled = false;
    if (x < rect.left + EDGE) {
      const intensity = (rect.left + EDGE - x) / EDGE;
      session.wrapper.scrollLeft -= Math.min(MAX_SPEED, 4 + intensity * MAX_SPEED);
      scrolled = true;
    } else if (x > rect.right - EDGE) {
      const intensity = (x - (rect.right - EDGE)) / EDGE;
      session.wrapper.scrollLeft += Math.min(MAX_SPEED, 4 + intensity * MAX_SPEED);
      scrolled = true;
    }
    if (scrolled) refreshListCache();
  }

  if (session.currentList) {
    const rect = session.currentList.getBoundingClientRect();
    if (y < rect.top + EDGE) {
      const intensity = (rect.top + EDGE - y) / EDGE;
      session.currentList.scrollTop -= Math.min(MAX_SPEED, 3 + intensity * MAX_SPEED);
    } else if (y > rect.bottom - EDGE) {
      const intensity = (y - (rect.bottom - EDGE)) / EDGE;
      session.currentList.scrollTop += Math.min(MAX_SPEED, 3 + intensity * MAX_SPEED);
    }
  }

  updatePlacement(x, y);
  autoScrollFrame = requestAnimationFrame(autoScrollStep);
}

function startAutoScroll() {
  if (autoScrollFrame) return;
  autoScrollFrame = requestAnimationFrame(autoScrollStep);
}

function beginDrag(event) {
  if (!session || session.started) return;

  if (session.longPressTimer) {
    clearTimeout(session.longPressTimer);
    session.longPressTimer = null;
  }

  const { card } = session;
  const rect = card.getBoundingClientRect();
  const x = Number.isFinite(event?.clientX) ? event.clientX : session.startX;
  const y = Number.isFinite(event?.clientY) ? event.clientY : session.startY;

  session.started = true;
  session.offsetX = x - rect.left;
  session.offsetY = y - rect.top;

  const ghost = card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.classList.remove('is-dragging');
  ghost.removeAttribute('id');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.querySelectorAll('button').forEach((button) => {
    button.tabIndex = -1;
    button.setAttribute('aria-hidden', 'true');
  });
  document.body.appendChild(ghost);

  const placeholder = document.createElement('div');
  placeholder.className = 'task-placeholder';
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.pointerEvents = 'none';

  card.parentNode?.insertBefore(placeholder, card.nextSibling);
  card.classList.add('is-dragging');
  card.setAttribute('aria-grabbed', 'true');

  document.getElementById('app')?.classList.add('is-dragging');
  document.body.style.cursor = 'grabbing';

  session.ghost = ghost;
  session.placeholder = placeholder;
  session.targetColumnId = session.fromColumnId;
  session.beforeTaskId = null;
  session.currentList = card.closest('.task-list');

  lastPoint = { x, y };
  refreshListCache();
  updatePlacement(x, y);
  startAutoScroll();
}

function moveGhost(x, y) {
  if (!session?.ghost) return;
  session.ghost.style.left = `${x - session.offsetX}px`;
  session.ghost.style.top = `${y - session.offsetY}px`;
}

function cleanup() {
  if (!session) return;

  if (session.longPressTimer) clearTimeout(session.longPressTimer);

  session.abort?.abort();
  session.ghost?.remove();
  session.placeholder?.remove();
  session.card.classList.remove('is-dragging');
  session.card.removeAttribute('aria-grabbed');

  document.getElementById('app')?.classList.remove('is-dragging');
  document.body.style.cursor = '';
  clearDropTargets();

  if (autoScrollFrame) {
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }

  session = null;
  listRectCache = [];
}

function onPointerDown(event) {
  if (!activeBoardView) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const card = event.target.closest('.task-card');
  if (!card || !activeBoardView.contains(card)) return;

  const handle = event.target.closest('[data-drag-handle]');
  const interactive = event.target.closest(
    'button:not([data-drag-handle]), a, input, textarea, select, [role="button"]',
  );
  if (interactive) return;

  // En táctil solo se arrastra desde el asa para no bloquear el scroll.
  if (event.pointerType !== 'mouse' && !handle) return;

  const list = card.closest('.task-list');
  if (!list) return;

  session = {
    card,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    taskId: card.dataset.taskId,
    fromColumnId: list.dataset.columnId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    longPressTimer: null,
    abort: new AbortController(),
    wrapper: activeBoardView.querySelector('.columns'),
  };

  const { signal } = session.abort;

  const onMove = (moveEvent) => {
    if (!session || moveEvent.pointerId !== session.pointerId) return;

    const dx = moveEvent.clientX - session.startX;
    const dy = moveEvent.clientY - session.startY;
    const distance = Math.hypot(dx, dy);

    if (!session.started && distance > DRAG_THRESHOLD) {
      beginDrag(moveEvent);
    }

    if (session.started) {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      lastPoint = { x: moveEvent.clientX, y: moveEvent.clientY };
      moveGhost(moveEvent.clientX, moveEvent.clientY);
      updatePlacement(moveEvent.clientX, moveEvent.clientY);
    }
  };

  const onUp = (upEvent) => {
    if (!session || upEvent.pointerId !== session.pointerId) return;

    const wasStarted = session.started;
    const { taskId, fromColumnId, targetColumnId, beforeTaskId } = session;

    cleanup();

    if (wasStarted) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 60);
      activeBoardView.dispatchEvent(new CustomEvent('kanban:dragend', {
        detail: { taskId, fromColumnId, toColumnId: targetColumnId, beforeTaskId },
      }));
    }
  };

  const onCancel = (cancelEvent) => {
    if (!session || cancelEvent.pointerId !== session.pointerId) return;
    cleanup();
  };

  window.addEventListener('pointermove', onMove, { signal, passive: false });
  window.addEventListener('pointerup', onUp, { signal });
  window.addEventListener('pointercancel', onCancel, { signal });

  // Pulsación larga sobre el asa: inicia el arrastre sin mover el dedo.
  if (handle && event.pointerType !== 'mouse') {
    session.longPressTimer = setTimeout(() => {
      if (!session || session.started) return;
      beginDrag();
      navigator.vibrate?.(8);
    }, LONG_PRESS_MS);
  }
}

export function initDragDrop(boardView, onMove) {
  activeBoardView = boardView;

  boardView.addEventListener('pointerdown', onPointerDown);
  boardView.addEventListener('contextmenu', (event) => {
    if (event.target.closest('[data-drag-handle]')) event.preventDefault();
  });

  boardView.addEventListener('kanban:dragend', (event) => {
    const { taskId, toColumnId, beforeTaskId } = event.detail;
    if (!toColumnId) return;
    onMove({ taskId, toColumnId, beforeTaskId });
  });

  // Evita que el click posterior al arrastre abra la tarjeta.
  document.addEventListener('click', (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
