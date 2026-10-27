import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import SlotLock from '../models/SlotLock.js';
import { RuleError, slotInstant } from '../domain/booking-rules.js';
import { suggestCourts } from '../services/court-suggestion.service.js';
import { searchCourts } from '../services/court-search.service.js';

test('Court Suggestion Unit Tests', async (suite) => {
  const fixedNow = new Date('2026-11-01T12:00:00+07:00');
  const validDate = '2026-11-02';

  const mockOwnerApproved = { role: 'OWNER', ownerStatus: 'APPROVED' };
  const mockOwnerPending = { role: 'OWNER', ownerStatus: 'PENDING' };

  const facilityA = {
    _id: new mongoose.Types.ObjectId('654321654321654321654321'),
    name: 'Cơ sở Quận 1',
    phone: '0901234567',
    owner: mockOwnerApproved
  };

  const facilityB = {
    _id: new mongoose.Types.ObjectId('654321654321654321654322'),
    name: 'Cơ sở Quận 2',
    phone: '0907654321',
    owner: mockOwnerApproved
  };

  const facilityBadOwner = {
    _id: new mongoose.Types.ObjectId('654321654321654321654323'),
    name: 'Cơ sở Chưa Duyệt',
    phone: '0901112222',
    owner: mockOwnerPending
  };

  const facilityBadPhone = {
    _id: new mongoose.Types.ObjectId('654321654321654321654324'),
    name: 'Cơ sở Sai SĐT',
    phone: '123',
    owner: mockOwnerApproved
  };

  const court1A = {
    _id: new mongoose.Types.ObjectId('111111111111111111111111'),
    name: 'Sân 1 - Q1',
    facility: facilityA,
    active: true,
    openTime: '06:00',
    closeTime: '22:00',
    peakStartTime: '17:00',
    peakEndTime: '20:00',
    basePriceVND: 50000,
    peakPriceVND: 80000
  };

  const court2A = {
    _id: new mongoose.Types.ObjectId('222222222222222222222222'),
    name: 'Sân 2 - Q1',
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
    name: 'Sân B - Q2',
    facility: facilityB,
    active: true,
    openTime: '06:00',
    closeTime: '22:00',
    peakStartTime: '17:00',
    peakEndTime: '20:00',
    basePriceVND: 40000,
    peakPriceVND: 70000
  };

  await suite.test('Validate query đầu vào cho suggestCourts', async () => {
    // facilityId không hợp lệ
    await assert.rejects(
      () => suggestCourts({ facilityId: 'invalid-id', date: validDate, startTime: '18:00', endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('Cơ sở không hợp lệ')
    );

    // Tham số lặp lại
    await assert.rejects(
      () => suggestCourts({ date: [validDate, validDate], startTime: '18:00', endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );

    // Thiếu ngày
    await assert.rejects(
      () => suggestCourts({ startTime: '18:00', endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('chọn ngày')
    );

    // Ngày quá khứ
    await assert.rejects(
      () => suggestCourts({ date: '2026-10-30', startTime: '18:00', endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('quá khứ')
    );

    // Thiếu startTime hoặc endTime
    await assert.rejects(
      () => suggestCourts({ date: validDate, startTime: '18:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('đầy đủ')
    );
    await assert.rejects(
      () => suggestCourts({ date: validDate, endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('đầy đủ')
    );

    // endTime <= startTime
    await assert.rejects(
      () => suggestCourts({ date: validDate, startTime: '19:00', endTime: '18:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('sau giờ bắt đầu')
    );
    await assert.rejects(
      () => suggestCourts({ date: validDate, startTime: '19:00', endTime: '19:00' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('sau giờ bắt đầu')
    );
  });

  await suite.test('Loại bỏ sân inactive, chủ sân chưa duyệt hoặc thiếu số điện thoại hợp lệ', async () => {
    const inactiveCourt = { ...court1A, active: false };
    const unapprovedCourt = { ...court1A, facility: facilityBadOwner };
    const invalidPhoneCourt = { ...court1A, facility: facilityBadPhone };

    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => []
    }));

    const result = await suggestCourts(
      { date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow,
      { candidates: [inactiveCourt, unapprovedCourt, invalidPhoneCourt] }
    );

    assert.equal(result.suggestions.length, 0);
    assert.match(result.suggestionMessage, /Không tìm thấy phương án thay thế/);
  });

  await suite.test('Lọc đúng facilityId đã chọn, không mở rộng sang cơ sở khác', async () => {
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => []
    }));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow,
      { candidates: [court1A, courtB] }
    );

    // Kết quả chỉ được chứa sân của facilityA
    assert.ok(result.suggestions.length > 0);
    for (const sug of result.suggestions) {
      assert.equal(sug.facilityName, facilityA.name);
      assert.match(sug.reason, /Cùng cơ sở/);
    }
  });

  await suite.test('ObjectId cơ sở viết hoa và viết thường trả cùng gợi ý', async () => {
    suite.mock.method(SlotLock, 'find', () => ({ lean: async () => [] }));
    const facility = { ...facilityA, _id: new mongoose.Types.ObjectId('abcdef654321654321654321') };
    const candidates = [{ ...court1A, facility }, courtB];
    const query = { date: validDate, startTime: '18:00', endTime: '19:00' };
    const lower = await suggestCourts({ ...query, facilityId: String(facility._id) }, fixedNow, { candidates });
    const upper = await suggestCourts({ ...query, facilityId: String(facility._id).toUpperCase() }, fixedNow, { candidates });
    assert.ok(lower.suggestions.length > 0);
    assert.deepEqual(upper, lower);
    assert.ok(upper.suggestions.every(item => item.courtId === String(court1A._id)));
  });

  await suite.test('Bỏ qua lock hết hạn, loại bỏ BOOKED và HOLD còn hạn', async () => {
    const expiredLock = {
      slotStart: slotInstant(validDate, '18:00'),
      expiresAt: new Date(fixedNow.getTime() - 60000) // Hết hạn
    };
    const activeHold = {
      slotStart: slotInstant(validDate, '18:30'),
      expiresAt: new Date(fixedNow.getTime() + 60000) // Còn hạn
    };
    const confirmedBooking = {
      slotStart: slotInstant(validDate, '19:00'),
      expiresAt: null // Đã đặt
    };

    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => [expiredLock, activeHold, confirmedBooking]
    }));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow,
      { candidates: [court1A] }
    );

    // 18:00-19:00 dính activeHold (18:30) nên không gợi ý 18:00-19:00
    // 18:30-19:30 dính cả 2 nên không gợi ý
    // 19:00-20:00 dính confirmedBooking nên không gợi ý
    // Các ô được gợi ý phải không chứa 18:30 hoặc 19:00
    for (const sug of result.suggestions) {
      assert.notEqual(sug.startTime, '18:30');
      assert.notEqual(sug.startTime, '19:00');
    }
  });

  await suite.test('Xếp hạng: độ lệch giờ tuyệt đối tăng dần -> tổng giá tăng dần -> courtId -> startTime', async () => {
    // Cho 2 sân court1A (rẻ hơn) và court2A (đắt hơn)
    // Người dùng tìm 18:00-19:00
    // Giả sử 18:00-19:00 đã kín trên cả 2 sân
    const bookedLockCourt1 = [
      { slotStart: slotInstant(validDate, '18:00'), expiresAt: null },
      { slotStart: slotInstant(validDate, '18:30'), expiresAt: null }
    ];
    const bookedLockCourt2 = [
      { slotStart: slotInstant(validDate, '18:00'), expiresAt: null },
      { slotStart: slotInstant(validDate, '18:30'), expiresAt: null }
    ];

    suite.mock.method(SlotLock, 'find', (filter) => ({
      lean: async () => {
        if (String(filter.court) === String(court1A._id)) return bookedLockCourt1;
        if (String(filter.court) === String(court2A._id)) return bookedLockCourt2;
        return [];
      }
    }));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow,
      { candidates: [court1A, court2A] }
    );

    assert.equal(result.suggestions.length, 3);

    // Độ lệch tuyệt đối của gợi ý 1 phải <= gợi ý 2 <= gợi ý 3
    const offsets = result.suggestions.map(s => Math.abs(s.startOffsetMinutes));
    assert.ok(offsets[0] <= offsets[1] && offsets[1] <= offsets[2]);

    // Nếu cùng offset, giá rẻ hơn đứng trước
    for (let i = 0; i < result.suggestions.length - 1; i++) {
      const a = result.suggestions[i];
      const b = result.suggestions[i + 1];
      if (Math.abs(a.startOffsetMinutes) === Math.abs(b.startOffsetMinutes)) {
        assert.ok(a.totalPriceVND <= b.totalPriceVND);
      }
    }
  });

  await suite.test('Tính đúng tổng giá qua mốc cao điểm', async () => {
    // court1A: peakStartTime 17:00, peakEndTime 20:00, base 50k, peak 80k
    // Khung giờ 16:30 - 17:30 có 1 ô base (16:30: 50k) và 1 ô peak (17:00: 80k) => Tổng 130k
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => [
        // Chặn các ô từ 17:30 đến 22:00 để buộc gợi ý 16:30
        { slotStart: slotInstant(validDate, '17:30'), expiresAt: null },
        { slotStart: slotInstant(validDate, '18:00'), expiresAt: null },
        { slotStart: slotInstant(validDate, '18:30'), expiresAt: null }
      ]
    }));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '17:30', endTime: '18:30' },
      fixedNow,
      { candidates: [court1A] }
    );

    const crossPeakSug = result.suggestions.find(s => s.startTime === '16:30' && s.endTime === '17:30');
    assert.ok(crossPeakSug);
    assert.equal(crossPeakSug.totalPriceVND, 130000);
    assert.equal(crossPeakSug.totalMinutes, 60);
    assert.equal(crossPeakSug.startOffsetMinutes, -60);
    assert.match(crossPeakSug.reason, /sớm hơn 60 phút/);
  });

  await suite.test('Không gợi ý ô đã qua trong quá khứ so với now', async () => {
    // fixedNow là 12:00:00 ngày 2026-11-01
    // Tìm cho chính ngày hôm nay (2026-11-01)
    const today = '2026-11-01';
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => []
    }));

    const result = await suggestCourts(
      { facilityId: String(facilityA._id), date: today, startTime: '11:00', endTime: '12:00' },
      fixedNow,
      { candidates: [court1A] }
    );

    // Không gợi ý bất kỳ khung giờ nào bắt đầu trước hoặc bằng 12:00
    for (const sug of result.suggestions) {
      const [h] = sug.startTime.split(':').map(Number);
      assert.ok(h >= 12);
    }
  });

  await suite.test('Lỗi DB không bị biến thành không có gợi ý', async () => {
    suite.mock.method(SlotLock, 'find', () => {
      throw new Error('MongoDB connection lost');
    });

    await assert.rejects(
      () => suggestCourts(
        { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
        fixedNow,
        { candidates: [court1A] }
      ),
      (err) => err.message.includes('MongoDB connection lost')
    );
  });

  await suite.test('searchCourts tích hợp suggestions khi kết quả chính bằng 0', async () => {
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [court1A] }) })
    }));
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => [
        { slotStart: slotInstant(validDate, '18:00'), expiresAt: null },
        { slotStart: slotInstant(validDate, '18:30'), expiresAt: null }
      ]
    }));

    const result = await searchCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow
    );

    // Kết quả chính bằng 0
    assert.equal(result.courts.length, 0);
    // Gợi ý được tạo ra
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(result.suggestions.length > 0);
    assert.ok(result.suggestionMessage);
  });

  await suite.test('searchCourts không sinh gợi ý khi có kết quả chính', async () => {
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [court1A] }) })
    }));
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => []
    }));

    const result = await searchCourts(
      { facilityId: String(facilityA._id), date: validDate, startTime: '18:00', endTime: '19:00' },
      fixedNow
    );

    // Có kết quả chính
    assert.ok(result.courts.length > 0);
    // Không sinh gợi ý
    assert.deepEqual(result.suggestions, []);
    assert.equal(result.suggestionMessage, null);
  });

  await suite.test('searchCourts không sinh gợi ý khi không lọc theo khoảng giờ', async () => {
    suite.mock.method(Facility, 'find', () => ({
      sort: () => ({ lean: async () => [facilityA] })
    }));
    suite.mock.method(Court, 'find', () => ({
      populate: () => ({ sort: () => ({ lean: async () => [court1A] }) })
    }));
    suite.mock.method(SlotLock, 'find', () => ({
      lean: async () => []
    }));

    const result = await searchCourts(
      { date: validDate },
      fixedNow
    );

    assert.deepEqual(result.suggestions, []);
    assert.equal(result.suggestionMessage, null);
  });
});
