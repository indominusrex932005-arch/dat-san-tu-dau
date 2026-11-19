import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import session from 'express-session';
import { createHmac } from 'node:crypto';
import createApp from '../app.js';
import User from '../models/User.js';
import {
  login,
  verifyLoginOtp,
  resendLoginOtp,
  verifyEmail,
  requestPasswordReset,
  showResetPasswordForm,
  resetPassword
} from '../controllers/auth.controller.js';
import { csrfProtection } from '../middlewares/csrf.middleware.js';
import { prepareBotCheck, verifyBotCheck } from '../middlewares/anti-bot.middleware.js';
import { createMailService } from '../services/mail.service.js';

function createMockRes() {
  const headers = new Map();
  const state = { statusCode: 200, view: null, data: null, redirected: null, headers };
  const res = {
    locals: {},
    set(name, value) {
      headers.set(name.toLowerCase(), value);
      return res;
    },
    status(code) {
      state.statusCode = code;
      return res;
    },
    render(view, data) {
      state.view = view;
      state.data = data;
      return res;
    },
    redirect(code, url) {
      state.statusCode = code;
      state.redirected = url;
      return res;
    }
  };
  return { res, state };
}

function createMockReq(body) {
  return {
    body,
    session: {
      regenerate(cb) { cb(null); },
      save(cb) { cb(null); }
    }
  };
}

test('Trang đăng nhập trả đủ header bảo mật và nút hiện/ẩn mật khẩu', async t => {
  const envKeys = ['NODE_ENV', 'PAYMENT_MODE', 'DEMO_MODE', 'SESSION_SECRET'];
  const original = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  t.after(() => {
    for (const k of envKeys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  process.env.NODE_ENV = 'test';
  process.env.PAYMENT_MODE = 'off';
  delete process.env.DEMO_MODE;
  process.env.SESSION_SECRET = 'test-auth-login-secret-0123456789abcdef';

  const app = createApp(new session.MemoryStore());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/login`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const csp = response.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get('strict-transport-security'), null);
  assert.match(html, /src="\/assets\/js\/login\.js"/);
  assert.match(html, /data-password-toggle/);
});

test('Production bật Strict-Transport-Security', async t => {
  const envKeys = ['NODE_ENV', 'PAYMENT_MODE', 'DEMO_MODE', 'SESSION_SECRET'];
  const original = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
  t.after(() => {
    for (const k of envKeys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  process.env.NODE_ENV = 'production';
  process.env.PAYMENT_MODE = 'off';
  delete process.env.DEMO_MODE;
  process.env.SESSION_SECRET = 'test-auth-login-secret-0123456789abcdef';

  const app = createApp(new session.MemoryStore());
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/login`);
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
});

test('CSRF bảo vệ cả PUT, PATCH và DELETE ngoài POST', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const req = { method, session: {}, body: {}, get: () => undefined };
    const { res, state } = createMockRes();
    let nextCalled = false;
    csrfProtection(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false, `${method} phải bị chặn khi thiếu CSRF token`);
    assert.equal(state.statusCode, 403);
  }

  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const req = { method, session: {}, body: {}, get: () => undefined };
    const { res } = createMockRes();
    let nextCalled = false;
    csrfProtection(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true, `${method} an toàn phải đi qua`);
  }
});

test('Đăng nhập vẫn chạy bcrypt.compare khi email không tồn tại để chống dò tài khoản', async t => {
  let compareCalls = 0;
  t.mock.method(User, 'findOne', () => ({ select: async () => null }));
  t.mock.method(bcrypt, 'compare', async () => {
    compareCalls++;
    return false;
  });

  const req = createMockReq({ email: 'missing@example.com', password: 'SomePassword123' });
  const { res, state } = createMockRes();
  await login(req, res);

  assert.equal(compareCalls, 1);
  assert.equal(state.statusCode, 401);
  assert.equal(state.data.errorMessage, 'Email hoặc mật khẩu không đúng.');
});

