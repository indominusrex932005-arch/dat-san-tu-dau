import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, User, Facility, Court, Booking, Payment, BookingRequest, SlotLock } from './helpers/database.js';
import { TestBrowser } from './helpers/http.js';
import { checkInBooking, createChangeRequest, cancelByOwner } from '../services/booking.service.js';
import { ownerDemoReport, reportRange } from '../services/owner-report.service.js';
import { seedDemoFacilities } from '../services/demo-seed.service.js';
import { locksByCourtForDay } from '../services/court-locks.service.js';
import { vietnamDate, slotInstant } from '../domain/booking-rules.js';

const password = 'LocalDemoFinal2026!';
const fixedNow = new Date('2026-11-07T10:00:00+07:00');
let sequence = 0;
async function fixture(env) {
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, other, customer, pending] = await User.create([
    { fullName: 'Chủ kiểm thử', email: 'owner-final@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Chủ khác', email: 'other-final@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Khách kiểm thử', email: 'customer-final@example.test', passwordHash, role: 'CUSTOMER' },
    { fullName: 'Chủ chờ', email: 'pending-final@example.test', passwordHash, role: 'OWNER', ownerStatus: 'PENDING' }
  ]);
  const facility = await Facility.create({ name: 'Cơ sở kiểm thử', address: 'Địa chỉ thử', phone: '0900000001', owner: owner._id });
  const otherFacility = await Facility.create({ name: 'Cơ sở khác', address: 'Địa chỉ thử', phone: '0900000002', owner: other._id });
  const court = await Court.create({ facility: facility._id, name: 'Sân thử', basePriceVND: 100000, peakPriceVND: 100000 });
  const client = new TestBrowser(env.base);
  await client.login(owner.email, password);
  return { owner, other, customer, pending, facility, otherFacility, court, client };
}
function bookingData(f, overrides = {}) {
  const date = '2026-11-07';
  const startAt = slotInstant(date, '11:00');
  return { facility: f.facility._id, court: f.court._id, user: f.customer._id,
    publicCode: `FINAL-${++sequence}`, guestName: 'Khách thử', guestPhone: '0900000000', date,
    slots: [{ startAt, endAt: new Date(+startAt + 1800000), priceVND: 100000 }],
    totalPrice: 100000, status: 'CONFIRMED', paymentStatus: 'DEMO_PAID', ...overrides };
}

test('Check-in: thời điểm, quyền, chống bấm lại và khóa hủy/đổi', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const f = await fixture(env);
  const booking = await Booking.create(bookingData(f));
  await SlotLock.create({ court: f.court._id, booking: booking._id, slotStart: booking.slots[0].startAt, expiresAt: null });
  const locksBefore = await SlotLock.find().lean();
  await assert.rejects(checkInBooking(booking.id, f.other, fixedNow), { status: 403 });
  await assert.rejects(checkInBooking(booking.id, f.customer, fixedNow), { status: 403 });
  await assert.rejects(checkInBooking(booking.id, f.pending, fixedNow), { status: 403 });
  await assert.rejects(checkInBooking('invalid', f.owner, fixedNow), { status: 400 });
  for (const when of ['2026-11-06T10:00:00+07:00', '2026-11-08T10:00:00+07:00', '2026-11-07T11:30:00+07:00']) {
    await assert.rejects(checkInBooking(booking.id, f.owner, new Date(when)), { status: 409 });
  }
  for (const [status, paymentStatus] of [['HOLD', 'UNPAID'], ['EXPIRED', 'UNPAID'], ['CANCELLED', 'DEMO_PAID'], ['LEGACY_RESERVED', 'UNPAID'], ['CONFIRMED', 'UNPAID']]) {
    const item = await Booking.create(bookingData(f, { status, paymentStatus, holdExpiresAt: new Date(+fixedNow + 600000) }));
    await assert.rejects(checkInBooking(item.id, f.owner, fixedNow), { status: 409 });
  }
  const pending = await BookingRequest.create({ booking: booking._id, user: f.customer._id, type: 'CANCEL', status: 'PENDING', reason: 'Thử' });
  await assert.rejects(checkInBooking(booking.id, f.owner, fixedNow), { status: 409 });
  await BookingRequest.updateOne({ _id: pending._id }, { $set: { status: 'REJECTED' } });
  const results = await Promise.all([checkInBooking(booking.id, f.owner, fixedNow), checkInBooking(booking.id, f.owner, fixedNow)]);
  assert.ok(results.every(item => +item.checkedInAt === +fixedNow));
  const saved = await Booking.findById(booking._id).lean();
  assert.equal(String(saved.checkedInBy), f.owner.id);
  assert.equal(saved.status, 'CONFIRMED');
  assert.deepEqual(await SlotLock.find().lean(), locksBefore);
  assert.equal(await Payment.countDocuments(), 0, 'Check-in không tạo giao dịch tiền');
  await assert.rejects(createChangeRequest(booking.id, f.customer, { type: 'CANCEL', reason: 'Đã đến nhưng muốn hủy' }), { status: 409 });
  await assert.rejects(cancelByOwner(booking.id, f.owner, { refundAmount: 0 }), { status: 409 });
  const path = `/owner/bookings/${booking.id}/check-in`;
  assert.equal((await f.client.post(path, {}, { csrf: false })).status, 403);
  assert.equal((await f.client.post(path, { checkedInAt: '2099-01-01', checkedInBy: f.other.id })).status, 303);
  assert.equal(+(await Booking.findById(booking.id)).checkedInAt, +fixedNow);
  const outsider = new TestBrowser(env.base);
  await outsider.login(f.other.email, password);
  assert.equal((await outsider.post(path)).status, 403);
  await User.updateOne({ _id: f.owner._id }, { $set: { ownerStatus: 'REJECTED' } });
  assert.equal((await f.client.post(path)).status, 403);
});

