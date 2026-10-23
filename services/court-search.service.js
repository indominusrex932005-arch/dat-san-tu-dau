import mongoose from 'mongoose';
import Court from '../models/Court.js';
import Facility from '../models/Facility.js';
import SlotLock from '../models/SlotLock.js';
import {
  SLOT_MINUTES,
  RuleError,
  timeToMinutes,
  validateDate,
  vietnamDate,
  slotInstant,
  makeSlots
} from '../domain/booking-rules.js';

function isFacilityReady(facility) {
  const phone = typeof facility?.phone === 'string'
    ? facility.phone.trim().replace(/[\s.-]/g, '').replace(/^\+84/, '0') : '';
  if (!facility?.owner || !/^0\d{9}$/.test(phone)) return false;
  const owner = facility.owner;
  return owner.role === 'OWNER' && owner.ownerStatus === 'APPROVED';
}

export async function searchCourts(query = {}, now = new Date()) {
  const rawFacilityId = typeof query.facilityId === 'string' ? query.facilityId.trim() : '';
  const rawDate = typeof query.date === 'string' ? query.date.trim() : '';
  const rawStartTime = typeof query.startTime === 'string' ? query.startTime.trim() : '';
  const rawEndTime = typeof query.endTime === 'string' ? query.endTime.trim() : '';

  const filters = {
    facilityId: rawFacilityId,
    date: rawDate,
    startTime: rawStartTime,
    endTime: rawEndTime
  };

  // 1. Kiểm tra tính hợp lệ của query
  if (rawFacilityId && !mongoose.isValidObjectId(rawFacilityId)) {
    throw new RuleError('Cơ sở không hợp lệ.');
  }

  const hasStart = rawStartTime !== '';
  const hasEnd = rawEndTime !== '';

  if ((hasStart && !hasEnd) || (!hasStart && hasEnd)) {
    throw new RuleError('Vui lòng chọn đầy đủ cả giờ bắt đầu và giờ kết thúc.');
  }

  if ((hasStart || hasEnd) && !rawDate) {
    throw new RuleError('Vui lòng chọn ngày khi tìm theo khoảng giờ.');
  }

  let startMin = 0;
  let endMin = 0;
  if (hasStart && hasEnd) {
    startMin = timeToMinutes(rawStartTime);
    endMin = timeToMinutes(rawEndTime);
    if (endMin <= startMin) {
      throw new RuleError('Giờ kết thúc phải sau giờ bắt đầu.');
    }
  }

  if (rawDate) {
    validateDate(rawDate);
    const todayVN = vietnamDate(now);
    if (rawDate < todayVN) {
      throw new RuleError('Ngày tìm kiếm không được trong quá khứ.');
    }
  }

  // 2. Lấy danh sách tất cả cơ sở để làm options cho select box
  const facilities = await Facility.find().sort({ name: 1 }).lean();

  // 3. Xây dựng truy vấn cơ bản cho Court
  const courtQuery = { active: true };
  if (rawFacilityId) {
    courtQuery.facility = rawFacilityId;
  }

  const candidates = await Court.find(courtQuery).populate({
    path: 'facility',
    populate: { path: 'owner', select: 'role ownerStatus' }
  }).sort({ name: 1 }).lean();

  // 4. Nếu không lọc theo ngày, trả về các sân đang active
  if (!rawDate) {
    return {
      courts: candidates,
      facilities,
      filters,
      filterError: null
    };
  }

  // 5. Nếu có lọc theo ngày (và tùy chọn khoảng giờ)
  const startOfDay = slotInstant(rawDate, '00:00');
  const nextDay = new Date(Number(startOfDay) + 24 * 3600000);

  const matchedCourts = [];

  for (const court of candidates) {
    // Chỉ nhận sân có cơ sở đủ điều kiện nhận đặt
    if (!isFacilityReady(court.facility)) {
      continue;
    }

    // Nếu có khoảng giờ, kiểm tra giờ phục vụ của sân
    if (hasStart && hasEnd) {
      const courtOpenMin = timeToMinutes(court.openTime || '06:00');
      const courtCloseMin = timeToMinutes(court.closeTime || '22:00');
      if (courtOpenMin > startMin || courtCloseMin < endMin) {
        continue;
      }
    }

    // Lấy các lock của sân trong ngày
    const locks = await SlotLock.find({
      court: court._id,
      slotStart: { $gte: startOfDay, $lt: nextDay }
    }).lean();

    const slots = makeSlots(court, rawDate, locks, now);

    if (hasStart && hasEnd) {
      // Khoảng giờ: tất cả các ô trong khoảng [startTime, endTime) phải AVAILABLE
      const expectedCount = (endMin - startMin) / SLOT_MINUTES;
      const targetSlots = slots.filter(s => {
        const sMin = timeToMinutes(s.time);
        const eMin = timeToMinutes(s.endTime);
        return sMin >= startMin && eMin <= endMin;
      });

      if (targetSlots.length === expectedCount && targetSlots.every(s => s.status === 'AVAILABLE')) {
        matchedCourts.push(court);
      }
    } else {
      // Chỉ có ngày: có ít nhất một ô AVAILABLE trong ngày
      if (slots.some(s => s.status === 'AVAILABLE')) {
        matchedCourts.push(court);
      }
    }
  }

  return {
    courts: matchedCourts,
    facilities,
    filters,
    filterError: null
  };
}