test('Khóa tạm tài khoản sau 5 lần sai mật khẩu và mở lại khi hết hạn khóa', async t => {
  const passwordHash = await bcrypt.hash('CorrectPass123!', 4);
  const record = {
    _id: '507f1f77bcf86cd799439011',
    email: 'locked@example.com',
    role: 'CUSTOMER',
    passwordHash,
    failedLoginAttempts: 0,
    loginLockedUntil: null
  };

  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...record }) }));
  t.mock.method(User, 'updateOne', async (_filter, update) => {
    if (update?.$set) Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  });

  // 4 lần sai đầu trả 401
  for (let i = 1; i <= 4; i++) {
    const { res, state } = createMockRes();
    await login(createMockReq({ email: record.email, password: 'WrongPassword' }), res);
    assert.equal(state.statusCode, 401);
    assert.equal(record.failedLoginAttempts, i);
    assert.equal(record.loginLockedUntil, null);
  }

  // Lần sai thứ 5 khóa 15 phút và trả 429 + Retry-After
  {
    const { res, state } = createMockRes();
    await login(createMockReq({ email: record.email, password: 'WrongPassword' }), res);
    assert.equal(state.statusCode, 429);
    assert.ok(Number(state.headers.get('retry-after')) > 0);
    assert.ok(record.loginLockedUntil instanceof Date && record.loginLockedUntil.getTime() > Date.now());
  }

  // Trong thời gian khóa, nhập đúng mật khẩu vẫn bị từ chối 429
  {
    const { res, state } = createMockRes();
    await login(createMockReq({ email: record.email, password: 'CorrectPass123!' }), res);
    assert.equal(state.statusCode, 429);
    assert.ok(Number(state.headers.get('retry-after')) > 0);
  }

  // Hết hạn khóa, nhập đúng mật khẩu thì đăng nhập thành công và xóa bộ đếm lỗi
  record.loginLockedUntil = new Date(Date.now() - 1000);
  {
    const { res, state } = createMockRes();
    await login(createMockReq({ email: record.email, password: 'CorrectPass123!' }), res);
    assert.equal(state.statusCode, 303);
    assert.equal(state.redirected, '/courts');
    assert.equal(record.failedLoginAttempts, 0);
    assert.equal(record.loginLockedUntil, null);
  }
});

test('Chống bot: honeypot, câu hỏi toán học và Turnstile hoạt động đúng', async () => {
  // 1. Honeypot
  const hp = await verifyBotCheck({ body: { website: 'http://spam.bot' } });
  assert.equal(hp.ok, false);
  assert.equal(hp.reason, 'HONEYPOT');

  // 2. CAPTCHA SVG cục bộ
  const req = { body: {}, session: {} };
  const { res } = createMockRes();
  prepareBotCheck(req, res, { env: { AUTH_BOT_CHALLENGE: 'true' } });
  assert.equal(res.locals.captchaEnabled, true);
  assert.match(req.session.botChallenge.answer, /^[23456789A-HJ-NP-Z]{6}$/);

  const wrong = await verifyBotCheck(
    { body: { botAnswer: 'WRONG1' }, session: req.session },
    { env: { AUTH_BOT_CHALLENGE: 'true' } }
  );
  assert.equal(wrong.ok, false);
  assert.equal(req.session.botChallenge, undefined, 'CAPTCHA phải bị hủy sau khi kiểm tra');

  prepareBotCheck(req, res, { env: { AUTH_BOT_CHALLENGE: 'true' } });
  const right = await verifyBotCheck(
    { body: { botAnswer: req.session.botChallenge.answer.toLowerCase() }, session: req.session },
    { env: { AUTH_BOT_CHALLENGE: 'true' } }
  );
  assert.equal(right.ok, true);

  // 3. Cloudflare Turnstile
  const turnstileEnv = { TURNSTILE_SITE_KEY: 'site-key', TURNSTILE_SECRET_KEY: 'secret-key' };
  const missing = await verifyBotCheck({ body: {} }, { env: turnstileEnv });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'TURNSTILE_MISSING');

  const okTurnstile = await verifyBotCheck(
    { body: { 'cf-turnstile-response': 'valid-token' }, ip: '127.0.0.1' },
    {
      env: turnstileEnv,
      fetchImpl: async () => ({ ok: true, json: async () => ({ success: true }) })
    }
  );
  assert.equal(okTurnstile.ok, true);
});

