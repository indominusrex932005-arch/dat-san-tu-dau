import SlotLock from '../models/SlotLock.js';
import { slotInstant } from '../domain/booking-rules.js';

export async function locksByCourtForDay(courts, date) {
  const start = slotInstant(date, '00:00');
  const locks = courts.length ? await SlotLock.find({
    court: { $in: courts.map(court => court._id) },
    slotStart: { $gte: start, $lt: new Date(Number(start) + 86400000) }
  }).lean() : [];
  const grouped = new Map();
  for (const lock of locks) {
    const id = String(lock.court);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(lock);
  }
  return grouped;
}
