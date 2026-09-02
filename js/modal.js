// modal.js
// Manejo de apertura/cierre de modales y construcción del formulario de tarea.

import { escapeHtml } from './utils.js';

let activeModalEl = null;
let lastFocusedEl = null;

export function openModal(modalEl) {
  lastFocusedEl = document.activeElement;
  activeModalEl = modalEl;
  modalEl.classList.add('open');
  document.body.classList.add('modal-open');

  // Asociar el manejador de foco (focus trap) una sola vez
  if (!modalEl.dataset.focusTrap) {
    modalEl.dataset.focusTrap = 'true';
    modalEl.addEventListener('keydown', onModalKeydown);
  }

  const firstInput = modalEl.querySelector('input, textarea, select, button');
  firstInput?.focus();
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusable(modalEl) {
  return Array.from(modalEl.querySelectorAll(FOCUSABLE))
    .filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null && !el.disabled);
}

function onModalKeydown(e) {
  if (e.key !== 'Tab') return;
  const focusable = getFocusable(activeModalEl);
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function closeModal(modalEl) {
  modalEl.classList.remove('open');
  document.body.classList.remove('modal-open');
  if (activeModalEl === modalEl) activeModalEl = null;
  lastFocusedEl?.focus?.();
}

export function getActiveModal() {
  return activeModalEl;
}

export function closeActiveModal() {
  if (activeModalEl) closeModal(activeModalEl);
}

export function setupModalDismiss(modalEl) {
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal(modalEl);
  });
  modalEl.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalEl));
  });
}

export function renderLabelOptions(container, labels, selectedIds = []) {
  container.innerHTML = labels.map(label => `
    <label class="label-chip-option" style="--chip-color:${label.color}">
      <input type="checkbox" name="labelIds" value="${label.id}" ${selectedIds.includes(label.id) ? 'checked' : ''}>
      <span class="label-chip-dot"></span>
      <span>${escapeHtml(label.name)}</span>
    </label>
  `).join('');
}

export function readTaskForm(formEl) {
  const fd = new FormData(formEl);
  return {
    title: fd.get('title')?.toString() || '',
    description: fd.get('description')?.toString() || '',
    dueDate: fd.get('dueDate')?.toString() || null,
    priority: fd.get('priority')?.toString() || 'media',
    assignee: fd.get('assignee')?.toString() || '',
    color: fd.get('color')?.toString() || null,
    labelIds: fd.getAll('labelIds').map(v => v.toString())
  };
}

export function fillTaskForm(formEl, task) {
  formEl.querySelector('[name="title"]').value = task.title;
  formEl.querySelector('[name="description"]').value = task.description;
  formEl.querySelector('[name="dueDate"]').value = task.dueDate || '';
  formEl.querySelector('[name="priority"]').value = task.priority;
  formEl.querySelector('[name="assignee"]').value = task.assignee || '';
  const colorInput = formEl.querySelector('[name="color"]');
  if (colorInput) colorInput.value = task.color || '#5B5FEF';
}

export function confirmDialog({ title, message, confirmText = 'Eliminar', danger = true }) {
  return new Promise(resolve => {
    const el = document.getElementById('confirm-modal');
    el.querySelector('.confirm-title').textContent = title;
    el.querySelector('.confirm-message').textContent = message;
    const confirmBtn = el.querySelector('.confirm-action-btn');
    confirmBtn.textContent = confirmText;
    confirmBtn.classList.toggle('btn-danger', danger);
    confirmBtn.classList.toggle('btn-primary', !danger);

    const cleanup = (result) => {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      closeModal(el);
      resolve(result);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);

    const cancelBtn = el.querySelector('.confirm-cancel-btn');
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);

    openModal(el);
  });
}