test('Quên mật khẩu và đặt lại mật khẩu bằng token hash an toàn', async t => {
  const record = {
    _id: '507f1f77bcf86cd799439022',
    fullName: 'Người Chơi',
    email: 'forgot@example.com',
    passwordHash: await bcrypt.hash('OldPassword123!', 4),
    passwordResetTokenHash: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 3,
    loginLockedUntil: new Date(Date.now() + 60000)
  };
  let sentResetUrl = null;
  const mailService = {
    async sendPasswordReset({ resetUrl }) {
      sentResetUrl = resetUrl;
      return { delivered: true };
    }
  };

  t.mock.method(User, 'findOne', query => {
    const matchesEmail = query?.email && query.email === record.email;
    const matchesToken = query?.passwordResetTokenHash
      && query.passwordResetTokenHash === record.passwordResetTokenHash
      && record.passwordResetExpiresAt
      && record.passwordResetExpiresAt.getTime() > Date.now();
    const matched = matchesEmail || matchesToken ? { ...record } : null;
    if (query?.email) return Promise.resolve(matched);
    return { select: () => ({ lean: async () => matched, then: (resolve) => resolve(matched) }) };
  });
  t.mock.method(User, 'updateOne', async (_filter, update) => {
    if (update?.$set) Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  });

  // Email không tồn tại vẫn trả thông báo chung và không gửi mail
  {
    const req = { body: { email: 'unknown@example.com' }, mailService, get: () => 'localhost:3000', protocol: 'http' };
    const { res, state } = createMockRes();
    await requestPasswordReset(req, res);
    assert.equal(state.statusCode, 200);
    assert.ok(state.data.successMessage);
    assert.equal(sentResetUrl, null);
  }

  // Email tồn tại -> tạo token hash và gửi link đặt lại mật khẩu
  {
    const req = { body: { email: record.email }, mailService, get: () => 'localhost:3000', protocol: 'http' };
    const { res, state } = createMockRes();
    await requestPasswordReset(req, res);
    assert.equal(state.statusCode, 200);
    assert.ok(sentResetUrl);
    const token = new URL(sentResetUrl).searchParams.get('token');
    assert.match(token, /^[a-f0-9]{64}$/);
    const pepper = process.env.SESSION_SECRET || 'test-only-hmac-pepper';
    assert.equal(record.passwordResetTokenHash, createHmac('sha256', pepper).update(token).digest('hex'));

    // Mở form đặt lại mật khẩu bằng token hợp lệ
    const formRes = createMockRes();
    await showResetPasswordForm({ query: { token } }, formRes.res);
    assert.equal(formRes.state.statusCode, 200);
    assert.equal(formRes.state.data.tokenValid, true);

    // Gửi mật khẩu mới -> đổi hash, xóa token và gỡ khóa tài khoản
    const resetRes = createMockRes();
    await resetPassword({
      body: { token, password: 'NewPassword123!', confirmPassword: 'NewPassword123!' }
    }, resetRes.res);
    assert.equal(resetRes.state.statusCode, 303);
    assert.equal(resetRes.state.redirected, '/login?reset=1');
    assert.equal(record.passwordResetTokenHash, null);
    assert.equal(record.failedLoginAttempts, 0);
    assert.equal(record.loginLockedUntil, null);
    assert.equal(await bcrypt.compare('NewPassword123!', record.passwordHash), true);
  }
});

