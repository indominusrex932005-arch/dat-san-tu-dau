const paymentPanel = document.querySelector('#provider-payment-panel');
if (paymentPanel) {
  const form = document.querySelector('#provider-payment-form');
  const createButton = document.querySelector('#provider-create-payment');
  const checkButton = document.querySelector('#provider-check-payment');
  const status = document.querySelector('#provider-payment-status');
  const details = document.querySelector('#provider-payment-details');
  const qr = document.querySelector('#provider-payment-qr');
  const checkoutLink = document.querySelector('#provider-checkout-link');
  const countdown = document.querySelector('.booking-countdown');
  const bookingId = paymentPanel.dataset.bookingId;
  const guestToken = form.elements.token.value;
  const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
  let serverTime = Date.parse(countdown.dataset.serverNow);
  let deadline = Date.parse(countdown.dataset.holdUntil);
  const navigationStart = performance.getEntriesByType('navigation')[0]?.responseStart;
  let clockStarted = navigationStart > 0 && navigationStart <= performance.now() ? navigationStart : performance.now();
  let responseStarted = clockStarted;
  let requestController;
  let pollTimer;
  let busy = false;
  let stopped = false;
  let createAttempted = false;
  let canCreate = false;
  let needsRecovery = false;
  let failures = 0;

  function clearPaymentLinks() {
    qr.hidden = true;
    qr.removeAttribute('src');
    checkoutLink.hidden = true;
    checkoutLink.removeAttribute('href');
  }

  function remainingSeconds() {
    return Math.max(0, Math.ceil((deadline - serverTime - performance.now() + clockStarted) / 1000));
  }

  function updateButtons() {
    createButton.disabled = busy || stopped || !canCreate || !Number.isFinite(remainingSeconds()) || remainingSeconds() <= 0;
    checkButton.disabled = busy;
    paymentPanel.setAttribute('aria-busy', String(busy));
  }

  function updateClock() {
    if (stopped) {
      for (const button of document.querySelectorAll('[data-demo-payment]')) button.disabled = true;
      updateButtons();
      return;
    }
    const remaining = remainingSeconds();
    if (!Number.isFinite(remaining)) {
      countdown.textContent = 'Chưa đọc được hạn giữ chỗ. Hãy kiểm tra lại trạng thái.';
      clearPaymentLinks();
    } else if (remaining <= 0) {
      countdown.dataset.expired = 'true';
      countdown.textContent = 'Đã tới hạn giữ chỗ. Hãy kiểm tra lại trạng thái đơn.';
      clearPaymentLinks();
      for (const button of document.querySelectorAll('[data-demo-payment]')) button.disabled = true;
      if (!stopped) status.textContent = 'Đã tới hạn giữ chỗ. Hãy kiểm tra lại trạng thái đơn.';
    } else {
      countdown.textContent = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' +
        String(remaining % 60).padStart(2, '0') + ' còn lại';
    }
    updateButtons();
  }

  function receiptUrl(data) {
    if (data.booking.status !== 'CONFIRMED' || !['PAID', 'DEMO_PAID'].includes(data.booking.paymentStatus) || !data.receiptUrl) return;
    const url = new URL(data.receiptUrl, location.href);
    if (url.origin === location.origin && url.pathname === '/bookings/' + bookingId + '/receipt') return url.href;
  }

  function render(data) {
    needsRecovery = false;
    checkButton.textContent = 'Kiểm tra thanh toán';
    if (data.booking?.id !== bookingId || data.booking.currency !== 'VND') throw new Error('Unexpected booking status');
    const receipt = receiptUrl(data);
    if (receipt) {
      stopped = true;
      clearPaymentLinks();
      location.replace(receipt);
      return;
    }
    if (data.booking.status !== 'HOLD') {
      stopped = true;
      canCreate = false;
      clearPaymentLinks();
      details.hidden = true;
      status.textContent = data.booking.status === 'EXPIRED'
        ? 'Đơn đã hết hạn giữ chỗ.'
        : 'Đơn hiện không thể tiếp tục thanh toán. Hãy xem lại thông tin hoặc liên hệ cơ sở.';
      const label = { EXPIRED: 'Đã hết hạn', CANCELLED: 'Đã hủy', CONFIRMED: 'Đã xác nhận' }[data.booking.status] || 'Không còn giữ chỗ';
      document.querySelector('[data-checkout-booking-status]').textContent = label;
      document.querySelector('[data-checkout-hold-title]').textContent = label;
      for (const instructions of document.querySelectorAll('[data-hold-instructions]')) instructions.hidden = true;
      countdown.textContent = 'Đơn hiện không còn giữ chỗ.';
      updateClock();
      return;
    }
    const now = Date.parse(data.serverNow);
    const until = Date.parse(data.holdUntil);
    if (!Number.isFinite(now) || !Number.isFinite(until)) throw new Error('Missing server deadline');
    serverTime = now;
    deadline = Math.min(deadline, until);
    clockStarted = responseStarted;
    clearPaymentLinks();
    const intent = data.intent;
    canCreate = !intent && !createAttempted;
    details.hidden = !intent;
    createButton.hidden = Boolean(intent);
    if (!intent) {
      status.textContent = createAttempted
        ? 'Chưa xác định được kết quả lần gửi trước. Hãy kiểm tra lại trạng thái trước khi thử tiếp.'
        : 'Chưa có yêu cầu thanh toán thử. Bấm tạo yêu cầu khi bạn sẵn sàng.';
    } else {
      if (intent.bookingId !== bookingId || intent.amountVND !== data.booking.amountVND ||
          intent.currency !== 'VND' || intent.mode !== 'demo') throw new Error('Unexpected payment snapshot');
      document.querySelector('#provider-recipient').textContent = intent.recipientName;
      document.querySelector('#provider-amount').textContent = money.format(intent.amountVND);
      document.querySelector('#provider-reference').textContent = intent.reconciliationCode;
      const messages = {
        CREATING: 'Đang chuẩn bị yêu cầu thanh toán thử.',
        PENDING: 'Đang chờ máy chủ xác nhận thanh toán thử.',
        UNKNOWN: 'Chưa xác định được kết quả từ nhà cung cấp. Hãy kiểm tra lại.',
        FAILED: 'Nhà cung cấp chưa thể xử lý yêu cầu.',
        EXPIRED: 'Yêu cầu thanh toán đã hết hạn.'
      };
      status.textContent = messages[intent.status] || messages.UNKNOWN;
      needsRecovery = ['CREATING', 'UNKNOWN'].includes(intent.status) && remainingSeconds() > 0;
      if (needsRecovery) checkButton.textContent = 'Tra cứu yêu cầu cũ';
      if (intent.status === 'PENDING' && remainingSeconds() > 0) {
        if (typeof data.qrImage === 'string' && data.qrImage.startsWith('data:image/png;base64,')) {
          qr.src = data.qrImage;
          qr.hidden = false;
        }
        if (intent.checkoutUrl) {
          const url = new URL(intent.checkoutUrl);
          if (url.protocol === 'https:' && !url.username && !url.password && (!guestToken || !url.href.includes(guestToken))) {
            checkoutLink.href = url.href;
            checkoutLink.hidden = false;
          }
        }
        if (qr.hidden && checkoutLink.hidden) status.textContent = 'Chưa có mã QR hoặc đường dẫn hợp lệ. Hãy liên hệ cơ sở.';
      }
    }
    updateClock();
  }

  async function request(url, options = {}) {
    const controller = new AbortController();
    requestController = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        ...options, credentials: 'same-origin', referrerPolicy: 'no-referrer', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: controller.signal
      });
      responseStarted = performance.now();
      if ([401, 403].includes(response.status)) {
        stopped = true;
        throw new Error('Access denied');
      }
      if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Unexpected response');
      const data = await response.json();
      if (!response.ok && !data.intent) throw new Error('Payment unavailable');
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function schedule() {
    clearTimeout(pollTimer);
    if (!stopped && !document.hidden) pollTimer = setTimeout(refresh, Math.min(30000, 5000 * (2 ** failures)));
  }

  function unavailable() {
    needsRecovery = false;
    failures = Math.min(failures + 1, 3);
    canCreate = false;
    clearPaymentLinks();
    status.textContent = stopped
      ? 'Phiên truy cập không còn hợp lệ. Hãy mở lại đơn bằng tài khoản hoặc đường dẫn riêng của bạn.'
      : 'Chưa đọc được trạng thái từ máy chủ. Bấm kiểm tra lại.';
  }

  async function refresh() {
    if (busy) return;
    clearTimeout(pollTimer);
    busy = true;
    updateButtons();
    try {
      render(await request(paymentPanel.dataset.statusUrl));
      failures = 0;
    } catch { unavailable(); }
    finally {
      busy = false;
      updateButtons();
      schedule();
    }
  }

  async function submitIntent() {
    if (busy || stopped || remainingSeconds() <= 0) return;
    const restoreFocus = document.activeElement === createButton;
    createAttempted = true;
    busy = true;
    canCreate = false;
    clearTimeout(pollTimer);
    updateButtons();
    status.textContent = needsRecovery ? 'Đang tra cứu yêu cầu thanh toán cũ…' : 'Đang gửi yêu cầu thanh toán thử…';
    try {
      await request(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)) });
    } catch { unavailable(); }
    finally {
      busy = false;
      updateButtons();
    }
    await refresh();
    if (restoreFocus && !stopped) checkButton.focus();
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!createButton.disabled) submitIntent();
  });
  checkButton.addEventListener('click', () => needsRecovery ? submitIntent() : refresh());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(pollTimer);
    else if (!stopped) refresh();
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(pollTimer);
    requestController?.abort();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      stopped = false;
      refresh();
    }
  });
  updateClock();
  window.setInterval(updateClock, 1000);
  refresh();
}
