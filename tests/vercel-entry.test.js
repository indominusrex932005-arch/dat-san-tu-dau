import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import mongoose from 'mongoose';
import handler from '../api/index.js';
import { TestBrowser } from './helpers/http.js';

test('Entry point Vercel thực khởi tạo DB, phục vụ EJS/static và nhận POST gốc', { timeout: 60000 }, async t => {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27029/?replicaSet=rs0&directConnection=true';
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/|\?|$)/.test(uri)) throw new Error('Chỉ dùng MongoDB tạm cục bộ.');
  const keys = ['NODE_ENV', 'PAYMENT_MODE', 'DEMO_MODE', 'DEMO_DATA_ONLY', 'DB_NAME', 'SESSION_SECRET', 'MONGODB_URI', 'VERCEL', 'TRUST_PROXY_IPS'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'production', PAYMENT_MODE: 'demo', DEMO_DATA_ONLY: 'true', VERCEL: '1',
    DB_NAME: `vercel_test_${Date.now()}_${process.pid}`, MONGODB_URI: uri,
    SESSION_SECRET: 'synthetic-vercel-local-test-session-secret-2026', TRUST_PROXY_IPS: ''
  });
  delete process.env.DEMO_MODE;
  const server = createServer(handler).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  await once(server, 'listening');
  class PlatformBrowser extends TestBrowser {
    request(path, options = {}) {
      return super.request(path, { ...options, headers: { ...options.headers, 'X-Forwarded-Proto': 'https' } });
    }
  }
  const browser = new PlatformBrowser(`http://127.0.0.1:${server.address().port}`);
  const results = await Promise.all([browser.get('/health'), browser.get('/assets/css/groups.css')]);
  assert.equal(results[0].status, 200);
  assert.deepEqual(JSON.parse(results[0].html), { status: 'ok' });
  assert.equal(results[1].status, 200);
  assert.match(results[1].headers.get('content-type'), /text\/css/);
  const form = await browser.get('/register');
  assert.equal(form.status, 200);
  assert.ok(form.headers.getSetCookie().some(cookie => cookie.includes('; Secure')));
  const password = 'SyntheticVercel2026!';
  const result = await browser.post('/register', { fullName: 'Khách demo Vercel', email: 'entry@example.test', password, confirmPassword: password });
  assert.equal(result.status, 303);
  assert.equal(result.location, '/login');
  assert.equal((await browser.login('entry@example.test', password)).status, 303);
  assert.equal((await browser.get('/my-bookings')).status, 200);
});
