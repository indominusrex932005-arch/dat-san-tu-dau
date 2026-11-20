if (typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.showModal) {
  document.documentElement.classList.add('has-booking-date-picker');
  const picker = document.createElement('dialog');
  picker.className = 'site-dialog booking-datepicker';
  picker.setAttribute('aria-labelledby', 'booking-datepicker-title');
  picker.innerHTML = `
    <h2 id="booking-datepicker-title">Chọn ngày chơi</h2>
    <div class="booking-datepicker-nav">
      <button type="button" data-month="-1" aria-label="Tháng trước">‹</button>
      <strong aria-live="polite"></strong>
      <button type="button" data-month="1" aria-label="Tháng sau">›</button>
    </div>
    <div class="booking-datepicker-grid" aria-hidden="true">
      <span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
    </div>
    <div class="booking-datepicker-grid" data-days role="group" aria-label="Ngày trong tháng"></div>
    <form method="dialog" class="site-dialog-actions">
      <button class="demo-button demo-button-secondary">Đóng</button>
    </form>`;
  document.body.append(picker);

  const days = picker.querySelector('[data-days]');
  const heading = picker.querySelector('strong');
  const prev = picker.querySelector('[data-month="-1"]');
  const next = picker.querySelector('[data-month="1"]');
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dayLabel = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeZone: 'UTC' });
  const vietnamDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateKey = value => value.toISOString().slice(0, 10);
  const utcDate = key => new Date(key + 'T00:00:00Z');
  const firstOfMonth = value => {
    const date = new Date(value);
    date.setUTCDate(1);
    return date;
  };
  const moveMonth = (value, amount) => {
    const date = firstOfMonth(value);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return date;
  };
  const permitted = key => key >= (input.min || '0001-01-01') && key <= (input.max || '9999-12-31');
  const keyFor = value => Number.isFinite(value.getTime()) ? dateKey(value) : '';
  let input;
  let activeDate;
  let dateTrigger;

  function chooseValue(field, value, dialog) {
    const changed = field.value !== value;
    field.value = value;
    dialog.close();
    if (changed) {
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function renderMonth(restoreDayFocus = false) {
    const first = firstOfMonth(activeDate);
    const following = moveMonth(first, 1);
    const last = new Date(following.getTime() - 86400000);
    const min = input.min || '0001-01-01';
    const max = input.max || '9999-12-31';
    heading.textContent = monthLabel.format(first);
    prev.disabled = dateKey(first) <= min;
    next.disabled = dateKey(last) >= max;
    days.replaceChildren();
    const today = vietnamDate.format(new Date());
    let focusedDay;
    for (let day = 1; day <= last.getUTCDate(); day++) {
      const value = new Date(first);
      value.setUTCDate(day);
      const key = dateKey(value);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.date = key;
      button.textContent = day;
      button.disabled = !permitted(key);
      button.tabIndex = key === dateKey(activeDate) ? 0 : -1;
      button.setAttribute('aria-label', dayLabel.format(value));
      button.setAttribute('aria-pressed', String(key === input.value));
      if (key === today) button.setAttribute('aria-current', 'date');
      if (day === 1) button.style.gridColumnStart = String((first.getUTCDay() + 6) % 7 + 1);
      if (button.tabIndex === 0) focusedDay = button;
      days.append(button);
    }
    if (restoreDayFocus) focusedDay?.focus();
  }

  function selectFocus(date, restoreDayFocus) {
    const key = keyFor(date);
    if (!key) return;
    const min = input.min || '0001-01-01';
    const max = input.max || '9999-12-31';
    activeDate = utcDate(key < min ? min : key > max ? max : key);
    renderMonth(restoreDayFocus);
  }

  const formatDisplayDate = value => {
    const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
  };

  for (const field of document.querySelectorAll('.booking-picker-field')) {
    const dateInput = field.querySelector('input[type="date"]');
    if (!dateInput) continue;
    const display = document.createElement('input');
    display.type = 'text';
    display.readOnly = true;
    display.className = dateInput.className ? `${dateInput.className} booking-date-display` : 'booking-date-display';
    display.placeholder = 'dd/mm/yyyy';
    display.value = formatDisplayDate(dateInput.value);
    const ariaLabel = dateInput.getAttribute('aria-label') || dateInput.labels?.[0]?.textContent?.trim();
    if (ariaLabel) display.setAttribute('aria-label', `${ariaLabel} (dd/mm/yyyy)`);
    field.classList.add('has-date-display');
    field.insertBefore(display, dateInput);
    const sync = () => { display.value = formatDisplayDate(dateInput.value); };
    dateInput.addEventListener('change', sync);
    dateInput.addEventListener('input', sync);
    dateInput.addEventListener('sync-display', sync);
    dateInput.tabIndex = -1;
    dateInput.setAttribute('aria-hidden', 'true');
  }

  function openDatePicker(targetInput, returnFocusEl) {
    if (!targetInput || targetInput.disabled || targetInput.readOnly) return;
    input = targetInput;
    dateTrigger = returnFocusEl;
    const current = utcDate(input.value);
    selectFocus(keyFor(current) ? current : utcDate(vietnamDate.format(new Date())), false);
    picker.showModal();
    days.querySelector('[tabindex="0"]')?.focus();
  }

  document.addEventListener('click', event => {
    const display = event.target.closest('.booking-date-display');
    if (display) {
      openDatePicker(display.parentElement.querySelector('input[type="date"]'), display);
      return;
    }
    const trigger = event.target.closest('.booking-date-trigger');
    if (!trigger) return;
    openDatePicker(trigger.parentElement.querySelector('input[type="date"]'), trigger);
  });

  document.addEventListener('keydown', event => {
    const display = event.target.closest('.booking-date-display');
    if (!display || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openDatePicker(display.parentElement.querySelector('input[type="date"]'), display);
  });

  picker.addEventListener('click', event => {
    const month = event.target.closest('[data-month]');
    if (month) {
      selectFocus(moveMonth(activeDate, Number(month.dataset.month)), false);
      if (month.disabled) days.querySelector('[tabindex="0"]')?.focus();
      return;
    }
    const day = event.target.closest('[data-date]');
    if (!day || day.disabled) return;
    chooseValue(input, day.dataset.date, picker);
  });
  picker.addEventListener('close', () => dateTrigger?.focus());

  days.addEventListener('keydown', event => {
    const day = event.target.closest('[data-date]');
    if (!day) return;
    const date = utcDate(day.dataset.date);
    const weekday = (date.getUTCDay() + 6) % 7;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (!Object.hasOwn(offsets, event.key)) return;
    event.preventDefault();
    date.setUTCDate(date.getUTCDate() + offsets[event.key]);
    selectFocus(date, true);
  });

  if (document.querySelector('.booking-time-trigger')) {
    const timePicker = document.createElement('dialog');
    timePicker.className = 'site-dialog booking-timepicker';
    timePicker.setAttribute('aria-labelledby', 'booking-timepicker-title');
    timePicker.innerHTML = `
      <h2 id="booking-timepicker-title">Chọn giờ</h2>
      <div class="booking-time-options" role="group" aria-label="Các mốc giờ cách nhau 30 phút"></div>
      <form method="dialog" class="site-dialog-actions">
        <button class="demo-button demo-button-secondary">Đóng</button>
      </form>`;
    document.body.append(timePicker);
    const title = timePicker.querySelector('h2');
    const times = timePicker.querySelector('.booking-time-options');
    const options = Array.from({ length: 48 }, (_, index) => {
      const time = String(Math.floor(index / 2)).padStart(2, '0') + (index % 2 ? ':30' : ':00');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.time = time;
      button.textContent = time;
      times.append(button);
      return button;
    });
    let timeInput;
    let timeTrigger;

    function focusTime(button) {
      for (const option of options) option.tabIndex = option === button ? 0 : -1;
      button.focus();
    }

    document.addEventListener('click', event => {
      const trigger = event.target.closest('.booking-time-trigger');
      if (!trigger) return;
      timeInput = trigger.parentElement.querySelector('input[type="time"]');
      if (!timeInput || timeInput.disabled || timeInput.readOnly) return;
      timeTrigger = trigger;
      title.textContent = timeInput.labels[0]?.textContent || 'Chọn giờ';
      for (const option of options) option.setAttribute('aria-pressed', String(option.dataset.time === timeInput.value));
      timePicker.showModal();
      focusTime(options.find(option => option.dataset.time === timeInput.value) || options[0]);
    });
    timePicker.addEventListener('close', () => timeTrigger?.focus());
    times.addEventListener('click', event => {
      const option = event.target.closest('[data-time]');
      if (option) chooseValue(timeInput, option.dataset.time, timePicker);
    });
    times.addEventListener('keydown', event => {
      const index = options.indexOf(event.target);
      const offsets = { ArrowUp: -1, ArrowDown: 1, Home: -47, End: 47 };
      if (index < 0 || !Object.hasOwn(offsets, event.key)) return;
      event.preventDefault();
      focusTime(options[Math.min(options.length - 1, Math.max(0, index + offsets[event.key]))]);
    });
  }
}
