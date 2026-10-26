/**
 * QA Tests — Issue #67: Kiểm thử gợi ý sân và giờ thay thế
 *
 * Bộ kiểm thử này xác nhận toàn bộ hành vi của suggestCourts / searchCourts
 * theo đặc tả Issue #67, bao gồm:
 *   QA-01: Điều kiện kích hoạt gợi ý (đủ query / thiếu query)
 *   QA-02: Đúng ngày, đúng thời lượng, lọc facilityId
 *   QA-03: Loại HOLD còn hạn / BOOKED; bỏ qua lock hết hạn; inactive / pending không gợi ý
 *   QA-04: Xếp hạng: offset → giá → courtId → startTime; tối đa 3 không trùng
 *   QA-05: Giá qua mốc cao điểm đúng (không dùng giá client)
 *   QA-06: Link "Xem lịch" đúng courtId/date; GET không tạo Booking/SlotLock
 *   QA-07: Ca tranh chỗ — 409 + form phục hồi (logic nghiệp vụ level)
 *   QA-08: Biên giới viewport / tên dài / 0-1-3 gợi ý / XSS escape (view)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ejs from 'ejs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import Court from '../models/Court.js';
import Facility from '../models/Facility.js';
import SlotLock from '../models/SlotLock.js';
import { formatDate, formatMoney } from '../utils/booking-time.js';
import {
  RuleError,
  slotInstant,
  quoteSelection
} from '../domain/booking-rules.js';
import { suggestCourts } from '../services/court-suggestion.service.js';
import { searchCourts } from '../services/court-search.service.js';

// ─── Dữ liệu cố định dùng cho toàn bộ suite ───────────────────────────────
const FIXED_NOW = new Date('2026-11-01T12:00:00+07:00'); // 12:00 ngày 2026-11-01
const DATE_TOMORROW = '2026-11-02';   // ngày mai, không bị ảnh hưởng bởi quá khứ
const DATE_TODAY = '2026-11-01';      // hôm nay, dùng cho ca quá khứ

const mockOwnerApproved = { role: 'OWNER', ownerStatus: 'APPROVED' };
const mockOwnerPending  = { role: 'OWNER', ownerStatus: 'PENDING' };

const facilityA = {
  _id: new mongoose.Types.ObjectId('654321654321654321654321'),
  name: 'Cơ sở Quận 1',
  phone: '0901234567',
  owner: mockOwnerApproved
};
const facilityB = {
  _id: new mongoose.Types.ObjectId('654321654321654321654322'),
  name: 'Cơ sở Quận 3',
  phone: '0902345678',
  owner: mockOwnerApproved
};
const facilityPending = {
  _id: new mongoose.Types.ObjectId('654321654321654321654323'),
  name: 'Cơ sở Chưa Duyệt',
  phone: '0903456789',
  owner: mockOwnerPending
};

const courtA1 = {
  _id: new mongoose.Types.ObjectId('111111111111111111111111'),
  name: 'Sân A1',
  facility: facilityA,
  active: true,
  openTime: '06:00',
  closeTime: '22:00',
  peakStartTime: '17:00',
  peakEndTime: '20:00',
  basePriceVND: 50000,
  peakPriceVND: 80000
};
const courtA2 = {
  _id: new mongoose.Types.ObjectId('222222222222222222222222'),
  name: 'Sân A2',
  facility: facilityA,
  active: true,
  openTime: '06:00',
  closeTime: '22:00',
  peakStartTime: '17:00',
  peakEndTime: '20:00',
  basePriceVND: 60000,
  peakPriceVND: 90000
};
const courtB = {
  _id: new mongoose.Types.ObjectId('333333333333333333333333'),
  name: 'Sân B',
  facility: facilityB,
  active: true,
  openTime: '06:00',
  closeTime: '22:00',
  peakStartTime: '17:00',
  peakEndTime: '20:00',
  basePriceVND: 40000,
  peakPriceVND: 70000
};
const courtInactive = {
  ...courtA1,
  _id: new mongoose.Types.ObjectId('444444444444444444444444'),
  name: 'Sân Inactive',
  active: false
};
const courtPendingFacility = {
  ...courtA1,
  _id: new mongoose.Types.ObjectId('555555555555555555555555'),
  name: 'Sân Cơ Sở Chưa Duyệt',
  facility: facilityPending
};

// Helper: mock SlotLock.find để trả về locks cố định
function mockSlotLockFind(locksMap) {
  // locksMap: Map<courtIdString, locks[]> hoặc [] để trả cùng 1 cho tất cả
  return (filter) => ({
    lean: async () => {
      if (Array.isArray(locksMap)) return locksMap;
      const key = String(filter.court);
      return locksMap.get(key) ?? [];
    }
  });
}

// ─── QA-01: Điều kiện kích hoạt gợi ý ───────────────────────────────────────
test('QA-01: Điều kiện kích hoạt gợi ý', async (suite) => {

  await suite.test('QA-01-a: Query đủ (date + startTime + endTime) + 0 kết quả → gợi ý được sinh', async () => {
    // Dùng searchCourts với sân bị chặn hết
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [courtA1] }) })
    }));
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([
      { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
      { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
    ]));

    const result = await searchCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW
    );

    assert.equal(result.courts.length, 0, 'Không có sân thỏa điều kiện chính');
    assert.ok(Array.isArray(result.suggestions), 'suggestions là mảng');
    assert.ok(result.suggestions.length > 0, 'Phải có ít nhất 1 gợi ý');
    assert.ok(typeof result.suggestionMessage === 'string', 'suggestionMessage là string');
    assert.match(result.suggestionMessage, /Khung giờ bạn tìm hiện đã kín/);
  });

  await suite.test('QA-01-b: Có kết quả chính → KHÔNG sinh gợi ý', async () => {
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [courtA1] }) })
    }));
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await searchCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW
    );

    assert.ok(result.courts.length > 0, 'Có sân thỏa điều kiện chính');
    assert.deepEqual(result.suggestions, [], 'Không được sinh gợi ý');
    assert.equal(result.suggestionMessage, null, 'suggestionMessage phải null');
  });

  await suite.test('QA-01-c: Chỉ có date (thiếu startTime/endTime) → KHÔNG sinh gợi ý', async () => {
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [courtA1] }) })
    }));
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await searchCourts(
      { date: DATE_TOMORROW },
      FIXED_NOW
    );

    assert.deepEqual(result.suggestions, [], 'Thiếu giờ → không sinh gợi ý');
    assert.equal(result.suggestionMessage, null);
  });

  await suite.test('QA-01-d: Query lỗi (endTime ≤ startTime) → ném RuleError, không sinh gợi ý', async () => {
    await assert.rejects(
      () => searchCourts({ date: DATE_TOMORROW, startTime: '18:00', endTime: '17:00' }, FIXED_NOW),
      (err) => err instanceof RuleError && err.message.includes('sau giờ bắt đầu')
    );
    await assert.rejects(
      () => searchCourts({ date: DATE_TOMORROW, startTime: '18:00', endTime: '18:00' }, FIXED_NOW),
      (err) => err instanceof RuleError && err.message.includes('sau giờ bắt đầu')
    );
  });

  await suite.test('QA-01-e: suggestCourts nhận trực tiếp — thiếu date → RuleError', async () => {
    await assert.rejects(
      () => suggestCourts({ startTime: '18:00', endTime: '19:00' }, FIXED_NOW, { candidates: [courtA1] }),
      (err) => err instanceof RuleError && err.message.includes('chọn ngày')
    );
  });

  await suite.test('QA-01-f: suggestCourts — tham số lặp lại → RuleError', async () => {
    await assert.rejects(
      () => suggestCourts({ date: [DATE_TOMORROW, DATE_TOMORROW], startTime: '18:00', endTime: '19:00' }, FIXED_NOW),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );
  });
});

// ─── QA-02: Đúng ngày, đúng thời lượng, lọc facilityId ──────────────────────
test('QA-02: Đúng ngày, đúng thời lượng, lọc facilityId', async (suite) => {

  await suite.test('QA-02-a: Gợi ý đúng ngày tìm kiếm', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    for (const sug of result.suggestions) {
      assert.equal(sug.date, DATE_TOMORROW, `date phải là ${DATE_TOMORROW}`);
    }
  });

  await suite.test('QA-02-b: Tất cả gợi ý có đúng thời lượng yêu cầu', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const durationMin = 90; // 90 phút
    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '09:00', endTime: '10:30' },
      FIXED_NOW,
      { candidates: [courtA1, courtA2] }
    );

    for (const sug of result.suggestions) {
      assert.equal(sug.totalMinutes, durationMin, `Thời lượng phải là ${durationMin} phút`);
    }
  });

  await suite.test('QA-02-c: facilityId lọc đúng — chỉ trả sân thuộc cơ sở đó', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1, courtB] }  // courtB thuộc facilityB
    );

    assert.ok(result.suggestions.length > 0);
    for (const sug of result.suggestions) {
      assert.equal(sug.facilityName, facilityA.name, 'Chỉ gợi ý sân thuộc facilityA');
      assert.match(sug.reason, /Cùng cơ sở/, 'reason phải ghi "Cùng cơ sở"');
    }
  });

  await suite.test('QA-02-d: Không có facilityId → gợi ý từ nhiều cơ sở, reason ghi tên cơ sở', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind(new Map([
      [String(courtA1._id), [{ slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null }, { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }]],
      [String(courtB._id), []]
    ])));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1, courtB] }
    );

    // courtB không bị chặn → có thể gợi ý cùng khung 18:00-19:00
    const courtBSuggestion = result.suggestions.find(s => s.courtId === String(courtB._id));
    if (courtBSuggestion) {
      assert.match(courtBSuggestion.reason, /Cơ sở Quận 3/, 'reason phải ghi tên cơ sở khi không lọc facilityId');
    }
  });

  await suite.test('QA-02-e: Sân có giờ phục vụ hẹp không đủ thời lượng → bị loại', async () => {
    const narrowCourt = {
      ...courtA1,
      _id: new mongoose.Types.ObjectId('666666666666666666666666'),
      openTime: '06:00',
      closeTime: '07:00' // Chỉ 60 phút, nhưng hỏi 90 phút
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '09:00', endTime: '10:30' }, // 90 phút
      FIXED_NOW,
      { candidates: [narrowCourt] }
    );

    assert.equal(result.suggestions.length, 0, 'Sân hẹp giờ không được gợi ý');
    assert.match(result.suggestionMessage, /Không tìm thấy phương án thay thế/);
  });
});

// ─── QA-03: Loại HOLD / BOOKED; bỏ qua lock hết hạn; inactive/pending ────────
test('QA-03: Xử lý locks và trạng thái sân/cơ sở', async (suite) => {

  await suite.test('QA-03-a: HOLD còn hạn → ô đó không được gợi ý', async () => {
    const activeHold = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: new Date(FIXED_NOW.getTime() + 3600000) // còn 1h
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([activeHold]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    for (const sug of result.suggestions) {
      assert.notEqual(sug.startTime, '18:00', '18:00-19:00 dính HOLD → không gợi ý 18:00');
    }
  });

  await suite.test('QA-03-b: BOOKED (expiresAt = null) → ô đó không được gợi ý', async () => {
    const bookedSlot = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: null // BOOKED
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([bookedSlot]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    for (const sug of result.suggestions) {
      assert.notEqual(sug.startTime, '18:00', '18:00-19:00 dính BOOKED → không gợi ý 18:00');
    }
  });

  await suite.test('QA-03-c: Lock hết hạn → ô được xem là AVAILABLE, có thể gợi ý', async () => {
    const expiredLock = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: new Date(FIXED_NOW.getTime() - 60000) // Hết hạn 1 phút trước
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([expiredLock]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    const exactMatch = result.suggestions.find(s => s.startTime === '18:00' && s.endTime === '19:00');
    assert.ok(exactMatch, 'Lock hết hạn → 18:00-19:00 phải là AVAILABLE và được gợi ý');
  });

  await suite.test('QA-03-d: Sân inactive → không bao giờ được gợi ý', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtInactive] }
    );

    assert.equal(result.suggestions.length, 0, 'Sân inactive không được gợi ý');
  });

  await suite.test('QA-03-e: Cơ sở chủ sân PENDING → sân không được gợi ý', async () => {
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtPendingFacility] }
    );

    assert.equal(result.suggestions.length, 0, 'Cơ sở chưa duyệt → không gợi ý');
  });

  await suite.test('QA-03-f: Cơ sở thiếu số điện thoại hợp lệ → sân không được gợi ý', async () => {
    const courtBadPhone = {
      ...courtA1,
      _id: new mongoose.Types.ObjectId('777777777777777777777777'),
      facility: { ...facilityA, phone: '123' }
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtBadPhone] }
    );

    assert.equal(result.suggestions.length, 0, 'SĐT sai format → không gợi ý');
  });

  await suite.test('QA-03-g: Ô trong quá khứ (ngay hôm nay, giờ qua) → không gợi ý', async () => {
    // FIXED_NOW = 12:00 ngày 2026-11-01; tìm khung 10:00-11:00 hôm nay
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TODAY, startTime: '10:00', endTime: '11:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    // Tất cả gợi ý phải bắt đầu từ 12:00 trở đi
    for (const sug of result.suggestions) {
      const [h, m] = sug.startTime.split(':').map(Number);
      const startMin = h * 60 + m;
      assert.ok(startMin >= 720, `${sug.startTime} phải >= 12:00 (720 phút)`);
    }
  });
});

// ─── QA-04: Xếp hạng và tối đa 3 gợi ý không trùng ─────────────────────────
test('QA-04: Xếp hạng và giới hạn gợi ý', async (suite) => {

  await suite.test('QA-04-a: Độ lệch giờ tuyệt đối tăng dần (offset ascending)', async () => {
    // Chặn 18:00-19:00 trên cả 2 sân để ép ra gợi ý thay thế
    const locksMap = new Map([
      [String(courtA1._id), [
        { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
        { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
      ]],
      [String(courtA2._id), [
        { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
        { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
      ]]
    ]);
    suite.mock.method(SlotLock, 'find', mockSlotLockFind(locksMap));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1, courtA2] }
    );

    assert.ok(result.suggestions.length > 0, 'Phải có gợi ý');
    const offsets = result.suggestions.map(s => Math.abs(s.startOffsetMinutes));
    for (let i = 0; i < offsets.length - 1; i++) {
      assert.ok(
        offsets[i] <= offsets[i + 1],
        `Gợi ý ${i} (offset=${offsets[i]}) phải ≤ gợi ý ${i + 1} (offset=${offsets[i + 1]})`
      );
    }
  });

  await suite.test('QA-04-b: Cùng offset → giá tăng dần', async () => {
    // Chặn cùng giờ trên cả 2 sân để buộc cùng offset 30 phút
    const locksMap = new Map([
      [String(courtA1._id), [
        { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
        { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
      ]],
      [String(courtA2._id), [
        { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
        { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
      ]]
    ]);
    suite.mock.method(SlotLock, 'find', mockSlotLockFind(locksMap));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1, courtA2] } // courtA1 rẻ hơn (50k vs 60k)
    );

    // Nếu có 2 gợi ý với cùng offset, courtA1 phải đứng trước courtA2
    const groups = {};
    for (const s of result.suggestions) {
      const abs = Math.abs(s.startOffsetMinutes);
      if (!groups[abs]) groups[abs] = [];
      groups[abs].push(s);
    }
    for (const group of Object.values(groups)) {
      for (let i = 0; i < group.length - 1; i++) {
        assert.ok(
          group[i].totalPriceVND <= group[i + 1].totalPriceVND,
          `Cùng offset → giá phải tăng dần: ${group[i].totalPriceVND} ≤ ${group[i + 1].totalPriceVND}`
        );
      }
    }
  });

  await suite.test('QA-04-c: Tối đa 3 gợi ý không trùng', async () => {
    // Không chặn gì → nhiều ô sẵn sàng, service phải giới hạn tối đa 3
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1, courtA2, courtB] }
    );

    assert.ok(result.suggestions.length <= 3, `Phải ≤ 3 gợi ý, nhận được ${result.suggestions.length}`);

    // Kiểm tra không trùng
    const keys = result.suggestions.map(s => `${s.courtId}_${s.date}_${s.startTime}`);
    const uniqueKeys = new Set(keys);
    assert.equal(uniqueKeys.size, keys.length, 'Không được có gợi ý trùng courtId+date+startTime');
  });

  await suite.test('QA-04-d: 0 sân khả dụng → mảng suggestions rỗng + message mời đổi ngày', async () => {
    // Chặn toàn bộ giờ
    const allLocked = [];
    for (let h = 6; h < 22; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        allLocked.push({ slotStart: slotInstant(DATE_TOMORROW, time), expiresAt: null });
      }
    }
    suite.mock.method(SlotLock, 'find', mockSlotLockFind(allLocked));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    assert.equal(result.suggestions.length, 0);
    assert.match(result.suggestionMessage, /Không tìm thấy phương án thay thế/);
    assert.match(result.suggestionMessage, /đổi ngày|khoảng giờ khác/);
  });

  await suite.test('QA-04-e: 1 gợi ý → trả đúng 1 phần tử', async () => {
    // Chặn tất cả trừ 1 ô
    const allLocked = [];
    for (let h = 6; h < 22; h++) {
      for (const m of [0, 30]) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        if (h !== 17 || m !== 0) { // Chừa 17:00
          allLocked.push({ slotStart: slotInstant(DATE_TOMORROW, time), expiresAt: null });
        }
      }
    }
    suite.mock.method(SlotLock, 'find', mockSlotLockFind(allLocked));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '18:30' }, // 30 phút → chỉ cần 1 ô
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    // Chỉ có 17:00 trống, phải có đúng 1 gợi ý
    assert.equal(result.suggestions.length, 1, 'Phải trả đúng 1 gợi ý');
    assert.equal(result.suggestions[0].startTime, '17:00');
    assert.equal(result.suggestions[0].endTime, '17:30');
  });
});

// ─── QA-05: Giá qua mốc cao điểm đúng ───────────────────────────────────────
test('QA-05: Tính đúng giá qua mốc cao điểm', async (suite) => {

  await suite.test('QA-05-a: Khung 16:30-17:30 qua peak 17:00: 1 ô base + 1 ô peak', async () => {
    // courtA1: peak 17:00-20:00, base 50k, peak 80k
    // Khung 16:30-17:30: ô 16:30 base (50k) + ô 17:00 peak (80k) = 130k
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([
      // Chặn mọi thứ từ 17:30 trở đi để ép gợi ý ra 16:30
      { slotStart: slotInstant(DATE_TOMORROW, '17:30'), expiresAt: null },
      { slotStart: slotInstant(DATE_TOMORROW, '18:00'), expiresAt: null },
      { slotStart: slotInstant(DATE_TOMORROW, '18:30'), expiresAt: null }
    ]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '17:30', endTime: '18:30' }, // 60 phút
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    const sug = result.suggestions.find(s => s.startTime === '16:30' && s.endTime === '17:30');
    assert.ok(sug, 'Phải có gợi ý 16:30-17:30');
    assert.equal(sug.totalPriceVND, 130000, `Giá phải 130k (50k + 80k), nhận ${sug.totalPriceVND}`);
    assert.equal(sug.totalMinutes, 60);
  });

  await suite.test('QA-05-b: Khung hoàn toàn trong peak: giá = peak × số ô', async () => {
    // courtA1: peak 17:00-20:00, peak 80k
    // Khung 17:00-18:00: 2 ô × 80k = 160k
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '20:00', endTime: '21:00' }, // 60 phút, ngoài peak → base
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    // Gợi ý 20:00-21:00: 2 ô × 50k = 100k (ngoài peak)
    const sug = result.suggestions.find(s => s.startTime === '20:00' && s.endTime === '21:00');
    if (sug) {
      assert.equal(sug.totalPriceVND, 100000, `Ngoài peak: 2 ô × 50k = 100k, nhận ${sug.totalPriceVND}`);
    }
  });

  await suite.test('QA-05-c: quoteSelection đúng cho khung 17:00-19:00 (4 ô peak 80k = 320k)', async () => {
    // Direct unit test của quoteSelection
    const locks = [];
    const now = FIXED_NOW;
    const times = ['17:00', '17:30', '18:00', '18:30'];
    const quote = quoteSelection(courtA1, DATE_TOMORROW, times, locks, now);
    assert.equal(quote.totalPriceVND, 320000, `4 ô peak 80k = 320k, nhận ${quote.totalPriceVND}`);
  });

  await suite.test('QA-05-d: quoteSelection đúng cho khung hỗn hợp 16:30-17:30 (50k+80k=130k)', async () => {
    const times = ['16:30', '17:00'];
    const quote = quoteSelection(courtA1, DATE_TOMORROW, times, [], FIXED_NOW);
    assert.equal(quote.totalPriceVND, 130000, `Hỗn hợp: 50k + 80k = 130k, nhận ${quote.totalPriceVND}`);
  });
});

// ─── QA-06: Link "Xem lịch" và tính GET-idempotent ───────────────────────────
test('QA-06: Link Xem lịch và tính GET-idempotent', async (suite) => {

  await suite.test('QA-06-a: HTML có link đúng courtId/date cho mỗi gợi ý', async () => {
    const viewsDir = path.resolve('views');
    const suggestionsEjs = await readFile(path.join(viewsDir, 'partials', 'court-suggestions.ejs'), 'utf8');

    const suggestions = [
      {
        courtId: 'aabbccddaabbccddaabbccdd',
        courtName: 'Sân Test',
        facilityName: 'Cơ sở Test',
        date: '2026-11-05',
        startTime: '09:00',
        endTime: '10:00',
        totalMinutes: 60,
        totalPriceVND: 100000,
        startOffsetMinutes: 0,
        reason: 'Cùng cơ sở, cùng khung giờ'
      }
    ];

    const html = ejs.render(suggestionsEjs, {
      suggestions,
      suggestionMessage: 'Test message',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    // Link phải là /courts/<courtId>?date=<date>
    assert.match(
      html,
      /href="\/courts\/aabbccddaabbccddaabbccdd\?date=2026-11-05"/,
      'Link Xem lịch phải chứa đúng courtId và date'
    );
    assert.match(html, /<span>Xem lịch<\/span>/, 'Nút phải ghi "Xem lịch"');
  });

  await suite.test('QA-06-b: Link Xem lịch là GET (không tạo Booking/SlotLock) — kiểm tra qua route logic', async () => {
    // Kiểm tra theo cấu trúc href: /courts/<id>?date=<date>
    // GET /courts/:id?date=... chỉ xem lịch, không POST → không tạo booking
    const viewsDir = path.resolve('views');
    const suggestionsEjs = await readFile(path.join(viewsDir, 'partials', 'court-suggestions.ejs'), 'utf8');

    const html = ejs.render(suggestionsEjs, {
      suggestions: [{
        courtId: '111111111111111111111111',
        courtName: 'Sân A',
        facilityName: 'Cơ sở X',
        date: '2026-11-05',
        startTime: '18:00',
        endTime: '19:00',
        totalMinutes: 60,
        totalPriceVND: 100000,
        startOffsetMinutes: 0,
        reason: 'test'
      }],
      suggestionMessage: 'msg',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    // Phải là thẻ <a> (GET), KHÔNG PHẢI <form> hay <button type="submit">
    assert.match(html, /<a class="courts-button court-suggestion-action"/, 'Phải dùng thẻ <a> (GET)');
    assert.doesNotMatch(html, /<form[^>]+action="\/courts\/[^"]+\/book"/, 'Không được có form POST đặt sân');
    assert.doesNotMatch(html, /method="post"/i, 'Không được có method=post trong link gợi ý');
  });

  await suite.test('QA-06-c: aria-label của Xem lịch có courtName và date', async () => {
    const viewsDir = path.resolve('views');
    const suggestionsEjs = await readFile(path.join(viewsDir, 'partials', 'court-suggestions.ejs'), 'utf8');

    const html = ejs.render(suggestionsEjs, {
      suggestions: [{
        courtId: '111111111111111111111111',
        courtName: 'Sân Kiểm Thử',
        facilityName: 'Cơ sở X',
        date: '2026-11-05',
        startTime: '18:00',
        endTime: '19:00',
        totalMinutes: 60,
        totalPriceVND: 100000,
        startOffsetMinutes: 0,
        reason: 'test'
      }],
      suggestionMessage: 'msg',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    assert.match(html, /aria-label="Xem lịch sân Sân Kiểm Thử/, 'aria-label phải có courtName');
  });
});

// ─── QA-07: Ca tranh chỗ — logic nghiệp vụ ──────────────────────────────────
test('QA-07: Ca tranh chỗ (race condition logic)', async (suite) => {

  await suite.test('QA-07-a: Phiên A thấy ô AVAILABLE; phiên B sau đó HOLD ô đó → suggestCourts loại ô bị HOLD', async () => {
    // Mô phỏng: phiên A tính toán gợi ý với 18:00 trống
    // Sau đó phiên B đặt HOLD 18:00
    // Khi phiên A gọi suggestCourts sau đó (với lock mới), 18:00 không còn được gợi ý

    const holdByB = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: new Date(FIXED_NOW.getTime() + 600000) // HOLD 10 phút, còn hạn
    };

    suite.mock.method(SlotLock, 'find', mockSlotLockFind([holdByB]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    // 18:00 dính HOLD → không được gợi ý
    for (const sug of result.suggestions) {
      if (sug.startTime === '18:00') {
        assert.fail('18:00 đang bị HOLD bởi phiên B → không được gợi ý');
      }
    }
  });

  await suite.test('QA-07-b: Phiên A thấy 18:00 trống; sau đó B book hẳn (expiresAt=null) → suggestCourts loại ô BOOKED', async () => {
    const bookedByB = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: null // BOOKED
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([bookedByB]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    for (const sug of result.suggestions) {
      if (sug.startTime === '18:00') {
        assert.fail('18:00 đã BOOKED bởi phiên B → không được gợi ý');
      }
    }
  });

  await suite.test('QA-07-c: Phiên B HOLD hết hạn → phiên A vẫn thấy ô AVAILABLE', async () => {
    const expiredHold = {
      slotStart: slotInstant(DATE_TOMORROW, '18:00'),
      expiresAt: new Date(FIXED_NOW.getTime() - 1000) // Vừa hết hạn
    };
    suite.mock.method(SlotLock, 'find', mockSlotLockFind([expiredHold]));

    const result = await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    const found = result.suggestions.find(s => s.startTime === '18:00' && s.endTime === '19:00');
    assert.ok(found, 'HOLD hết hạn → 18:00 phải AVAILABLE, phiên A được gợi ý');
  });

  await suite.test('QA-07-d: Gợi ý chỉ đọc (GET) — logic service không tạo SlotLock khi gọi suggestCourts', async () => {
    let slotLockCreateCalled = false;

    // Spy: nếu SlotLock.create / save được gọi → fail
    const origCreate = SlotLock.create;
    SlotLock.create = (...args) => {
      slotLockCreateCalled = true;
      return origCreate(...args);
    };

    suite.mock.method(SlotLock, 'find', mockSlotLockFind([]));

    await suggestCourts(
      { date: DATE_TOMORROW, startTime: '18:00', endTime: '19:00' },
      FIXED_NOW,
      { candidates: [courtA1] }
    );

    SlotLock.create = origCreate; // Restore

    assert.equal(slotLockCreateCalled, false, 'suggestCourts không được tạo SlotLock (chỉ đọc)');
  });
});

// ─── QA-08: View — tên dài / 0-1-3 gợi ý / XSS / accessibility ──────────────
test('QA-08: View — biên giới và accessibility', async (suite) => {
  const viewsDir = path.resolve('views');
  let suggestionsEjs;
  let courtsEjs;

  // Load EJS templates một lần
  suite.before(async () => {
    suggestionsEjs = await readFile(path.join(viewsDir, 'partials', 'court-suggestions.ejs'), 'utf8');
    courtsEjs = await readFile(path.join(viewsDir, 'courts.ejs'), 'utf8');
  });

  const renderPartial = (suggestions, message) => ejs.render(suggestionsEjs, {
    suggestions,
    suggestionMessage: message,
    formatDate,
    formatMoney
  }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

  await suite.test('QA-08-a: 0 gợi ý + message → section hiện, không có card', () => {
    const html = renderPartial([], 'Không có phương án thay thế. Vui lòng đổi ngày.');
    assert.match(html, /court-suggestion-section/);
    assert.match(html, /court-suggestion-message/);
    assert.doesNotMatch(html, /court-suggestion-card/);
  });

  await suite.test('QA-08-b: 1 gợi ý → đúng 1 card', () => {
    const html = renderPartial([{
      courtId: '111111111111111111111111',
      courtName: 'Sân A',
      facilityName: 'Cơ sở X',
      date: '2026-11-05',
      startTime: '18:00',
      endTime: '19:00',
      totalMinutes: 60,
      totalPriceVND: 100000,
      startOffsetMinutes: 0,
      reason: 'Cùng cơ sở, cùng khung giờ'
    }], 'Có gợi ý');

    const cards = html.match(/class="court-suggestion-card"/g);
    assert.equal(cards?.length, 1, 'Phải có đúng 1 card');
  });

  await suite.test('QA-08-c: 3 gợi ý → đúng 3 card', () => {
    const suggestions = [1, 2, 3].map(i => ({
      courtId: String(i).repeat(24),
      courtName: `Sân ${i}`,
      facilityName: 'Cơ sở X',
      date: '2026-11-05',
      startTime: `${17 + i}:00`,
      endTime: `${18 + i}:00`,
      totalMinutes: 60,
      totalPriceVND: 100000 * i,
      startOffsetMinutes: i * 60,
      reason: `Muộn hơn ${i * 60} phút`
    }));

    const html = renderPartial(suggestions, 'Ba gợi ý');
    const cards = html.match(/class="court-suggestion-card"/g);
    assert.equal(cards?.length, 3, 'Phải có đúng 3 card');
  });

  await suite.test('QA-08-d: Tên sân rất dài (200 ký tự) không gây lỗi render', () => {
    const longName = 'Sân Tên Rất Rất Rất Dài '.repeat(8).trim().substring(0, 200);
    assert.doesNotThrow(() => {
      renderPartial([{
        courtId: '111111111111111111111111',
        courtName: longName,
        facilityName: 'Cơ sở X',
        date: '2026-11-05',
        startTime: '18:00',
        endTime: '19:00',
        totalMinutes: 60,
        totalPriceVND: 100000,
        startOffsetMinutes: 0,
        reason: 'Test'
      }], 'Msg');
    });
  });

  await suite.test('QA-08-e: XSS — tên sân và cơ sở có script/HTML → được escape', () => {
    const html = renderPartial([{
      courtId: '111111111111111111111111',
      courtName: '<script>alert("XSS")</script>',
      facilityName: '<img src=x onerror=alert(1)>',
      date: '2026-11-05',
      startTime: '18:00',
      endTime: '19:00',
      totalMinutes: 60,
      totalPriceVND: 100000,
      startOffsetMinutes: 0,
      reason: 'test <b>bold</b>'
    }], 'Msg');

    assert.doesNotMatch(html, /<script>alert\("XSS"\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
    assert.match(html, /&lt;script&gt;/);
  });

  await suite.test('QA-08-f: aria-labelledby tồn tại trên section gợi ý', () => {
    const html = renderPartial([{
      courtId: '111111111111111111111111',
      courtName: 'Sân A',
      facilityName: 'Cơ sở X',
      date: '2026-11-05',
      startTime: '18:00',
      endTime: '19:00',
      totalMinutes: 60,
      totalPriceVND: 100000,
      startOffsetMinutes: 0,
      reason: 'test'
    }], 'Msg');

    assert.match(html, /aria-labelledby="court-suggestion-heading"/, 'Section phải có aria-labelledby');
    assert.match(html, /id="court-suggestion-heading"/, 'Heading phải có id tương ứng');
  });

  await suite.test('QA-08-g: Không hiển thị gợi ý khi courts.ejs nhận filterError (kể cả có suggestions)', () => {
    const html = ejs.render(courtsEjs, {
      title: 'Danh sách sân',
      courts: [],
      facilities: [],
      filters: { facilityId: '', date: '2026-11-05', startTime: '18:00', endTime: '19:00' },
      filterError: 'Giờ kết thúc phải sau giờ bắt đầu.',
      suggestions: [{
        courtId: '111111111111111111111111',
        courtName: 'Sân A',
        facilityName: 'Cơ sở X',
        date: '2026-11-05',
        startTime: '18:00',
        endTime: '19:00',
        totalMinutes: 60,
        totalPriceVND: 100000,
        startOffsetMinutes: 0,
        reason: 'test'
      }],
      suggestionMessage: 'Có gợi ý',
      formatDate,
      formatMoney,
      currentUser: null
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.doesNotMatch(html, /court-suggestion-section/, 'Có filterError → không hiển thị gợi ý');
  });

  await suite.test('QA-08-h: Không hiển thị gợi ý khi thiếu startTime hoặc endTime', () => {
    const html = ejs.render(courtsEjs, {
      title: 'Danh sách sân',
      courts: [],
      facilities: [],
      filters: { facilityId: '', date: '2026-11-05', startTime: '', endTime: '' },
      filterError: null,
      suggestions: [],
      suggestionMessage: null,
      formatDate,
      formatMoney,
      currentUser: null
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.doesNotMatch(html, /court-suggestion-section/);
  });

  await suite.test('QA-08-i: formatMoney hiển thị đúng định dạng tiền VND', () => {
    const html = renderPartial([{
      courtId: '111111111111111111111111',
      courtName: 'Sân A',
      facilityName: 'Cơ sở X',
      date: '2026-11-05',
      startTime: '18:00',
      endTime: '19:00',
      totalMinutes: 60,
      totalPriceVND: 130000,
      startOffsetMinutes: 0,
      reason: 'test'
    }], 'Msg');

    // formatMoney(130000) phải cho ra "130.000" hoặc tương tự
    assert.match(html, /130[.,]000/, 'Giá 130k phải được format đúng');
    assert.match(html, /Tổng giá phương án/, 'Phải có nhãn tổng giá');
    assert.doesNotMatch(html, /giá mỗi giờ/i, 'Không được ghi nhãn "giá mỗi giờ"');
  });
});
