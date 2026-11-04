import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import createApp from '../app.js';
import { trustedProxyAddresses } from '../config/trust-proxy.js';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const password = 'LocalRateLimitFixture-2026!';

function configure(t, settings) {
  for (const [name, value] of Object.entries(settings)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}

function assertLimited(response, windowSeconds) {
  assert.equal(response.status, 429);
  assert.match(response.html, /Quá nhiều yêu cầu/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const retry = Number(response.headers.get('retry-after'));
  assert.ok(Number.isInteger(retry) && retry >= 1 && retry <= windowSeconds);
  assert.match(response.html, new RegExp(`thử lại sau ${retry} giây`));
  return retry;
}

test('Giới hạn riêng bốn POST, giữ CSRF và không ghi đơn bị chặn', { timeout: 30000 }, async t => {
  configure(t, {
    TRUST_PROXY_IPS: '',
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: '60',
    RATE_LIMIT_LOGIN_IP_MAX: '4',
    RATE_LIMIT_LOGIN_ACCOUNT_IP_MAX: '2',
    RATE_LIMIT_REGISTER_WINDOW_SECONDS: '60',
    RATE_LIMIT_REGISTER_IP_MAX: '1',
    RATE_LIMIT_REGISTER_OWNER_WINDOW_SECONDS: '60',
    RATE_LIMIT_REGISTER_OWNER_IP_MAX: '1',
    RATE_LIMIT_BOOKINGS_WINDOW_SECONDS: '3',
    RATE_LIMIT_BOOKINGS_IP_MAX: '3',
    RATE_LIMIT_BOOKINGS_ACTOR_MAX: '1'
  });
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const browser = () => new TestBrowser(env.base);
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, first, second] = await User.create([
    { email: 'owner@rate.test', fullName: 'Chủ sân', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { email: 'first@rate.test', fullName: 'Khách đầu', passwordHash },
    { email: 'second@rate.test', fullName: 'Khách khác', passwordHash, phone: '0900000080' }
  ]);
  const facility = await Facility.create({ owner: owner._id, name: 'Cơ sở thử', address: 'Địa chỉ thử', phone: '0900000080' });
  const court = await Court.create({ facility: facility._id, name: 'Sân thử', basePriceVND: 50000, peakPriceVND: 75000 });
  const date = new Date(Date.now() + 2 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);

  const signup = browser();
  const register = { fullName: 'Khách mới', email: 'register@rate.test', password, confirmPassword: password };
  assert.equal((await signup.get('/register')).status, 200);
  assert.equal((await signup.post('/register', register)).status, 303);
  const extraCustomer = { ...register, email: 'blocked-register@rate.test' };
  assertLimited(await signup.post('/register', extraCustomer), 60);
  assert.equal(await User.exists({ email: extraCustomer.email }), null);
  assert.equal((await signup.get('/register')).status, 200);

  const ownerRegister = { ...register, email: 'applicant@rate.test', phone: '0900000080',
    requestedFacilityName: 'Cơ sở đề nghị', requestedFacilityAddress: 'Địa chỉ đề nghị' };
  assert.equal((await signup.get('/register/owner')).status, 200);
  assert.equal((await signup.post('/register/owner', ownerRegister)).status, 303);
  assert.equal((await User.findOne({ email: ownerRegister.email })).ownerStatus, 'PENDING');
  const extraOwner = { ...ownerRegister, email: 'blocked-owner@rate.test' };
  assertLimited(await signup.post('/register/owner', extraOwner), 60);
  assert.equal(await User.exists({ email: extraOwner.email }), null);

  const rejectedLogin = browser();
  await rejectedLogin.get('/login');
  const invalid = { email: first.email, password: 'LocalFixtureWrongPassword' };
  assert.equal((await rejectedLogin.post('/login', invalid, { csrf: false })).status, 403);
  for (let i = 0; i < 2; i++) assert.equal((await rejectedLogin.post('/login', invalid)).status, 401);
  const freshSession = browser();
  await freshSession.get('/login');
  assertLimited(await freshSession.post('/login', { ...invalid, email: ' FIRST@RATE.TEST ' }), 60);

  // Khách khác cùng IP vẫn đăng nhập được cho đến giới hạn chung của IP.
  const customer = browser();
  const secondCustomerSession = browser();
  await customer.login(second.email, password);
  await secondCustomerSession.login(second.email, password);
  assertLimited(await freshSession.post('/login', { ...invalid, email: owner.email }), 60);

  const fields = time => ({
    courtId: String(court._id), date, times: time, guestName: 'Khách thử', guestPhone: '0900000080'
  });
  assert.equal((await customer.post('/bookings', fields('16:00'), { csrf: false })).status, 403);
  assert.equal((await customer.hold(fields('16:00'))).status, 303);
  assertLimited(await secondCustomerSession.hold(fields('16:30')), 3);

  const guest = browser();
  const accepted = await guest.hold(fields('16:30'));
  assert.equal(accepted.status, 303);
  assertLimited(await guest.hold({ ...fields('17:00'), guestName: 'Tên khác' }), 3);
  assert.equal((await browser().hold(fields('17:00'))).status, 303);
  const anotherGuest = browser();
  const retryAfter = assertLimited(await anotherGuest.hold(fields('17:30')), 3);
  assert.equal(await Booking.countDocuments(), 3);
  assert.equal(await SlotLock.countDocuments(), 3);
  assert.equal(await Payment.countDocuments(), 0);

  // Đường thanh toán hiện có vẫn hoạt động cho đơn đã giữ.
  const booking = bookingFromLocation(accepted.location);
  assert.equal((await guest.post(`/bookings/${booking.id}/demo-payment`, { token: booking.token })).status, 303);
  assert.equal(await Payment.countDocuments(), 1);

  await delay(retryAfter * 1000 + 25);
  assert.equal((await secondCustomerSession.hold(fields('17:30'))).status, 303);
  assert.equal((await anotherGuest.hold(fields('18:00'))).status, 303);
  assert.equal(await Booking.countDocuments(), 5);
  assert.equal(await SlotLock.countDocuments(), 5);
  assert.equal(await Payment.countDocuments(), 1);
});

async function startProxyTestApp(t, env) {
  configure(t, {
    NODE_ENV: 'test', DEMO_MODE: 'false', SESSION_SECRET: password.repeat(2),
    RATE_LIMIT_LOGIN_WINDOW_SECONDS: '60', RATE_LIMIT_LOGIN_IP_MAX: '1',
    RATE_LIMIT_LOGIN_ACCOUNT_IP_MAX: '5', ...env
  });
  const server = createApp(new session.MemoryStore()).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

class ForwardedBrowser extends TestBrowser {
  forwarded = {};

  request(path, options = {}) {
    return super.request(path, { ...options, headers: { ...options.headers, ...this.forwarded } });
  }
}

test('Kết nối trực tiếp bỏ qua header giả và production chỉ cấp cookie qua HTTPS', async t => {
  const base = await startProxyTestApp(t, { TRUST_PROXY_IPS: '' });
  const client = new ForwardedBrowser(base);
  await client.get('/login');
  client.forwarded = { 'X-Forwarded-For': '192.0.2.4', 'CF-Connecting-IP': '192.0.2.6' };
  assert.equal((await client.post('/login')).status, 400);
  client.forwarded = { 'X-Forwarded-For': '198.51.100.4', 'CF-Connecting-IP': '198.51.100.6' };
  assertLimited(await client.post('/login'), 60);

  await t.test('X-Forwarded-Proto từ kết nối không tin cậy không tạo cookie Secure', async child => {
    const production = await startProxyTestApp(child, { NODE_ENV: 'production', TRUST_PROXY_IPS: '192.0.2.1' });
    const result = await new TestBrowser(production).request('/login', { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.headers.getSetCookie(), []);
  });
});

test('Proxy đã xác minh cấp cookie Secure và giới hạn theo IP có thẩm quyền', async t => {
  const base = await startProxyTestApp(t, { NODE_ENV: 'production', TRUST_PROXY_IPS: '127.0.0.1, 10.40.0.0/24' });
  const client = new ForwardedBrowser(base);
  const from = (ip, spoof = '203.0.113.1') => {
    client.forwarded = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': `${spoof}, ${ip}, 10.40.0.3` };
  };
  from('192.0.2.10');
  const login = await client.get('/login');
  assert.match(login.headers.getSetCookie()[0], /; Secure(?:;|$)/i);
  assert.match(login.headers.getSetCookie()[0], /; HttpOnly(?:;|$)/i);
  assert.match(login.headers.getSetCookie()[0], /; SameSite=Lax(?:;|$)/i);
  assert.equal((await client.post('/login', {}, { csrf: false })).status, 403);
  assert.equal((await client.post('/login')).status, 400);
  from('::ffff:192.0.2.10', '203.0.113.2');
  assertLimited(await client.post('/login'), 60);
  from('192.0.2.11');
  assert.equal((await client.post('/login')).status, 400);

  from('2001:db8:abcd:1::10');
  assert.equal((await client.post('/login')).status, 400);
  from('2001:0DB8:abcd:0001:0:0:0:20', '203.0.113.3');
  assertLimited(await client.post('/login'), 60);
  from('2001:db8:abcd:2::10');
  assert.equal((await client.post('/login')).status, 400);
});

test('Từ chối cấu hình proxy quá rộng và ngưỡng không hợp lệ', t => {
  for (const value of ['true', '1', '0.0.0.0/0', '::/0', '192.0.2.0/33']) {
    assert.throws(() => trustedProxyAddresses(value), /TRUST_PROXY_IPS/);
  }
  configure(t, { SESSION_SECRET: password.repeat(2), RATE_LIMIT_BOOKINGS_ACTOR_MAX: '0' });
  assert.throws(() => createApp(new session.MemoryStore()), /RATE_LIMIT_BOOKINGS_ACTOR_MAX/);
});
