// dragdrop.js
// Encapsula la Drag & Drop API nativa para tarjetas de tareas.

let draggedTaskId = null;
let draggedFromColumnId = null;
let placeholder = null;

function createPlaceholder(height) {
  const el = document.createElement('div');
  el.className = 'task-card-placeholder';
  el.style.height = `${height}px`;
  return el;
}

export function makeDraggable(cardEl, taskId, columnId) {
  cardEl.draggable = true;

  cardEl.addEventListener('dragstart', (e) => {
    draggedTaskId = taskId;
    draggedFromColumnId = columnId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    placeholder = createPlaceholder(cardEl.offsetHeight);

    requestAnimationFrame(() => {
      cardEl.classList.add('dragging');
    });
  });

  cardEl.addEventListener('dragend', () => {
    cardEl.classList.remove('dragging');
    placeholder?.remove();
    placeholder = null;
    draggedTaskId = null;
    draggedFromColumnId = null;
  });
}

export function makeDropZone(listEl, columnId, onDrop) {
  listEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    e.dataTransfer.dropEffect = 'move';

    const afterEl = getCardAfterPointer(listEl, e.clientY);
    if (!placeholder) return;

    if (afterEl == null) {
      listEl.appendChild(placeholder);
    } else {
      listEl.insertBefore(placeholder, afterEl);
    }
    listEl.classList.add('drop-active');
  });

  listEl.addEventListener('dragleave', (e) => {
    if (!listEl.contains(e.relatedTarget)) {
      listEl.classList.remove('drop-active');
    }
  });

  listEl.addEventListener('drop', (e) => {
    e.preventDefault();
    listEl.classList.remove('drop-active');
    if (!draggedTaskId) return;

    // Calcular índice según posición del placeholder
    const cards = Array.from(listEl.querySelectorAll('.task-card'));
    let toIndex = cards.length;
    if (placeholder && placeholder.parentNode === listEl) {
      const siblings = Array.from(listEl.children).filter(
        c => c.classList.contains('task-card') || c === placeholder
      );
      toIndex = siblings.indexOf(placeholder);
    }

    onDrop({
      taskId: draggedTaskId,
      fromColumnId: draggedFromColumnId,
      toColumnId: columnId,
      toIndex
    });

    placeholder?.remove();
    placeholder = null;
  });
}

function getCardAfterPointer(listEl, y) {
  const cards = Array.from(listEl.querySelectorAll('.task-card:not(.dragging)'));
  return cards.find(card => {
    const box = card.getBoundingClientRect();
    return y < box.top + box.height / 2;
  }) || null;
}
