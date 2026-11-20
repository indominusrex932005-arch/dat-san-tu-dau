(() => {
  const dialog = document.querySelector('#site-confirm-dialog');
  if (!dialog) return;

  const title = dialog.querySelector('#site-confirm-title');
  const description = dialog.querySelector('#site-confirm-message');
  const confirmation = dialog.querySelector('[data-dialog-confirm]');
  let pending;
  let approvedForm;

  document.addEventListener('submit', event => {
    const { target: form, submitter } = event;
    if (!(form instanceof HTMLFormElement) || !form.matches('[data-confirm-title]') ||
        event.defaultPrevented || approvedForm === form) return;

    let message = form.dataset.confirmMessage;
    if (Object.hasOwn(form.dataset, 'confirmFacility')) {
      const choice = form.elements.namedItem('facilityId');
      if (!choice.value) {
        event.preventDefault();
        choice.reportValidity();
        return;
      }
      const facility = choice.value === 'new'
        ? 'tạo cơ sở mới “' + form.dataset.confirmFacility + '”'
        : 'cấp quyền quản lý “' + choice.selectedOptions[0].textContent.trim() + '”';
      message += ' và ' + facility + '?';
    }

    if (typeof dialog.showModal !== 'function' || typeof form.requestSubmit !== 'function') {
      if (!window.confirm(message)) event.preventDefault();
      return;
    }
    event.preventDefault();
    if (pending) return;

    title.textContent = form.dataset.confirmTitle;
    description.textContent = message;
    confirmation.textContent = form.dataset.confirmLabel;
    pending = { form, submitter, focus: document.activeElement };
    dialog.returnValue = '';
    dialog.showModal();
  });

  dialog.addEventListener('close', () => {
    const action = pending;
    pending = null;
    if (!action) return;
    if (dialog.returnValue !== 'confirm') {
      action.focus?.focus();
      return;
    }
    if (!action.form.isConnected) return;
    approvedForm = action.form;
    try {
      action.form.requestSubmit(action.submitter || undefined);
    } finally {
      approvedForm = null;
    }
  });

  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const { left, right, top, bottom } = dialog.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      dialog.close('cancel');
    }
  });
})();
