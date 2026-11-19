// ============================================================
// toast.js — avisos efímeros con acción (deshacer incluido)
// ============================================================

import { icon } from './icons.js';

const TYPES = {
  info: { icon: 'sparkles' },
  success: { icon: 'check' },
  danger: { icon: 'alert' },
  warn: { icon: 'alert' },
};

let counter = 0;

export function showToast(message, { type = 'info', action = null, duration = 3200 } = {}) {
  const container = document.getElementById('toasts');
  if (!container) return () => {};

  // Mantén la pila corta para no tapar la interfaz.
  while (container.children.length >= 3) {
    container.firstElementChild?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast${type !== 'info' ? ` toast--${type}` : ''}`;
  toast.dataset.toastId = String(++counter);

  const iconWrap = document.createElement('span');
  iconWrap.className = 'toast__icon';
  iconWrap.innerHTML = icon(TYPES[type]?.icon || 'sparkles', 15);
  toast.appendChild(iconWrap);

  const text = document.createElement('span');
  text.className = 'toast__text';
  text.textContent = message;
  toast.appendChild(text);

  let timer = null;
  let dismissed = false;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 180);
  };

  if (action && action.label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast__action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      dismiss();
      action.onClick?.();
    });
    toast.appendChild(button);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'Cerrar aviso');
  close.innerHTML = icon('x', 13);
  close.addEventListener('click', dismiss);
  toast.appendChild(close);

  const startTimer = () => {
    if (!duration) return;
    timer = setTimeout(dismiss, duration);
  };

  toast.addEventListener('mouseenter', () => {
    if (timer) clearTimeout(timer);
  });
  toast.addEventListener('mouseleave', startTimer);

  container.appendChild(toast);
  startTimer();
  return dismiss;
}
