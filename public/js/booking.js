const slotFormRefreshers = new WeakMap();
function initializeSlotForm() {
  const slotForm = document.querySelector('#slot-booking-form');
  if (!slotForm) return;
  if (slotFormRefreshers.has(slotForm)) {
    slotFormRefreshers.get(slotForm)();
    return;
  }
  const summary = document.querySelector('#selection-summary');
  const total = document.querySelector('#selection-total');
  const chips = document.querySelector('#selected-slots');
  const submit = document.querySelector('#hold-slots');
  const datePicker = document.querySelector('#date');
  const bookingDate = slotForm.querySelector('input[name="date"]').value;
  const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  let submitting = false;
  function refreshSelection() {
    const selected = [...slotForm.querySelectorAll('input[name="times"]:checked:not(:disabled)')];
    const changedDate = datePicker && datePicker.value !== bookingDate;
    summary.textContent = changedDate ? 'Bấm “Xem lịch” để áp dụng ngày mới.'
      : selected.length ? `${selected.length} ô · ${selected.length * 30} phút` : 'Chưa chọn ô giờ.';
    total.textContent = selected.length ? money.format(selected.reduce((sum, input) => sum + Number(input.dataset.price), 0)) : '—';
    chips.replaceChildren();
    for (const input of selected) {
      const chip = document.createElement('span');
      chip.textContent = input.value + '–' + input.dataset.end;
      chips.append(chip);
    }
    submit.disabled = submitting || !selected.length || Boolean(changedDate);
    submit.textContent = submitting ? 'Đang kiểm tra và giữ ô…' : 'Giữ chỗ 10 phút';
  }
  function showSubmissionNotice() {
    let notice = slotForm.querySelector('.booking-submit-notice');
    if (!notice) {
      notice = document.createElement('p');
      notice.className = 'demo-error booking-submit-notice';
      notice.setAttribute('role', 'alert');
      notice.tabIndex = -1;
      slotForm.prepend(notice);
    }
    notice.replaceChildren(document.createTextNode('Chưa xác nhận được kết quả gửi đơn. Yêu cầu có thể đã được xử lý. '));
    const refreshLink = document.createElement('a');
    refreshLink.href = slotForm.dataset.recoveryUrl;
    refreshLink.textContent = 'Tải lại lịch để kiểm tra trước khi gửi lại.';
    notice.append(refreshLink);
    notice.focus();
  }
  async function submitBooking(event) {
    if (!window.fetch || !window.DOMParser) return;
    event.preventDefault();
    if (submitting) return;
    if (!slotForm.querySelector('input[name="times"]:checked:not(:disabled)') || (datePicker && datePicker.value !== bookingDate)) {
      refreshSelection();
      return;
    }
    const body = new URLSearchParams(new FormData(slotForm));
    submitting = true;
    slotForm.setAttribute('aria-busy', 'true');
    refreshSelection();
    try {
      const response = await window.fetch(slotForm.action, {
        method: 'POST', body, credentials: 'same-origin', headers: { Accept: 'text/html' }
      });
      const responseUrl = new URL(response.url, window.location.href);
      if (responseUrl.origin !== window.location.origin) throw new Error('Unexpected response origin');
      if (response.redirected) {
        window.location.assign(responseUrl.href);
        return;
      }
      if (!(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Unexpected response type');
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const main = page.querySelector('main');
      const recoveredForm = page.querySelector('#slot-booking-form[data-booking-form-error="true"]');
      const recoverable = (response.status === 400 || response.status === 409) && recoveredForm;
      if (!main || (response.ok && !recoverable)) throw new Error('Unexpected booking response');
      const currentMain = slotForm.closest('main');
      if (!currentMain) throw new Error('Missing booking page');
      if (recoverable) {
        const recoveryUrl = new URL(recoveredForm.dataset.recoveryUrl, window.location.href);
        if (recoveryUrl.origin !== window.location.origin) throw new Error('Unexpected recovery origin');
        window.history.replaceState(null, '', recoveryUrl.href);
      }
      currentMain.replaceWith(main);
      document.title = page.title;
      if (recoverable) initializeSlotForm();
      const error = main.querySelector('#booking-form-error, [role="alert"]');
      if (error) {
        error.tabIndex = -1;
        error.focus();
      }
    } catch {
      showSubmissionNotice();
    } finally {
      submitting = false;
      slotForm.removeAttribute('aria-busy');
      if (slotForm.isConnected) refreshSelection();
    }
  }
  slotForm.addEventListener('change', refreshSelection);
  datePicker?.addEventListener('change', refreshSelection);
  slotForm.addEventListener('submit', submitBooking);
  slotFormRefreshers.set(slotForm, () => {
    submitting = false;
    slotForm.removeAttribute('aria-busy');
    refreshSelection();
  });
  refreshSelection();
}
initializeSlotForm();
window.addEventListener('pageshow', initializeSlotForm);

for (const node of document.querySelectorAll('[data-hold-until]')) {
  const expiresAt = Date.parse(node.dataset.holdUntil);
  function updateCountdown() {
    if (node.dataset.expired === 'true') return;
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    if (!Number.isFinite(remaining)) { node.textContent = 'Xem thời hạn trên thông tin đơn.'; return; }
    if (remaining <= 0) {
      node.dataset.expired = 'true';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.textContent = 'Đã hết hạn giữ chỗ';
      for (const button of document.querySelectorAll('[data-demo-payment]')) button.disabled = true;
      return;
    }
    node.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0') + ' còn lại';
  }
  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

const requestForm = document.querySelector('#booking-request-form');
if (requestForm) {
  const type = requestForm.querySelector('#requestType');
  const fields = requestForm.querySelector('#request-change-fields');
  const court = requestForm.querySelector('#requestedCourt');
  const date = requestForm.querySelector('#requestedDate');
  const warning = document.createElement('p');
  warning.className = 'demo-error';
  warning.setAttribute('role', 'alert');
  warning.hidden = true;
  fields.append(warning);
  function refreshRequest() {
    const changing = type.value === 'CHANGE';
    fields.hidden = !changing;
    fields.disabled = !changing;
    court.required = changing;
    date.required = changing;
    const option = court.selectedOptions[0];
    const open = option?.dataset.open || '06:00';
    const close = option?.dataset.close || '22:00';
    for (const label of fields.querySelectorAll('[data-request-time]')) {
      const time = label.dataset.requestTime;
      const allowed = time >= open && time < close;
      label.hidden = !allowed;
      const input = label.querySelector('input');
      input.disabled = !allowed;
      if (!allowed) input.checked = false;
    }
    warning.hidden = true;
  }
  type.addEventListener('change', refreshRequest);
  court.addEventListener('change', refreshRequest);
  requestForm.addEventListener('submit', event => {
    if (type.value === 'CHANGE' && !fields.querySelector('input[name="requestedTimes"]:checked')) {
      event.preventDefault();
      warning.textContent = 'Hãy chọn ít nhất một ô giờ muốn đổi.';
      warning.hidden = false;
    }
  });
  refreshRequest();
}
