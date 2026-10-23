export const SLOT_MINUTES = 30;
export const HOLD_MINUTES = 10;

export class RuleError extends Error {
  constructor(message) { super(message); this.name = 'RuleError'; this.status = 400; }
}

export function timeToMinutes(time) {
  if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[03]0$/.test(time)) {
    throw new RuleError('Giờ phải có dạng HH:00 hoặc HH:30.');
  }
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

export function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RuleError('Ngày không hợp lệ.');
  const parsed = new Date(date + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new RuleError('Ngày không tồn tại.');
  return date;
}

export function vietnamDate(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
}

export function slotInstant(date, time) {
  validateDate(date);
  timeToMinutes(time);
  return new Date(date + 'T' + time + ':00+07:00');
}

export function makeSlots(court, date, locks = [], now = new Date()) {
  validateDate(date);
  const open = timeToMinutes(court.openTime || '06:00');
  const close = timeToMinutes(court.closeTime || '22:00');
  const peakStart = timeToMinutes(court.peakStartTime || '17:00');
  const peakEnd = timeToMinutes(court.peakEndTime || '22:00');
  const basePrice = court.basePriceVND ?? Math.ceil((court.pricePerHour ?? 0) / 2);
  const peakPrice = court.peakPriceVND ?? basePrice;
  const slots = [];
  for (let start = open; start + SLOT_MINUTES <= close; start += SLOT_MINUTES) {
    const time = minutesToTime(start);
    const instant = slotInstant(date, time);
    const lock = locks.find(item => Number(new Date(item.slotStart)) === Number(instant)
      && (!item.expiresAt || Number(new Date(item.expiresAt)) > Number(now)));
    const status = instant <= now ? 'UNAVAILABLE' : lock ? (lock.expiresAt ? 'LOCKED' : 'BOOKED') : 'AVAILABLE';
    slots.push({ time, endTime: minutesToTime(start + SLOT_MINUTES), status,
      priceVND: start >= peakStart && start < peakEnd ? peakPrice : basePrice });
  }
  return slots;
}

export function quoteSelection(court, date, times, locks = [], now = new Date()) {
  if (!Array.isArray(times) || times.length === 0 || times.length > 48 || times.some(time => typeof time !== 'string')) {
    throw new RuleError('Hãy chọn từ 1 đến 48 ô giờ.');
  }
  if (new Set(times).size !== times.length) throw new RuleError('Không chọn một ô hai lần.');
  const available = makeSlots(court, date, locks, now);
  const selected = times.map(time => {
    const slot = available.find(item => item.time === time);
    if (!slot || slot.status !== 'AVAILABLE') throw new RuleError('Ô ' + time + ' không còn trống hoặc không hợp lệ.');
    return slot;
  }).sort((a, b) => a.time.localeCompare(b.time));
  const totalPriceVND = selected.reduce((total, slot) => total + slot.priceVND, 0);
  if (!Number.isSafeInteger(totalPriceVND) || totalPriceVND < 0) throw new RuleError('Giá sân không hợp lệ.');
  return { slots: selected, totalMinutes: selected.length * SLOT_MINUTES, totalPriceVND };
}

export function holdExpiresAt(createdAt) {
  return new Date(new Date(createdAt).getTime() + HOLD_MINUTES * 60000);
}
