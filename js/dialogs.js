// ============================================================
// dialogs.js — diálogos nativos accesibles
// ============================================================

export function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

export function setupDialogs() {
  document.querySelectorAll('dialog').forEach((dialog) => {
    // Cerrar al pulsar el fondo (el backdrop se reporta como el propio dialog).
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  // Botones genéricos de cierre dentro de cualquier diálogo.
  document.addEventListener('click', (event) => {
    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      closer.closest('dialog')?.close();
    }
  });
}

/**
 * Confirmación asíncrona. Devuelve true si la persona confirma.
 */
export function confirmDialog({
  title = '¿Confirmar acción?',
  message = 'Esta acción no se puede deshacer.',
  confirmText = 'Eliminar',
  tone = 'danger',
} = {}) {
  const dialog = document.getElementById('confirm-dialog');
  if (!dialog) return Promise.resolve(false);

  if (dialog.open) dialog.close();
  dialog.returnValue = '';

  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-message').textContent = message;

  const ok = dialog.querySelector('#confirm-ok');
  ok.textContent = confirmText;
  ok.className = `btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`;

  return new Promise((resolve) => {
    const onClose = () => {
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'confirm');
    };
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}
