import mongoose from 'mongoose';
import Court from '../models/Court.js';
import SlotLock from '../models/SlotLock.js';
import {
  SLOT_MINUTES,
  RuleError,
  timeToMinutes,
  validateDate,
  vietnamDate,
  slotInstant,
  makeSlots,
  quoteSelection
} from '../domain/booking-rules.js';
import { isFacilityReady } from './court-search.service.js';

export async function suggestCourts(query = {}, now = new Date(), options = {}) {
  if (!query || typeof query !== 'object') query = {};

  for (const key of ['facilityId', 'date', 'startTime', 'endTime']) {
    if (Array.isArray(query[key])) {
      throw new RuleError('Tham số tìm kiếm không được lặp lại.');
    }
  }

  const rawFacilityId = typeof query.facilityId === 'string' ? query.facilityId.trim() : '';
  const rawDate = typeof query.date === 'string' ? query.date.trim() : '';
  const rawStartTime = typeof query.startTime === 'string' ? query.startTime.trim() : '';
  const rawEndTime = typeof query.endTime === 'string' ? query.endTime.trim() : '';

  if (rawFacilityId && !mongoose.isValidObjectId(rawFacilityId)) {
    throw new RuleError('Cơ sở không hợp lệ.');
  }

  if (!rawDate) {
    throw new RuleError('Vui lòng chọn ngày khi tìm kiếm gợi ý.');
  }

  validateDate(rawDate);
  const todayVN = vietnamDate(now);
  if (rawDate < todayVN) {
    throw new RuleError('Ngày tìm kiếm không được trong quá khứ.');
  }

  if (!rawStartTime || !rawEndTime) {
    throw new RuleError('Vui lòng chọn đầy đủ cả giờ bắt đầu và giờ kết thúc.');
  }

  const reqStartMin = timeToMinutes(rawStartTime);
  const reqEndMin = timeToMinutes(rawEndTime);
  if (reqEndMin <= reqStartMin) {
    throw new RuleError('Giờ kết thúc phải sau giờ bắt đầu.');
  }

  const durationMin = reqEndMin - reqStartMin;
  const numSlots = durationMin / SLOT_MINUTES;

  // Lấy danh sách sân ứng viên nếu chưa được truyền qua options
  let candidates = options.candidates;
  if (!candidates) {
    const courtQuery = { active: true };
    if (rawFacilityId) {
      courtQuery.facility = rawFacilityId;
    }
    candidates = await Court.find(courtQuery).populate({
      path: 'facility',
      populate: { path: 'owner', select: 'role ownerStatus' }
    }).sort({ name: 1 }).lean();
  }

  const startOfDay = slotInstant(rawDate, '00:00');
  const nextDay = new Date(Number(startOfDay) + 24 * 3600000);

  const candidateWindows = [];

  for (const court of candidates) {
    if (!court.active) {
      continue;
    }

    if (!isFacilityReady(court.facility)) {
      continue;
    }

    // Nếu người dùng đã chọn facilityId, bảo đảm sân đúng cơ sở đó
    if (rawFacilityId) {
      const facId = court.facility?._id ? String(court.facility._id) : String(court.facility);
      if (!new mongoose.Types.ObjectId(rawFacilityId).equals(facId)) {
        continue;
      }
    }

    const courtOpenMin = timeToMinutes(court.openTime || '06:00');
    const courtCloseMin = timeToMinutes(court.closeTime || '22:00');

    if (courtCloseMin - courtOpenMin < durationMin) {
      continue;
    }

    // Lấy locks trong ngày cho sân một lần duy nhất
    const locks = await SlotLock.find({
      court: court._id,
      slotStart: { $gte: startOfDay, $lt: nextDay }
    }).lean();

    const slots = makeSlots(court, rawDate, locks, now);

    // Duyệt cửa sổ trượt có kích thước numSlots
    for (let i = 0; i <= slots.length - numSlots; i++) {
      const windowSlots = slots.slice(i, i + numSlots);

      // Toàn bộ các ô trong cửa sổ phải AVAILABLE (không trùng quá khứ, BOOKED, HOLD còn hạn)
      if (!windowSlots.every(s => s.status === 'AVAILABLE')) {
        continue;
      }

      const candStartMin = timeToMinutes(windowSlots[0].time);
      const candEndMin = timeToMinutes(windowSlots[windowSlots.length - 1].endTime);

      // Bảo đảm tính liên tục và không vượt nửa đêm
      if (candEndMin - candStartMin !== durationMin) {
        continue;
      }
      if (candEndMin > 24 * 60) {
        continue;
      }

      // Giờ phục vụ
      if (candStartMin < courtOpenMin || candEndMin > courtCloseMin) {
        continue;
      }

      const times = windowSlots.map(s => s.time);
      const quote = quoteSelection(court, rawDate, times, locks, now);
      const totalPriceVND = quote.totalPriceVND;
      const startOffsetMinutes = candStartMin - reqStartMin;

      const prefix = rawFacilityId ? 'Cùng cơ sở, ' : `Cơ sở ${court.facility?.name || ''}, `;
      let reason;
      if (startOffsetMinutes > 0) {
        reason = `${prefix}muộn hơn ${startOffsetMinutes} phút`;
      } else if (startOffsetMinutes < 0) {
        reason = `${prefix}sớm hơn ${Math.abs(startOffsetMinutes)} phút`;
      } else {
        reason = `${prefix}cùng khung giờ`;
      }

      candidateWindows.push({
        courtId: String(court._id),
        courtName: court.name,
        facilityName: court.facility?.name || '',
        date: rawDate,
        startTime: windowSlots[0].time,
        endTime: windowSlots[windowSlots.length - 1].endTime,
        totalMinutes: durationMin,
        totalPriceVND,
        startOffsetMinutes,
        reason
      });
    }
  }

  // Xếp hạng:
  // 1. Độ lệch tuyệt đối của giờ bắt đầu tăng dần
  // 2. Tổng giá tăng dần
  // 3. courtId ổn định
  // 4. startTime ổn định
  candidateWindows.sort((a, b) => {
    const absDiff = Math.abs(a.startOffsetMinutes) - Math.abs(b.startOffsetMinutes);
    if (absDiff !== 0) return absDiff;

    const priceDiff = a.totalPriceVND - b.totalPriceVND;
    if (priceDiff !== 0) return priceDiff;

    const courtDiff = String(a.courtId).localeCompare(String(b.courtId));
    if (courtDiff !== 0) return courtDiff;

    return a.startTime.localeCompare(b.startTime);
  });

  // Khử trùng theo courtId / date / startTime, lấy tối đa 3
  const seen = new Set();
  const suggestions = [];
  for (const item of candidateWindows) {
    const key = `${item.courtId}_${item.date}_${item.startTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push(item);
    if (suggestions.length === 3) break;
  }

  const suggestionMessage = suggestions.length > 0
    ? 'Khung giờ bạn tìm hiện đã kín. Dưới đây là các gợi ý thay thế gần nhất cùng thời lượng:'
    : 'Không tìm thấy phương án thay thế phù hợp cùng thời lượng trong ngày. Bạn vui lòng đổi ngày hoặc chọn khoảng giờ khác.';

  return { suggestions, suggestionMessage };
}
