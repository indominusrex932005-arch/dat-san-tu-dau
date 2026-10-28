import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getOwnerCalendar } from '../services/owner-calendar.service.js';
import { slotInstant } from '../domain/booking-rules.js';
import {
  createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest
} from './helpers/database.js';

test('Lịch điều hành dùng dữ liệu thật, phạm vi cơ sở và quy tắc khả dụng chung', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const ownerData = (alias, overrides = {}) => ({
    fullName: `Chủ lịch ${alias}`, email: `calendar-${alias}@example.test`,
    passwordHash: 'local-calendar-service-fixture-not-for-login', role: 'OWNER', ownerStatus: 'APPROVED', ...overrides
  });
  const [ownerA, ownerB, unassigned, emptyOwner, customer, pending] = await User.create([
    ownerData('a'), ownerData('b'), ownerData('unassigned'), ownerData('empty'),
    ownerData('customer', { role: 'CUSTOMER' }), ownerData('pending', { ownerStatus: 'PENDING' })
  ]);
  const [facilityA, facilityB, emptyFacility] = await Facility.create([
    { name: 'Cơ sở lịch A', address: 'Địa chỉ A', owner: ownerA._id, phone: '0912345678' },
    { name: 'Cơ sở lịch B', address: 'Địa chỉ B', owner: ownerB._id, phone: '0987654321' },
    { name: 'Cơ sở lịch rỗng', address: 'Địa chỉ thử rỗng', owner: emptyOwner._id }
  ]);
  const courtData = (name, facility, openTime, closeTime, overrides = {}) => ({
    name, facility, openTime, closeTime, peakStartTime: openTime, peakEndTime: closeTime,
    basePriceVND: 55000, peakPriceVND: 75000, ...overrides
  });
  const [early, late, inactive, other] = await Court.create([
    courtData('A — Sân sáng', facilityA._id, '05:00', '08:00', { peakStartTime: '06:00' }),
    courtData('A — Sân tối', facilityA._id, '21:00', '23:30'),
    courtData('A — Tạm ngừng', facilityA._id, '08:00', '09:00', { active: false }),
    courtData('B — Không được lộ', facilityB._id, '00:00', '00:30')
  ]);
  const now = new Date('2031-01-01T12:00:00+07:00');
  const date = '2031-01-02';
  const createLock = async (court, time, expiresAt, suffix, fixtureDate = date) => {
    const startAt = slotInstant(fixtureDate, time);
    const booking = await Booking.create({
      facility: court.facility, court: court._id, publicCode: `QA-CALENDAR-${suffix}`,
      guestName: 'Khách lịch tổng hợp', guestPhone: '0912345678', guestTokenHash: 'a'.repeat(64),
      date: fixtureDate, slots: [{ startAt, endAt: new Date(Number(startAt) + 1800000), priceVND: 12345 }],
      totalPrice: 12345, status: expiresAt ? 'HOLD' : 'CONFIRMED',
      holdExpiresAt: expiresAt || undefined, createdAt: now
    });
    await SlotLock.create({ court: court._id, booking: booking._id, slotStart: startAt, expiresAt });
    return booking;
  };
  const booked = await createLock(early, '05:30', null, 'BOOKED');
  await createLock(early, '06:00', new Date(Number(now) + 300000), 'HOLD');
  const expired = await createLock(early, '06:30', new Date(Number(now) - 1), 'EXPIRED');
  await createLock(early, '07:00', now, 'AT-DEADLINE');
  await createLock(inactive, '08:00', null, 'INACTIVE');
  await createLock(other, '00:00', null, 'OTHER-FACILITY');
  await createLock(early, '05:00', null, 'OTHER-DATE', '2031-01-03');
  await Payment.create({ booking: booked._id, amountVND: 12345, type: 'INITIAL_DEMO' });
  await BookingRequest.create({ booking: booked._id, user: customer._id, type: 'CANCEL', reason: 'Yêu cầu thử chưa xử lý' });
  const read = (owner = ownerA, query = { date }, clock = now) => getOwnerCalendar(owner, query, clock);
  const getRow = (calendar, court) => calendar.courtRows.find(row => row.courtId === String(court._id));
  const getSlot = (row, time) => row.slots.find(slot => slot.time === time);

  await t.test('Hai OWNER chỉ thấy cơ sở trong DB, bỏ qua owner/facility tùy ý do query gửi', async () => {
    const a = await read(ownerA, { date, owner: ownerB._id, ownerId: ownerB._id, facilityId: facilityB._id });
    const b = await read(ownerB, { date, facilityId: facilityA._id });
    assert.equal(String(a.facility._id), String(facilityA._id));
    assert.equal(String(b.facility._id), String(facilityB._id));
    assert.equal(a.courtRows.length, 3);
    assert.equal(b.courtRows.length, 1);
    assert.ok(!a.courtRows.some(row => row.courtId === String(other._id)));
    assert.deepEqual(Object.keys(a.facility).sort(), ['_id', 'address', 'name', 'phone']);
    for (const row of a.courtRows) {
      assert.deepEqual(Object.keys(row).sort(), ['active', 'courtId', 'name', 'slots']);
      for (const slot of row.slots) assert.deepEqual(Object.keys(slot).sort(), ['endTime', 'priceVND', 'status', 'time']);
    }
    assert.ok(!JSON.stringify(a).includes('guestTokenHash'));
    assert.ok(!JSON.stringify(a).includes('a'.repeat(64)));
  });

  await t.test('Trục giờ là hợp giờ của các sân, có khoảng gián đoạn, giữ inactive và không cố định 06–22', async () => {
    const calendar = await read();
    assert.deepEqual(calendar.timeColumns.map(slot => slot.time), [
      '05:00', '05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '21:00', '21:30', '22:00', '22:30', '23:00'
    ]);
    assert.deepEqual(calendar.timeColumns.at(-1), { time: '23:00', endTime: '23:30' });
    for (const row of calendar.courtRows) {
      assert.deepEqual(row.slots.map(slot => ({ time: slot.time, endTime: slot.endTime })), calendar.timeColumns);
    }
    const earlyOutside = getSlot(getRow(calendar, early), '21:00');
    assert.deepEqual(earlyOutside, { time: '21:00', endTime: '21:30', status: 'UNAVAILABLE', priceVND: null });
    assert.equal(getSlot(getRow(calendar, late), '05:00').status, 'UNAVAILABLE');
    const stopped = getRow(calendar, inactive);
    assert.equal(stopped.active, false);
    assert.ok(stopped.slots.every(slot => slot.status === 'UNAVAILABLE'));
  });

  await t.test('HOLD còn hạn, hết hạn, đúng hạn và BOOKED theo makeSlots; giá hiện tại không lấy tiền đơn', async () => {
    const row = getRow(await read(), early);
    assert.equal(getSlot(row, '05:00').status, 'AVAILABLE', 'Lock ngày khác không được ảnh hưởng.');
    assert.equal(getSlot(row, '05:30').status, 'BOOKED');
    assert.equal(getSlot(row, '06:00').status, 'LOCKED');
    assert.equal(getSlot(row, '06:30').status, 'AVAILABLE');
    assert.equal(getSlot(row, '07:00').status, 'AVAILABLE');
    assert.equal(getSlot(row, '05:30').priceVND, 55000);
    assert.equal(getSlot(row, '06:00').priceVND, 75000);
    assert.equal((await Booking.findById(booked._id).lean()).totalPrice, 12345);
    assert.equal((await Booking.findById(expired._id).lean()).status, 'HOLD');
    assert.equal(await SlotLock.countDocuments({ booking: expired._id }), 1);
  });

  await t.test('Ô quá giờ và đúng thời điểm bắt đầu không còn AVAILABLE', async () => {
    const clock = new Date('2031-01-01T06:00:00+07:00');
    const row = getRow(await read(ownerA, { date: '2031-01-01' }, clock), early);
    for (const time of ['05:00', '05:30', '06:00']) assert.equal(getSlot(row, time).status, 'UNAVAILABLE');
    assert.equal(getSlot(row, '06:30').status, 'AVAILABLE');
  });

  await t.test('Ngày mặc định dùng UTC+7 qua năm mới; luôn trả 7 ngày từ hôm nay, cho chọn xa hơn', async () => {
    const boundary = new Date('2030-12-31T17:00:00Z');
    const calendar = await read(ownerA, {}, boundary);
    assert.equal(calendar.selectedDate, '2031-01-01');
    assert.deepEqual(calendar.dayOptions.map(day => day.date), [
      '2031-01-01', '2031-01-02', '2031-01-03', '2031-01-04', '2031-01-05', '2031-01-06', '2031-01-07'
    ]);
    assert.equal(calendar.dayOptions.filter(day => day.isSelected).length, 1);
    assert.ok(calendar.dayOptions.every(day => typeof day.label === 'string' && day.label.length > 0));
    const far = await read(ownerA, { date: '2031-02-28' }, boundary);
    assert.equal(far.selectedDate, '2031-02-28');
    assert.deepEqual(far.dayOptions.map(day => day.date), calendar.dayOptions.map(day => day.date));
    assert.ok(far.dayOptions.every(day => !day.isSelected));
  });

  await t.test('Ngày trống, sai định dạng, không tồn tại, quá khứ, sai kiểu hoặc lặp đều bị 400', async () => {
    for (const invalid of ['', '01/01/2031', '2031-02-29', '2030-12-31', null, 20310102, { date }, [date], ['', date]]) {
      await assert.rejects(() => read(ownerA, { date: invalid }), error => error.status === 400);
    }
  });

  await t.test('CUSTOMER/chưa duyệt/thiếu tài khoản/chưa cấp cơ sở bị 403; DB thu hồi quyền có hiệu lực ngay', async () => {
    for (const denied of [null, { _id: 'not-an-id' }, customer, pending, unassigned, { _id: new mongoose.Types.ObjectId() }]) {
      await assert.rejects(() => read(denied), error => error.status === 403);
    }
    await User.updateOne({ _id: ownerA._id }, { $set: { ownerStatus: 'PENDING' } });
    try { await assert.rejects(() => read(ownerA), error => error.status === 403); }
    finally { await User.updateOne({ _id: ownerA._id }, { $set: { ownerStatus: 'APPROVED' } }); }
    await Facility.updateOne({ _id: facilityA._id }, { $set: { owner: unassigned._id } });
    try {
      await assert.rejects(() => read(ownerA), error => error.status === 403);
      assert.equal(String((await read(unassigned)).facility._id), String(facilityA._id));
    } finally { await Facility.updateOne({ _id: facilityA._id }, { $set: { owner: ownerA._id } }); }
  });

  await t.test('Cơ sở được cấp chưa có sân trả mảng rỗng thật, vẫn có ngày và bộ chọn 7 ngày', async () => {
    const calendar = await read(emptyOwner);
    assert.equal(String(calendar.facility._id), String(emptyFacility._id));
    assert.deepEqual(calendar.courtRows, []);
    assert.deepEqual(calendar.timeColumns, []);
    assert.equal(calendar.dayOptions.length, 7);
  });

  await t.test('Một truy vấn Court và một truy vấn SlotLock cho toàn bộ lịch', async () => {
    const queries = [];
    const previous = mongoose.get('debug');
    mongoose.set('debug', (collection, operation) => { queries.push({ collection, operation }); });
    try { await read(); }
    finally { mongoose.set('debug', previous); }
    assert.equal(queries.filter(query => query.collection === Court.collection.name && query.operation === 'find').length, 1);
    assert.equal(queries.filter(query => query.collection === SlotLock.collection.name && query.operation === 'find').length, 1);
    assert.equal(queries.length, 4, 'Chỉ đọc User, Facility, Court và SlotLock, không đọc từng ô/đơn.');
  });

  await t.test('Lỗi DB ở bất kỳ bước đọc nào được truyền lên, không thành lịch rỗng', async context => {
    for (const [model, operation] of [[User, 'findOne'], [Facility, 'findOne'], [Court, 'find'], [SlotLock, 'find']]) {
      const failure = new Error('QA calendar database failure');
      const mocked = context.mock.method(model, operation, () => { throw failure; });
      try { await assert.rejects(() => read(), error => error === failure); }
      finally { mocked.mock.restore(); }
    }
  });

  await t.test('Đọc lịch không đổi Booking/SlotLock/Payment/Request, giá hoặc quyền', async () => {
    const snapshot = async () => {
      const result = {};
      for (const model of [User, Facility, Court, Booking, SlotLock, Payment, BookingRequest]) {
        const records = await model.collection.find().sort({ _id: 1 }).toArray();
        result[model.modelName] = { count: records.length, sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex') };
      }
      return result;
    };
    const before = await snapshot();
    await read();
    await read(ownerB);
    await read(emptyOwner);
    assert.deepEqual(await snapshot(), before);
  });
});
