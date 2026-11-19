(() => {
  const form = document.querySelector('[data-logout-form]');
  const dialog = document.getElementById('logout-confirm-dialog');
  if (!form || !dialog || typeof dialog.showModal !== 'function') return;

  const cancelBtn = dialog.querySelector('[data-logout-cancel]');
  const confirmBtn = dialog.querySelector('[data-logout-confirm]');
  let confirmed = false;

  form.addEventListener('submit', event => {
    if (confirmed) return;
    event.preventDefault();
    dialog.showModal();
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => dialog.close());
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      confirmed = true;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Đang đăng xuất…';
      dialog.close();
      form.submit();
    });
  }

  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) dialog.close();
  });
})();
