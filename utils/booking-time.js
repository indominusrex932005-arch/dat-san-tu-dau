const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function getVietnamDate(now = new Date()) {
  const parts = vietnamDate.formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function validBookingDate(date, now = new Date()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00+07:00`);
  return Number.isFinite(parsed.getTime())
    && getVietnamDate(parsed) === date
    && date >= getVietnamDate(now);
}

export function slotIsFuture(date, hour, now = new Date()) {
  if (!validBookingDate(date, now) || !Number.isInteger(hour) || hour < 6 || hour > 21) {
    return false;
  }
  const startsAt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+07:00`);
  return startsAt.getTime() > now.getTime();
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(`${date}T00:00:00+07:00`));
}