test('Báo cáo: giao dịch mô phỏng, hoàn theo ngày Việt Nam, tách cơ sở và không đếm intent/QR', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const f = await fixture(env);
  const booking = await Booking.create(bookingData(f, { status: 'CANCELLED' }));
  const other = await Booking.create(bookingData(f, { facility: f.otherFacility._id }));
  const withoutDemo = await Booking.create(bookingData(f));
  const payments = await Payment.create([
    { booking: booking._id, type: 'INITIAL_DEMO', method: 'DEMO', amountVND: 100000 },
    { booking: booking._id, type: 'EXTRA_DEMO', method: 'DEMO', amountVND: 30000 },
    { booking: other._id, type: 'INITIAL_DEMO', method: 'DEMO', amountVND: 900000 }
  ]);
  const receiptTime = new Date('2026-11-06T17:00:00Z'); // 00:00 ngày 07 tại Việt Nam.
  await Payment.collection.updateMany({ _id: { $in: payments.map(item => item._id) } }, { $set: { createdAt: receiptTime } });
  // Evidence not part of the demo ledger must never be counted, even for the same booking.
  await Payment.collection.insertMany([
    { booking: booking._id, type: 'INITIAL_INTENT', method: 'PROVIDER', amountVND: 100000, createdAt: receiptTime },
    { booking: booking._id, type: 'PROVIDER_RECEIPT', method: 'PROVIDER', receiptStatus: 'APPLIED', amountVND: 100000, createdAt: receiptTime }
  ]);
  await BookingRequest.create([
    { booking: booking._id, type: 'CANCEL', status: 'APPROVED', refundStatus: 'TRANSFERRED', refundAmount: 20000, refundRecordedAt: new Date('2026-11-07T16:59:59Z') },
    { booking: booking._id, type: 'CHANGE', status: 'APPROVED', refundStatus: 'PENDING', refundAmount: 10000, processedAt: receiptTime },
    { booking: booking._id, type: 'CHANGE', status: 'APPROVED', refundStatus: 'TRANSFERRED', refundAmount: 5000, refundRecordedAt: new Date('2026-11-07T17:00:00Z') },
    { booking: other._id, type: 'CANCEL', status: 'APPROVED', refundStatus: 'TRANSFERRED', refundAmount: 900000, refundRecordedAt: receiptTime },
    { booking: withoutDemo._id, type: 'CANCEL', status: 'APPROVED', refundStatus: 'TRANSFERRED', refundAmount: 70000, refundRecordedAt: receiptTime }
  ]);
  const query = { from: '2026-11-07', to: '2026-11-07' };
  const report = await ownerDemoReport(f.owner, query);
  assert.deepEqual(report.total, { income: 130000, refund: 20000 });
  assert.equal(report.pending.amount, 10000);
  assert.equal(report.days[0].incomeCount, 2);
  assert.equal(report.days[0].date, '2026-11-07');
  assert.deepEqual((await ownerDemoReport(f.owner, { from: '2026-11-08', to: '2026-11-08' })).total, { income: 0, refund: 5000 });
  assert.deepEqual((await ownerDemoReport(f.owner, { from: '2026-11-06', to: '2026-11-06' })).total, { income: 0, refund: 0 });
  await assert.rejects(ownerDemoReport(f.customer, query), { status: 403 });
  for (const bad of [{ from: ['2026-11-07'] }, { from: '2026-02-30' }, { from: '2026-11-08', to: '2026-11-07' }, { from: '2020-01-01', to: '2026-11-07' }]) {
    assert.throws(() => reportRange(bad), { status: 400 });
  }
  const response = await f.client.get('/owner/reports?from=2026-11-07&to=2026-11-07&facilityId=' + f.otherFacility.id);
  assert.equal(response.status, 200, response.html);
  assert.match(response.html, /SỐ LIỆU MÔ PHỎNG/);
  assert.ok(!response.html.includes('Cơ sở khác'));
  const anonymous = new TestBrowser(env.base);
  assert.equal((await anonymous.get('/owner/reports')).status, 303);
  await anonymous.login(f.customer.email, password);
  assert.equal((await anonymous.get('/owner/reports')).status, 403);
});

