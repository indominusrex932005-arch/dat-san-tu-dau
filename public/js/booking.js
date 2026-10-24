const slotForm = document.querySelector('#slot-booking-form');
if (slotForm) {
  const summary = document.querySelector('#selection-summary');
  const total = document.querySelector('#selection-total');
  const chips = document.querySelector('#selected-slots');
  const submit = document.querySelector('#hold-slots');
  const datePicker = document.querySelector('#date');
  const bookingDate = slotForm.querySelector('input[name="date"]').value;
  const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  function refreshSelection() {
    const selected = [...slotForm.querySelectorAll('input[name="times"]:checked')];
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
    submit.disabled = !selected.length || Boolean(changedDate);
    submit.textContent = 'Giữ chỗ tối đa 10 phút';
  }
  slotForm.addEventListener('change', refreshSelection);
  datePicker?.addEventListener('change', refreshSelection);
  window.addEventListener('pageshow', refreshSelection);
  slotForm.addEventListener('submit', () => {
    submit.disabled = true;
    submit.textContent = 'Đang kiểm tra và giữ ô…';
  });
  refreshSelection();
}

for (const node of document.querySelectorAll('[data-hold-until]')) {
  const expiresAt = Date.parse(node.dataset.holdUntil);
  const serverNow = Date.parse(node.dataset.serverNow);
  const initialNow = Number.isFinite(serverNow) ? serverNow : Date.now();
  const scriptStartedAt = performance.now();
  const responseStart = performance.getEntriesByType?.('navigation')?.[0]?.responseStart;
  // Count HTML/script loading time too; payment eligibility is still checked by the server.
  const startedAt = Number.isFinite(serverNow) && Number.isFinite(responseStart)
    && responseStart > 0 && responseStart <= scriptStartedAt ? responseStart : scriptStartedAt;
  function updateCountdown() {
    if (node.dataset.expired === 'true') return;
    const currentNow = initialNow + performance.now() - startedAt;
    const remaining = Math.max(0, Math.ceil((expiresAt - currentNow) / 1000));
    if (!Number.isFinite(remaining)) { node.textContent = 'Xem thời hạn trên thông tin đơn.'; return; }
    if (remaining <= 0) {
      node.dataset.expired = 'true';
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.textContent = 'Đã tới hạn giữ chỗ. Tải lại để cập nhật trạng thái đơn.';
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
