(() => {
  const scrollBox = document.querySelector('#owner-calendar-scroll');
  const table = scrollBox?.querySelector('.owner-calendar-table');
  if (!scrollBox || !table) return;

  const selectedDate = scrollBox.dataset.selectedDate || '';
  const jumpBtn = document.querySelector('#owner-calendar-jump-now');
  const clockLabel = jumpBtn?.querySelector('[data-calendar-clock]');
  const timeHeaders = [...table.querySelectorAll('thead th[data-time]')];
  if (!timeHeaders.length) return;

  const vnDateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const vnPartsFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const line = document.createElement('div');
  line.className = 'owner-calendar-now-line';
  line.setAttribute('aria-hidden', 'true');
  line.hidden = true;

  const dot = document.createElement('span');
  dot.className = 'owner-calendar-now-dot';
  line.append(dot);
  scrollBox.append(line);

  function vietnamNow() {
    const now = new Date();
    const dateKey = vnDateFmt.format(now);
    const parts = vnPartsFmt.formatToParts(now);
    const num = type => Number(parts.find(p => p.type === type)?.value || 0);
    const hour = num('hour');
    const minute = num('minute');
    const second = num('second');
    const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return { dateKey, hour, minute, second, totalMinutes: hour * 60 + minute + second / 60, hhmm };
  }

  function minutesOf(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  function updateCellStatus(cell, nextStatus, symbol, label, animate) {
    if (cell.dataset.status === nextStatus) return;
    cell.dataset.status = nextStatus;
    const symEl = cell.querySelector('.owner-calendar-slot-symbol');
    const labelEl = cell.querySelector('.owner-calendar-slot > span:last-child');
    if (symEl) symEl.textContent = symbol;
    if (labelEl) labelEl.textContent = label;
    if (animate) {
      cell.classList.remove('is-status-transition');
      void cell.offsetWidth;
      cell.classList.add('is-status-transition');
    }
  }

  function syncPassedCells(nowMinutes, animate) {
    for (const cell of table.querySelectorAll('tbody td[data-time]')) {
      const start = minutesOf(cell.dataset.time);
      const end = start + 30;
      const status = cell.dataset.status;
      if (nowMinutes >= end && status === 'BOOKED') {
        updateCellStatus(cell, 'SERVED', '✓', 'Đã phục vụ', animate);
      } else if (nowMinutes >= start && (status === 'AVAILABLE' || status === 'LOCKED')) {
        updateCellStatus(cell, 'UNAVAILABLE', '—', 'Không phục vụ', animate);
      }
    }
  }

  function updateNowLine(scrollIntoView = false, animateCells = false) {
    const now = vietnamNow();
    const isToday = selectedDate === now.dateKey;
    if (clockLabel) clockLabel.textContent = now.hhmm;
    if (jumpBtn) jumpBtn.hidden = !isToday;

    for (const th of timeHeaders) th.classList.remove('is-current-slot');
    if (!isToday) {
      line.hidden = true;
      return;
    }

    syncPassedCells(now.totalMinutes, animateCells);

    let matchedHeader = null;
    let offsetFraction = 0;
    for (const th of timeHeaders) {
      const start = minutesOf(th.dataset.time);
      if (now.totalMinutes >= start && now.totalMinutes < start + 30) {
        matchedHeader = th;
        offsetFraction = (now.totalMinutes - start) / 30;
        break;
      }
    }

    if (!matchedHeader) {
      line.hidden = true;
      return;
    }

    matchedHeader.classList.add('is-current-slot');
    const headHeight = table.tHead ? table.tHead.offsetHeight : 0;
    const bodyHeight = Math.max(0, table.offsetHeight - headHeight);
    const leftPx = Math.round(matchedHeader.offsetLeft + offsetFraction * matchedHeader.offsetWidth);

    line.style.left = `${leftPx}px`;
    line.style.top = `${headHeight}px`;
    line.style.height = `${bodyHeight}px`;
    line.hidden = false;

    if (scrollIntoView) {
      const cornerWidth = table.querySelector('.owner-calendar-corner')?.offsetWidth || 200;
      const visibleWidth = scrollBox.clientWidth - cornerWidth;
      const targetScroll = Math.max(0, leftPx - cornerWidth - visibleWidth * 0.35);
      scrollBox.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }

  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      updateNowLine(true, true);
    });
  }

  updateNowLine(true, false);
  const timer = window.setInterval(() => updateNowLine(false, true), 15000);
  window.addEventListener('resize', () => updateNowLine(false, false));
  window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
