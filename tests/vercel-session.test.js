import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment, User } from './helpers/database.js';
import { TestBrowser } from './helpers/http.js';

// Simulates Vercel's normalized HTTPS header locally, not a live hosting test.
class PlatformBrowser extends TestBrowser {
  request(path, options = {}) {
    return super.request(path, { ...options, headers: { ...options.headers, 'X-Forwarded-Proto': 'https' } });
  }
}

test('Adapter session HTTPS cấp Secure cookie, đăng ký/đăng nhập giữ CSRF khi Express không tin IP proxy', { timeout: 60000 }, async t => {
  const env = await createTestEnvironment({ nodeEnv: 'production', appOptions: { sessionProxy: true } });
  t.after(() => env.close());
  const plain = new TestBrowser(env.base);
  assert.equal((await plain.get('/register')).headers.getSetCookie().length, 0);
  const client = new PlatformBrowser(env.base);
  const page = await client.get('/register');
  const cookie = page.headers.getSetCookie().find(value => value.startsWith('dat_san_sid='));
  assert.ok(cookie);
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax']) assert.ok(cookie.includes(flag));
  const fields = { fullName: 'Khách thử serverless', email: 'serverless@example.test', password: 'SyntheticTesting2026!', confirmPassword: 'SyntheticTesting2026!' };
  assert.equal((await client.post('/register', fields, { csrf: false })).status, 403);
  assert.equal(await User.countDocuments(), 0);
  assert.equal((await client.post('/register', fields)).status, 303);
  assert.equal((await client.login(fields.email, fields.password)).status, 303);
  assert.equal((await client.get('/my-bookings')).status, 200);
});
