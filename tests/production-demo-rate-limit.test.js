import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

// Local HTTP with a trusted proxy header and in-memory cookie jar only.
// This does not test Render TLS or a browser's enforcement of Secure cookies.
class ProxyTestBrowser extends TestBrowser {
  request(path, options = {}) {
    return super.request(path, {
      ...options,
      headers: {
        ...options.headers,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-For': '198.51.100.42'
      }
    });
  }
}

test('Production demo + trusted proxy + CSRF + quota + MongoStore cùng hoạt động trên một phiên', { timeout: 60000 }, async t => {
  const limits = {
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: '60', RATE_LIMIT_LOGIN_IP_MAX: '10', RATE_LIMIT_LOGIN_ACCOUNT_IP_MAX: '1',
    RATE_LIMIT_BOOKINGS_WINDOW_SECONDS: '60', RATE_LIMIT_BOOKINGS_IP_MAX: '10', RATE_LIMIT_BOOKINGS_ACTOR_MAX: '1'
  };
  const original = Object.fromEntries(Object.keys(limits).map(key => [key, process.env[key]]));
  Object.assign(process.env, limits);
  t.after(() => {
    for (const key of Object.keys(limits)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  const environment = await createTestEnvironment({
    nodeEnv: 'production', paymentMode: 'demo', trustProxyIPs: '127.0.0.1/32'
  });
  t.after(() => environment.close());

  const password = 'SyntheticCombinedProductionFixture-2026!';
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, customer] = await User.create([
    { fullName: 'Chủ sân fixture tích hợp', email: 'combined-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' },
    { fullName: 'Khách fixture tích hợp', email: 'combined-customer@example.test', passwordHash, role: 'CUSTOMER', phone: '0912345678' }
  ]);
  const facility = await Facility.create({
    name: 'Cơ sở fixture tích hợp', address: 'Địa chỉ dữ liệu tổng hợp', phone: '0912345678', owner: owner._id
  });
  const court = await Court.create({
    name: 'Sân fixture tích hợp', facility: facility._id, openTime: '06:00', closeTime: '22:00',
    peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000
  });
  const date = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  const fields = times => ({ courtId: String(court._id), date, times });
  const businessState = async () => JSON.stringify({
    bookings: await Booking.find().sort({ _id: 1 }).lean(),
    locks: await SlotLock.find().sort({ _id: 1 }).lean(),
    payments: await Payment.find().sort({ _id: 1 }).lean()
  });
  const client = new ProxyTestBrowser(environment.base);

  const loginPage = await client.get('/login');
  assert.equal(loginPage.status, 200);
  const sessionCookie = loginPage.headers.getSetCookie().find(value => value.startsWith('dat_san_sid='));
  assert.ok(sessionCookie, 'Trusted HTTPS proxy must allow the production session cookie.');
  assert.ok(/; Secure(?:;|$)/i.test(sessionCookie), 'Cookie must be Secure.');
  assert.ok(/; HttpOnly(?:;|$)/i.test(sessionCookie), 'Cookie must be HttpOnly.');
  assert.ok(/; SameSite=Lax(?:;|$)/i.test(sessionCookie), 'Cookie must be SameSite=Lax.');
  assert.ok(client.csrfToken, 'Login form must have a CSRF token.');
  const anonymousCookie = client.cookies.get('dat_san_sid');
  const anonymousCsrf = client.csrfToken;

  // A rejected CSRF request must not spend the only allowed account/IP attempt.
  const missingLoginCsrf = await client.post('/login', { email: customer.email, password }, { csrf: false });
  assert.equal(missingLoginCsrf.status, 403);
  const login = await client.post('/login', { email: customer.email, password });
  assert.equal(login.status, 303);
  assert.equal(login.location, '/courts');
  assert.ok(client.cookies.get('dat_san_sid') !== anonymousCookie, 'Login must regenerate the session.');
  const courtsPage = await client.get(login.location);
  assert.equal(courtsPage.status, 200);
  assert.ok(client.csrfToken && client.csrfToken !== anonymousCsrf, 'Regenerated session must use a new CSRF token.');
  const sessions = await mongoose.connection.collection('sessions').find({}).toArray();
  assert.ok(sessions.some(record => JSON.parse(record.session).userId === String(customer._id)), 'Authenticated session must persist in MongoStore.');

  // The same production session passes CSRF, creates a multi-slot HOLD, then hits its actor quota.
  const beforeMissingCsrf = await businessState();
  assert.equal((await client.post('/bookings', fields(['16:30', '17:00', '19:00']), { csrf: false })).status, 403);
  assert.ok(await businessState() === beforeMissingCsrf, 'Missing CSRF must not write booking state.');
  const hold = await client.post('/bookings', {
    ...fields(['16:30', '17:00', '19:00']), PAYMENT_MODE: 'live', paymentStatus: 'PAID'
  });
  assert.equal(hold.status, 303);
  const details = bookingFromLocation(hold.location);
  const held = await Booking.findById(details.id).lean();
  assert.equal(held.status, 'HOLD');
  assert.equal(held.paymentStatus, 'UNPAID');
  assert.equal(held.totalPrice, 200000);
  assert.equal(held.slots.length, 3);
  assert.equal(await SlotLock.countDocuments({ booking: held._id }), 3);

  const before429 = await businessState();
  const deniedHold = await client.post('/bookings', fields(['20:00']));
  assert.equal(deniedHold.status, 429);
  const retryAfter = Number(deniedHold.headers.get('retry-after'));
  assert.ok(Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 60);
  assert.equal(deniedHold.headers.get('cache-control'), 'no-store');
  assert.ok(await businessState() === before429, 'Rate rejection must not change Booking, SlotLock or Payment.');

  // The booking creation quota must not prevent an existing HOLD from being paid in demo mode.
  const checkout = await client.get(details.checkout);
  assert.equal(checkout.status, 200);
  assert.match(checkout.html, /Mô phỏng thanh toán toàn bộ/);
  const paid = await client.post(`/bookings/${details.id}/demo-payment`, { paymentStatus: 'PAID', PAYMENT_MODE: 'live' });
  assert.equal(paid.status, 303);
  const confirmed = await Booking.findById(details.id).lean();
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(confirmed.paymentStatus, 'DEMO_PAID');
  assert.equal(await Booking.countDocuments({ paymentStatus: 'PAID' }), 0);
  assert.equal(await SlotLock.countDocuments({ booking: held._id, expiresAt: null }), 3);
  assert.equal(await Payment.countDocuments({ booking: held._id, type: 'INITIAL_DEMO', method: 'DEMO' }), 1);
  const receipt = await client.get(paid.location);
  assert.equal(receipt.status, 200);
  assert.match(receipt.html, /THANH TOÁN MÔ PHỎNG/);
  assert.equal((await client.post(`/bookings/${details.id}/demo-payment`)).status, 303);
  assert.equal(await Payment.countDocuments({ booking: held._id }), 1, 'Payment replay must not create a second transaction.');

  const authenticatedCookie = client.cookies.get('dat_san_sid');
  const beforeLogin429 = await businessState();
  const deniedLogin = await client.post('/login', { email: customer.email, password });
  assert.equal(deniedLogin.status, 429);
  assert.ok(Number(deniedLogin.headers.get('retry-after')) > 0);
  assert.ok(client.cookies.get('dat_san_sid') === authenticatedCookie, 'Throttled login must not rotate or lose the authenticated session.');
  assert.ok(await businessState() === beforeLogin429, 'Throttled login must not change booking state.');
  assert.equal((await client.get('/my-bookings')).status, 200);

  const replayedSession = new ProxyTestBrowser(environment.base);
  replayedSession.cookies = new Map(client.cookies);
  const logout = await client.post('/logout');
  assert.equal(logout.status, 303);
  assert.equal(logout.location, '/login');
  assert.ok(!client.cookies.has('dat_san_sid'), 'Logout must clear the cookie jar entry.');
  const sessionAfterLogout = await mongoose.connection.collection('sessions').find({}).toArray();
  assert.ok(!sessionAfterLogout.some(record => JSON.parse(record.session).userId === String(customer._id)), 'Logout must destroy the MongoStore session.');
  const oldSessionPage = await replayedSession.get('/my-bookings');
  assert.equal(oldSessionPage.status, 303);
  assert.equal(oldSessionPage.location, '/login');
});
