import mongoose from 'mongoose';
import User from '../models/User.js';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import SlotLock from '../models/SlotLock.js';
import { RuleError, makeSlots, slotInstant, validateDate, vietnamDate } from '../domain/booking-rules.js';

function forbidden(message) {
  throw Object.assign(new Error(message), { status: 403 });
}

const dayLabel = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit'
});

export async function getOwnerCalendar(owner, query = {}, now = new Date()) {
  if (!owner || !mongoose.isObjectIdOrHexString(owner._id)) {
    forbidden('Cần tài khoản chủ sân đã được duyệt.');
  }
  // Recheck the database identity: a caller's stale role/status is not authority.
  const approvedOwner = await User.findOne({ _id: owner._id, role: 'OWNER', ownerStatus: 'APPROVED' })
    .select('_id').lean();
  if (!approvedOwner) forbidden('Cần tài khoản chủ sân đã được duyệt.');
  const facility = await Facility.findOne({ owner: approvedOwner._id }).select('_id name address phone').lean();
  if (!facility) forbidden('Tài khoản chưa được cấp cơ sở quản lý.');

  const today = vietnamDate(now);
  const selectedDate = query?.date === undefined ? today : query.date;
  if (Array.isArray(selectedDate)) throw new RuleError('Tham số ngày không được lặp lại.');
  validateDate(selectedDate);
  if (selectedDate < today) throw new RuleError('Ngày xem lịch không được trong quá khứ.');
  const todayStart = slotInstant(today, '00:00');
  const dayOptions = Array.from({ length: 7 }, (_, offset) => {
    const start = new Date(Number(todayStart) + offset * 86400000);
    const date = vietnamDate(start);
    return { date, label: dayLabel.format(start), isSelected: date === selectedDate };
  });

  const courts = await Court.find({ facility: facility._id }).select(
    '_id name active openTime closeTime peakStartTime peakEndTime basePriceVND peakPriceVND pricePerHour'
  ).sort({ name: 1, _id: 1 }).lean();
  const start = slotInstant(selectedDate, '00:00');
  // One bounded lock query for the whole facility/day, never one query per cell.
  const locks = courts.length ? await SlotLock.find({
    court: { $in: courts.map(court => court._id) },
    slotStart: { $gte: start, $lt: new Date(Number(start) + 86400000) }
  }).select('court slotStart expiresAt -_id').lean() : [];
  const locksByCourt = new Map();
  for (const lock of locks) {
    const id = String(lock.court);
    if (!locksByCourt.has(id)) locksByCourt.set(id, []);
    locksByCourt.get(id).push(lock);
  }

  const columns = new Map();
  const rows = courts.map(court => {
    const courtId = String(court._id);
    const slots = makeSlots(court, selectedDate, locksByCourt.get(courtId) || [], now);
    for (const { time, endTime } of slots) columns.set(time, { time, endTime });
    return { courtId, name: court.name, active: court.active !== false, byTime: new Map(slots.map(slot => [slot.time, slot])) };
  });
  const timeColumns = [...columns.values()].sort((a, b) => a.time.localeCompare(b.time));
  const courtRows = rows.map(({ courtId, name, active, byTime }) => ({
    courtId, name, active,
    slots: timeColumns.map(column => {
      const slot = byTime.get(column.time);
      if (!slot) return { ...column, status: 'UNAVAILABLE', priceVND: null };
      return { ...slot, status: active ? slot.status : 'UNAVAILABLE' };
    })
  }));
  return { facility, selectedDate, dayOptions, timeColumns, courtRows };
}