test('Xác nhận đăng nhập qua email: chế độ notify và chế độ OTP 6 số', async t => {
  const prevMode = process.env.LOGIN_EMAIL_VERIFY;
  t.after(() => {
    if (prevMode === undefined) delete process.env.LOGIN_EMAIL_VERIFY;
    else process.env.LOGIN_EMAIL_VERIFY = prevMode;
  });

  const record = {
    _id: '507f1f77bcf86cd799439033',
    fullName: 'Khách Xác Thực',
    email: 'verify@example.com',
    role: 'CUSTOMER',
    passwordHash: await bcrypt.hash('VerifyPass123!', 4),
    failedLoginAttempts: 0,
    loginLockedUntil: null,
    loginOtpHash: null,
    loginOtpExpiresAt: null,
    loginOtpAttempts: 0
  };

  let alertSent = false;
  let sentOtp = null;
  const mailService = {
    async sendLoginAlert() {
      alertSent = true;
      return { delivered: true };
    },
    async sendLoginOtp({ code }) {
      sentOtp = code;
      return { delivered: true };
    }
  };

  t.mock.method(User, 'findOne', () => ({ select: async () => ({ ...record }) }));
  t.mock.method(User, 'findById', () => ({ select: async () => ({ ...record }) }));
  t.mock.method(User, 'updateOne', async (_filter, update) => {
    if (update?.$set) Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  });

  // 1. Chế độ notify: đăng nhập thành công và gửi email cảnh báo
  process.env.LOGIN_EMAIL_VERIFY = 'notify';
  {
    const req = {
      ...createMockReq({ email: record.email, password: 'VerifyPass123!' }),
      mailService,
      ip: '127.0.0.1',
      protocol: 'http',
      get: () => 'TestAgent'
    };
    const { res, state } = createMockRes();
    await login(req, res);
    assert.equal(state.statusCode, 303);
    assert.equal(state.redirected, '/courts');
    assert.equal(alertSent, true);
  }

  // 2. Chế độ OTP: chuyển sang /login/verify, gửi mã 6 số, sai mã bị 401, đúng mã mới đăng nhập
  process.env.LOGIN_EMAIL_VERIFY = 'otp';
  const reqOtp = {
    ...createMockReq({ email: record.email, password: 'VerifyPass123!' }),
    mailService
  };
  {
    const { res, state } = createMockRes();
    await login(reqOtp, res);
    assert.equal(state.statusCode, 303);
    assert.equal(state.redirected, '/login/verify');
    assert.equal(reqOtp.session.userId, undefined);
    assert.ok(reqOtp.session.pendingLogin?.userId);
    assert.match(sentOtp, /^\d{6}$/);
  }

  // Nhập sai mã OTP -> 401
  {
    const wrongCode = sentOtp === '000000' ? '111111' : '000000';
    const { res, state } = createMockRes();
    await verifyLoginOtp({ body: { code: wrongCode }, session: reqOtp.session }, res);
    assert.equal(state.statusCode, 401);
    assert.equal(record.loginOtpAttempts, 1);
  }

  // Nhập đúng mã OTP -> 303 /courts và gán session.userId
  {
    const { res, state } = createMockRes();
    await verifyLoginOtp({ body: { code: sentOtp }, session: reqOtp.session }, res);
    assert.equal(state.statusCode, 303);
    assert.equal(state.redirected, '/courts');
    assert.equal(reqOtp.session.userId, record._id);
    assert.equal(record.loginOtpHash, null);
  }
});

test('Chặn gửi lại OTP trong 60 giây, xác nhận email bằng HMAC token và lọc CRLF header', async t => {
  // 1. Cooldown gửi lại OTP
  {
    const req = {
      session: { pendingLogin: { userId: '507f1f77bcf86cd799439044', email: 'cool@example.com', lastOtpSentAt: Date.now() } }
    };
    const { res, state } = createMockRes();
    await resendLoginOtp(req, res);
    assert.equal(state.statusCode, 429);
    assert.ok(Number(state.headers.get('retry-after')) >= 1);
  }

  // 2. Xác nhận email bằng token hợp lệ
  const rawToken = 'a'.repeat(64);
  const pepper = process.env.SESSION_SECRET || 'test-only-hmac-pepper';
  const record = {
    _id: '507f1f77bcf86cd799439045',
    emailVerified: false,
    emailVerifyTokenHash: createHmac('sha256', pepper).update(rawToken).digest('hex'),
    emailVerifyExpiresAt: new Date(Date.now() + 60000)
  };
  t.mock.method(User, 'findOne', query => ({
    select: async () => (query?.emailVerifyTokenHash === record.emailVerifyTokenHash ? { _id: record._id } : null)
  }));
  t.mock.method(User, 'updateOne', async (_filter, update) => {
    if (update?.$set) Object.assign(record, update.$set);
    return { modifiedCount: 1 };
  });
  {
    const { res, state } = createMockRes();
    await verifyEmail({ query: { token: rawToken } }, res);
    assert.equal(state.statusCode, 303);
    assert.equal(state.redirected, '/login?verified=1');
    assert.equal(record.emailVerified, true);
    assert.equal(record.emailVerifyTokenHash, null);
  }

  // 3. Chống CRLF header injection trong mail service
  let sentPayload = null;
  const mail = createMailService({
    apiKey: 're_test_key',
    from: 'no-reply@example.com',
    fetchImpl: async (_url, opts) => {
      sentPayload = JSON.parse(opts.body);
      return { ok: true, status: 200 };
    }
  });
  const result = await mail.sendMail({
    to: 'user@example.com',
    subject: 'Tiêu đề\r\nBcc: attacker@evil.com',
    text: 'Nội dung',
    html: '<p>Nội dung</p>'
  });
  assert.equal(result.delivered, true);
  assert.equal(sentPayload.subject.includes('\r'), false);
  assert.equal(sentPayload.subject.includes('\n'), false);
});
