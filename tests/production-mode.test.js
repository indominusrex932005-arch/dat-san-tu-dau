import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';
import { health } from '../controllers/health.controller.js';

// This is a local HTTP proxy simulation, not evidence of Render TLS or browser cookie enforcement.
class ProxyTestBrowser extends TestBrowser {
  request(path, options = {}) {
    return super.request(path, {
      ...options,
      headers: { ...options.headers, 'X-Forwarded-Proto': 'https' }
    });
  }
}

const password = 'SyntheticProductionFixture-2026!';
const futureDate = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const businessModels = [User, Facility, Court, Booking, SlotLock, Payment, BookingRequest];
const businessCounts = () => Promise.all(businessModels.map(model => model.countDocuments()));

test('Production public-demo: MongoStore, Secure cookie, CSRF và chế độ server trên HTTP qua proxy mô phỏng', { timeout: 60000 }, async t => {
  const environment = await createTestEnvironment({ nodeEnv: 'production', paymentMode: 'demo' });
  t.after(() => environment.close());

  await t.test('Health ping DB thật trả trạng thái tối thiểu, không tạo session hay ghi nghiệp vụ', async () => {
    const counts = await businessCounts();
    const sessions = await mongoose.connection.collection('sessions').countDocuments();
    const result = await new ProxyTestBrowser(environment.base).get('/health?PAYMENT_MODE=live');
    assert.equal(result.status, 200);
    assert.deepEqual(JSON.parse(result.html), { status: 'ok' });
    assert.equal(result.headers.getSetCookie().length, 0);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await businessCounts(), counts);
    assert.equal(await mongoose.connection.collection('sessions').countDocuments(), sessions);
  });

  await t.test('Health khi ping lỗi trả 503 chung, không lộ lỗi DB hay tạo session', async () => {
    const database = mongoose.connection.db;
    const originalCommand = database.command;
    const before = await businessCounts();
    const sessionCount = await mongoose.connection.collection('sessions').countDocuments();
    database.command = async command => {
      if (command.ping) throw new Error('synthetic-mongodb-uri-and-private-detail');
      return originalCommand.call(database, command);
    };
    try {
      const result = await new ProxyTestBrowser(environment.base).get('/health');
      assert.equal(result.status, 503);
      assert.deepEqual(JSON.parse(result.html), { status: 'unavailable' });
      assert.equal(result.headers.getSetCookie().length, 0);
      assert.doesNotMatch(result.html, /synthetic|mongodb|private/i);
    } finally { database.command = originalCommand; }
    assert.deepEqual(await businessCounts(), before);
    assert.equal(await mongoose.connection.collection('sessions').countDocuments(), sessionCount);
  });

  await t.test('Nhiều probe dùng chung một ping đang chạy và có hạn driver dưới 5 giây', async () => {
    const database = mongoose.connection.db;
    const originalCommand = database.command;
    const pending = [];
    const optionsSeen = [];
    database.command = (command, options) => {
      assert.deepEqual(command, { ping: 1 });
      optionsSeen.push(options);
      return new Promise(resolve => pending.push(resolve));
    };
    const responses = Array.from({ length: 3 }, () => ({
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    }));
    const requests = responses.map(response => health({}, response));
    try {
      assert.equal(pending.length, 1, 'Concurrent probes must share one database operation.');
      assert.ok(optionsSeen[0].timeoutMS > 0 && optionsSeen[0].timeoutMS < 5000);
    } finally {
      for (const resolve of pending) resolve({ ok: 1 });
      await Promise.all(requests);
      database.command = originalCommand;
    }
    for (const response of responses) {
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.body, { status: 'ok' });
    }
  });

  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, customer] = await User.create([
    { fullName: 'Chủ sân dữ liệu thử', email: 'production-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' },
    { fullName: 'Khách dữ liệu thử', email: 'production-customer@example.test', passwordHash, role: 'CUSTOMER', phone: '0912345678' }
  ]);
  const facility = await Facility.create({ name: 'Cơ sở public demo kiểm thử', address: 'Địa chỉ dữ liệu thử', phone: '0912345678', owner: owner._id });
  const court = await Court.create({
    name: 'Sân demo kiểm thử', facility: facility._id, openTime: '06:00', closeTime: '22:00',
    peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000
  });
  const fields = times => ({ courtId: String(court._id), date: futureDate, times, guestName: 'Khách dữ liệu thử', guestPhone: '0912345678' });
  const client = new ProxyTestBrowser(environment.base);

  await t.test('Cookie giữ Secure/HttpOnly/SameSite=Lax; login có session thật trong MongoStore', async () => {
    const insecure = new TestBrowser(environment.base);
    const loginPageOverHttp = await insecure.get('/login');
    assert.equal(loginPageOverHttp.status, 200);
    assert.equal(loginPageOverHttp.headers.getSetCookie().length, 0);
    assert.equal((await insecure.post('/login', { email: customer.email, password })).status, 403);

    const loginPage = await client.get('/login');
    assert.equal(loginPage.status, 200);
    const cookie = loginPage.headers.getSetCookie().find(value => value.startsWith('dat_san_sid='));
    assert.ok(cookie);
    assert.match(cookie, /; Secure(?:;|$)/i);
    assert.match(cookie, /; HttpOnly(?:;|$)/i);
    assert.match(cookie, /; SameSite=Lax(?:;|$)/i);
    const loggedIn = await client.login(customer.email, password);
    assert.equal(loggedIn.status, 303);
    const records = await mongoose.connection.collection('sessions').find({}).toArray();
    assert.ok(records.some(record => JSON.parse(record.session).userId === String(customer._id)));
    assert.equal((await client.get('/my-bookings')).status, 200);
  });

  let paidBooking;
  await t.test('POST cần CSRF; demo production xác nhận DEMO_PAID, không tin paymentStatus/mode từ client', async () => {
    const before = await Booking.countDocuments();
    assert.equal((await client.post('/bookings', fields(['08:00']), { csrf: false })).status, 403);
    assert.equal((await client.post('/bookings', { ...fields(['08:00']), _csrf: 'invalid' })).status, 403);
    assert.equal(await Booking.countDocuments(), before);
    const hold = await client.hold({ ...fields(['08:00', '08:30']), PAYMENT_MODE: 'live', paymentStatus: 'PAID' });
    assert.equal(hold.status, 303);
    paidBooking = bookingFromLocation(hold.location);
    const checkout = await client.get(paidBooking.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /Mô phỏng thanh toán toàn bộ/);
    assert.match(checkout.html, /chưa.*(?:tiền thật|ngân hàng)|không.*tiền thật/i);
    assert.equal((await client.post(`/bookings/${paidBooking.id}/demo-payment`, {}, { csrf: false })).status, 403);
    assert.equal(await Payment.countDocuments({ booking: paidBooking.id }), 0);
    const paid = await client.post(`/bookings/${paidBooking.id}/demo-payment`, { PAYMENT_MODE: 'live', paymentStatus: 'PAID' });
    assert.equal(paid.status, 303);
    const record = await Booking.findById(paidBooking.id).lean();
    assert.equal(record.status, 'CONFIRMED');
    assert.equal(record.paymentStatus, 'DEMO_PAID');
    assert.equal(await SlotLock.countDocuments({ booking: record._id, expiresAt: null }), 2);
    assert.equal(await Payment.countDocuments({ booking: record._id, type: 'INITIAL_DEMO', method: 'DEMO' }), 1);
    assert.equal(await Booking.countDocuments({ paymentStatus: 'PAID' }), 0);
    const receipt = await client.get(paid.location);
    assert.equal(receipt.status, 200);
    assert.match(receipt.html, /THANH TOÁN MÔ PHỎNG/);
  });

  await t.test('Server off ẩn nút; giả mode qua body/query/header không tạo Payment hay đổi Booking/SlotLock', async () => {
    const hold = await client.hold(fields(['09:00']));
    assert.equal(hold.status, 303);
    const details = bookingFromLocation(hold.location);
    const snapshot = async () => JSON.stringify({
      booking: await Booking.findById(details.id).lean(),
      locks: await SlotLock.find({ booking: details.id }).sort({ _id: 1 }).lean(),
      payments: await Payment.find({ booking: details.id }).sort({ _id: 1 }).lean()
    });
    const before = await snapshot();
    process.env.PAYMENT_MODE = 'off';
    try {
      const checkout = await client.get(`${details.checkout}?PAYMENT_MODE=demo&demoMode=true`);
      assert.equal(checkout.status, 200);
      assert.doesNotMatch(checkout.html, /id="demo-payment-form"/);
      const denied = await client.post(`/bookings/${details.id}/demo-payment?PAYMENT_MODE=demo&DEMO_MODE=true`, {
        PAYMENT_MODE: 'demo', DEMO_MODE: 'true', demoMode: 'true', paymentStatus: 'PAID'
      });
      assert.equal(denied.status, 403);
      const headerDenied = await client.request(`/bookings/${details.id}/demo-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'PAYMENT_MODE': 'demo', 'X-Payment-Mode': 'demo' },
        body: new URLSearchParams({ _csrf: client.csrfToken, PAYMENT_MODE: 'demo' })
      });
      assert.equal(headerDenied.status, 403);
      assert.equal(await snapshot(), before);
      const previousReceipt = await client.get(`/bookings/${paidBooking.id}/receipt`);
      assert.equal(previousReceipt.status, 200);
      assert.match(previousReceipt.html, /THANH TOÁN MÔ PHỎNG/);
      assert.equal((await Booking.findById(paidBooking.id).lean()).paymentStatus, 'DEMO_PAID');
    } finally { process.env.PAYMENT_MODE = 'demo'; }
  });
});

test('Production khởi động không có PAYMENT_MODE mặc định off; session/CSRF vẫn dùng được', { timeout: 30000 }, async t => {
  // A null helper option deliberately leaves PAYMENT_MODE absent before createApp runs.
  const environment = await createTestEnvironment({ nodeEnv: 'production', paymentMode: null });
  t.after(() => environment.close());
  assert.equal(Object.hasOwn(process.env, 'PAYMENT_MODE'), false);
  const owner = await User.create({
    fullName: 'Chủ sân default-off thử', email: 'default-off-owner@example.test',
    passwordHash: await bcrypt.hash(password, 4), role: 'OWNER', ownerStatus: 'APPROVED'
  });
  const facility = await Facility.create({ name: 'Cơ sở default-off thử', address: 'Địa chỉ dữ liệu thử', phone: '0912345678', owner: owner._id });
  const court = await Court.create({
    name: 'Sân default-off thử', facility: facility._id, openTime: '06:00', closeTime: '22:00',
    peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000
  });
  const client = new ProxyTestBrowser(environment.base);
  const login = await client.get('/login');
  assert.equal(login.status, 200);
  assert.doesNotMatch(login.html, /Bản demo công khai/);
  assert.ok(login.headers.getSetCookie().some(cookie => /; Secure(?:;|$)/i.test(cookie)));
  const hold = await client.hold({
    courtId: String(court._id), date: futureDate, times: ['08:00'], guestName: 'Khách thử', guestPhone: '0912345678', PAYMENT_MODE: 'demo'
  });
  assert.equal(hold.status, 303);
  const details = bookingFromLocation(hold.location);
  const checkout = await client.get(details.checkout);
  assert.equal(checkout.status, 200);
  assert.doesNotMatch(checkout.html, /id="demo-payment-form"|Bản demo công khai|BẢN DEMO/);
  assert.equal((await client.post(`/bookings/${details.id}/demo-payment`, { token: details.token, PAYMENT_MODE: 'demo' })).status, 403);
  assert.equal((await Booking.findById(details.id).lean()).paymentStatus, 'UNPAID');
  assert.equal(await Payment.countDocuments(), 0);
});
