const panel = document.querySelector('#home-quick-booking');
if (panel) {
  const clockEl = panel.querySelector('#home-live-clock');
  const clockTimeEl = clockEl?.querySelector('[data-clock-time]');
  const vnClock = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  const vnDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parsedServer = Date.parse(clockEl?.dataset.serverNow || '');
  const offsetMs = Number.isFinite(parsedServer) ? parsedServer - Date.now() : 0;
  const serverNowMs = () => Date.now() + offsetMs;

  const courtSelect = panel.querySelector('#home-quick-court');
  const dateInput = panel.querySelector('#home-quick-date');
  const grid = panel.querySelector('#home-quick-grid');
  const subtitle = panel.querySelector('#home-quick-subtitle');
  const detailLink = panel.querySelector('#home-quick-detail-link');
  const statusEl = panel.querySelector('#home-quick-status');
  const summaryEl = panel.querySelector('#home-quick-summary');
  const submitBtn = panel.querySelector('#home-quick-submit');

  let syncUrgency = () => {};
  const tickClock = () => {
    const now = serverNowMs();
    if (clockTimeEl) clockTimeEl.textContent = vnClock.format(new Date(now));
    syncUrgency(now);
  };
  if (clockEl && clockTimeEl) {
    tickClock();
    const clockTimer = window.setInterval(tickClock, 1000);
    window.addEventListener('pagehide', () => window.clearInterval(clockTimer), { once: true });
  }

  if (courtSelect && dateInput && grid && summaryEl && submitBtn) {
    const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
    const selected = new Map();
    let currentCourtId = panel.dataset.courtId || courtSelect.value;
    let currentDate = panel.dataset.date || dateInput.value;
    let facilityReady = panel.dataset.ready === 'true';
    let controller = null;

    const shortPrice = value => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}đ`);

    function setStatus(message) {
      if (!statusEl) return;
      statusEl.textContent = message || '';
      statusEl.hidden = !message;
    }

    function updateSummary() {
      const count = selected.size;
      if (!facilityReady) {
        summaryEl.textContent = 'Cơ sở chưa mở nhận đơn mới';
        submitBtn.disabled = true;
        return;
      }
      if (!count) {
        summaryEl.textContent = 'Chọn các ô trống để đặt nhanh';
        submitBtn.disabled = true;
        return;
      }
      let total = 0;
      for (const price of selected.values()) total += price;
      summaryEl.textContent = `${count} ô (${count * 30} phút) · ${money.format(total)}`;
      submitBtn.disabled = false;
    }

    function updateDetailLink() {
      if (!detailLink) return;
      detailLink.href = currentCourtId
        ? `/courts/${encodeURIComponent(currentCourtId)}?date=${encodeURIComponent(currentDate)}`
        : '/courts';
    }

    function scrollToFirstAvailable() {
      const firstOpen = grid.querySelector('.home-slot:not(:disabled)');
      if (firstOpen && grid.scrollHeight > grid.clientHeight) {
        grid.scrollTop = Math.max(0, firstOpen.offsetTop - grid.offsetTop - 8);
      }
    }

    function renderSlots(slots) {
      selected.clear();
      grid.replaceChildren();
      if (!Array.isArray(slots) || !slots.length) {
        const empty = document.createElement('p');
        empty.className = 'home-availability-empty';
        empty.textContent = 'Không có ô giờ nào cho ngày này.';
        grid.append(empty);
        updateSummary();
        return;
      }
      let availableCount = 0;
      for (const slot of slots) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const selectable = facilityReady && slot.status === 'AVAILABLE';
        if (selectable) availableCount += 1;
        const statusClass = slot.status === 'LOCKED'
          ? 'is-held'
          : slot.status === 'BOOKED'
            ? 'is-booked'
            : slot.status === 'AVAILABLE'
              ? ''
              : 'is-unavailable';
        btn.className = statusClass ? `home-slot ${statusClass}` : 'home-slot';
        btn.dataset.time = slot.time;
        btn.dataset.price = String(slot.priceVND);
        btn.setAttribute('aria-pressed', 'false');
        btn.disabled = !selectable;

        const strong = document.createElement('strong');
        strong.textContent = slot.time;
        const small = document.createElement('small');
        small.textContent = slot.status === 'LOCKED'
          ? 'Đang giữ'
          : slot.status === 'BOOKED'
            ? 'Đã đặt'
            : slot.status === 'AVAILABLE'
              ? shortPrice(slot.priceVND)
              : 'Đã qua';
        btn.append(strong, small);
        grid.append(btn);
      }
      if (!facilityReady) {
        setStatus('Cơ sở đang chờ cập nhật chủ sân hoặc số điện thoại.');
      } else if (!availableCount) {
        setStatus('Ngày này đã hết ô trống. Hãy thử chọn ngày hoặc sân khác.');
      } else {
        setStatus('');
      }
      updateSummary();
      syncUrgency(serverNowMs());
      scrollToFirstAvailable();
    }

    async function loadAvailability() {
      const courtId = courtSelect.value;
      const date = dateInput.value;
      if (!courtId) return;
      if (controller) controller.abort();
      controller = new AbortController();
      grid.classList.add('is-loading');
      setStatus('Đang tải lịch sân…');
      selected.clear();
      updateSummary();
      try {
        const url = `/courts/${encodeURIComponent(courtId)}/availability${date ? `?date=${encodeURIComponent(date)}` : ''}`;
        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) {
          setStatus(data.error || 'Không thể tải lịch sân.');
          return;
        }
        currentCourtId = data.courtId;
        currentDate = data.date;
        facilityReady = Boolean(data.facilityReady);
        dateInput.value = data.date;
        dateInput.dispatchEvent(new Event('sync-display'));
        if (subtitle) subtitle.textContent = `Ô 30 phút · ${data.facilityName}`;
        updateDetailLink();
        renderSlots(data.slots);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        setStatus('Không thể kết nối máy chủ. Hãy thử tải lại.');
      } finally {
        grid.classList.remove('is-loading');
      }
    }

    grid.addEventListener('click', event => {
      const btn = event.target.closest('.home-slot');
      if (!btn || btn.disabled) return;
      const time = btn.dataset.time;
      const price = Number(btn.dataset.price);
      if (selected.has(time)) {
        selected.delete(time);
        btn.classList.remove('is-selected');
        btn.setAttribute('aria-pressed', 'false');
      } else {
        selected.set(time, price);
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed', 'true');
      }
      updateSummary();
    });

    courtSelect.addEventListener('change', loadAvailability);
    dateInput.addEventListener('change', loadAvailability);

    submitBtn.addEventListener('click', () => {
      if (!currentCourtId || !selected.size) return;
      const params = new URLSearchParams();
      if (currentDate) params.set('date', currentDate);
      for (const time of [...selected.keys()].sort()) params.append('times', time);
      location.href = `/courts/${encodeURIComponent(currentCourtId)}?${params.toString()}#booking-contact`;
    });

    syncUrgency = nowMs => {
      if (!currentDate) return;
      const todayKey = vnDateFormatter.format(new Date(nowMs));
      const isToday = currentDate === todayKey;
      const closingWindowMs = 30 * 60 * 1000;
      const dropped = [];
      const setSmall = (btn, small, text) => {
        if (small && btn.dataset.lastLabel !== text) {
          btn.dataset.lastLabel = text;
          small.textContent = text;
        }
      };
      for (const btn of grid.querySelectorAll('.home-slot')) {
        if (btn.classList.contains('is-held') || btn.classList.contains('is-booked') || btn.classList.contains('is-unavailable')) continue;
        const time = btn.dataset.time;
        if (!time) continue;
        const small = btn.querySelector('small');
        if (!btn.dataset.priceLabel) {
          btn.dataset.priceLabel = shortPrice(Number(btn.dataset.price || 0));
        }
        if (!isToday) {
          btn.classList.remove('is-closing-soon');
          setSmall(btn, small, btn.dataset.priceLabel);
          continue;
        }
        const slotStartMs = Date.parse(`${currentDate}T${time}:00+07:00`);
        if (!Number.isFinite(slotStartMs)) continue;
        const diffMs = slotStartMs - nowMs;
        if (diffMs <= 0) {
          btn.classList.remove('is-closing-soon', 'is-selected');
          btn.classList.add('is-unavailable', 'is-just-expired');
          btn.disabled = true;
          btn.setAttribute('aria-pressed', 'false');
          setSmall(btn, small, 'Quá giờ');
          if (selected.delete(time)) dropped.push(time);
        } else if (diffMs <= closingWindowMs && !btn.disabled) {
          const mins = Math.ceil(diffMs / 60000);
          btn.classList.add('is-closing-soon');
          setSmall(btn, small, diffMs < 60000 ? 'Còn <1p' : `Còn ${mins}p`);
        } else {
          btn.classList.remove('is-closing-soon');
          if (!btn.disabled) setSmall(btn, small, btn.dataset.priceLabel);
        }
      }
      if (dropped.length) {
        updateSummary();
        setStatus(`Ô ${dropped.join(', ')} vừa qua giờ đặt và đã được bỏ chọn.`);
      }
    };

    updateDetailLink();
    updateSummary();
    syncUrgency(serverNowMs());
    scrollToFirstAvailable();
  }
}