test('Phân trang và tra cứu: tổng yêu cầu đủ dù đơn ở trang khác; khách chỉ thấy đơn mình', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const f = await fixture(env);
  const bookings = await Booking.create(Array.from({ length: 25 }, () => bookingData(f)));
  await BookingRequest.create(bookings.map(booking => ({ booking: booking._id, type: 'CANCEL', status: 'PENDING', reason: 'Thử trang' })));
  const first = await f.client.get('/owner');
  assert.equal(first.status, 200, first.html);
  assert.equal((first.html.match(/class="demo-card owner-booking-card"/g) || []).length, 20);
  assert.equal((first.html.match(/class="demo-card owner-request-card"/g) || []).length, 20);
  assert.match(first.html, /Yêu cầu chờ xử lý<\/span><strong>25/);
  const last = await f.client.get('/owner?page=2&requestPage=2');
  assert.equal((last.html.match(/class="demo-card owner-booking-card"/g) || []).length, 5);
  assert.equal((last.html.match(/class="demo-card owner-request-card"/g) || []).length, 5);
  const search = await f.client.get('/owner?q=' + bookings[0].publicCode);
  assert.equal((search.html.match(/class="demo-card owner-booking-card"/g) || []).length, 1);
  const other = await Booking.create(bookingData(f, { facility: f.otherFacility._id, user: f.other._id }));
  const denied = await f.client.get('/owner?q=' + other.publicCode);
  assert.equal((denied.html.match(/class="demo-card owner-booking-card"/g) || []).length, 0);
  assert.equal((await f.client.get('/owner?page=1&page=2')).status, 400);
  const customer = new TestBrowser(env.base);
  await customer.login(f.customer.email, password);
  const page = await customer.get('/my-bookings?page=2');
  assert.equal(page.status, 200, page.html);
  assert.equal((page.html.match(/<article class="my-bookings-card">/g) || []).length, 5);
  assert.ok(!page.html.includes(other.publicCode));
});

test('Seed chỉ bổ sung tới bốn cơ sở, không xóa/đổi cơ sở có sẵn', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  await Facility.create([{ name: 'Cơ sở A', address: 'A' }, { name: 'Cơ sở B', address: 'B' }]);
  const old = await Facility.find().lean();
  assert.equal((await seedDemoFacilities()).filter(item => item.created).length, 2);
  assert.equal(await Facility.countDocuments(), 4);
  for (const item of old) assert.deepEqual(await Facility.findById(item._id).lean(), item);
  assert.equal((await seedDemoFacilities()).filter(item => item.created).length, 0);
  await Facility.create({ name: 'Cơ sở thêm thủ công', address: 'C' });
  assert.equal((await seedDemoFacilities()).filter(item => item.created).length, 0);
  assert.equal(await Facility.countDocuments(), 5, 'Không tự xóa cơ sở để ép về bốn');
});

test('Truy vấn lock theo lô không lẫn sân/ngày; chỉ một truy vấn cho nhiều sân', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const f = await fixture(env);
  const court2 = await Court.create({ facility: f.facility._id, name: 'Sân 2', basePriceVND: 1, peakPriceVND: 1 });
  const date = vietnamDate(new Date());
  const booking = await Booking.create(bookingData(f));
  await SlotLock.create([
    { court: f.court._id, booking: booking._id, slotStart: slotInstant(date, '08:00'), expiresAt: null },
    { court: court2._id, booking: booking._id, slotStart: slotInstant(date, '09:00'), expiresAt: null },
    { court: court2._id, booking: booking._id, slotStart: new Date(+slotInstant(date, '09:00') + 86400000), expiresAt: null }
  ]);
  const find = t.mock.method(SlotLock, 'find');
  const result = await locksByCourtForDay([f.court, court2], date);
  assert.equal(find.mock.callCount(), 1);
  assert.equal(result.get(f.court.id).length, 1);
  assert.equal(result.get(court2.id).length, 1);
  assert.equal(+result.get(court2.id)[0].slotStart, +slotInstant(date, '09:00'));
});
