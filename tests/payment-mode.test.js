import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getPaymentConfig } from '../config/payment-mode.js';

const runFile = promisify(execFile);
const configurationError = error => error.code === 'INVALID_PAYMENT_CONFIG';

test('Mặc định off; demo được bật rõ từ env server, không trả cấu hình có thể sửa', () => {
  assert.deepEqual(getPaymentConfig({}), { mode: 'off', demoMode: false, publicDemo: false });
  assert.deepEqual(getPaymentConfig({ NODE_ENV: 'production' }), { mode: 'off', demoMode: false, publicDemo: false });
  const localDemo = getPaymentConfig({ PAYMENT_MODE: 'demo', NODE_ENV: 'development' });
  assert.deepEqual(localDemo, { mode: 'demo', demoMode: true, publicDemo: false });
  assert.ok(Object.isFrozen(localDemo));
  assert.throws(() => { localDemo.mode = 'live'; }, TypeError);
  assert.deepEqual(getPaymentConfig({
    PAYMENT_MODE: 'demo', NODE_ENV: 'production', DEMO_DATA_ONLY: 'true', DB_NAME: 'public_demo_fixture'
  }), { mode: 'demo', demoMode: true, publicDemo: true });
});

test('Production demo yêu cầu xác nhận dữ liệu thử và DB_NAME riêng được chỉ định', () => {
  for (const additions of [
    {}, { DEMO_DATA_ONLY: 'false', DB_NAME: 'public_demo_fixture' },
    { DEMO_DATA_ONLY: 'true' }, { DEMO_DATA_ONLY: 'true', DB_NAME: '   ' }
  ]) {
    assert.throws(() => getPaymentConfig({ PAYMENT_MODE: 'demo', NODE_ENV: 'production', ...additions }), configurationError);
  }
});

test('Chế độ live chưa triển khai, cờ cũ và giá trị cấu hình sai đều dừng an toàn', () => {
  for (const additions of [
    { PAYMENT_MODE: 'live' }, { PAYMENT_MODE: 'DEMO' }, { PAYMENT_MODE: 'true' },
    { PAYMENT_MODE: 'invalid-private-value' }, { DEMO_DATA_ONLY: 'yes' },
    { DEMO_MODE: 'true' }, { DEMO_MODE: 'false' }, { PAYMENT_MODE: 'demo', DEMO_MODE: 'true' }
  ]) {
    assert.throws(() => getPaymentConfig(additions), error => {
      assert.equal(error.code, 'INVALID_PAYMENT_CONFIG');
      assert.ok(!error.message.includes('invalid-private-value'));
      return true;
    });
  }
});

test('Server từ chối mode chưa hỗ trợ trước khi kết nối DB hay tải .env riêng', { timeout: 15000 }, async () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  const baseEnv = {
    ...process.env,
    NODE_ENV: 'production', SESSION_SECRET: 'synthetic-startup-test-secret-only-2026-0001',
    MONGODB_URI: 'mongodb://127.0.0.1:1/?directConnection=true', DB_NAME: 'startup_mode_fixture',
    DOTENV_CONFIG_PATH: fileURLToPath(new URL('../.facility-edit-review/no-production-test-env', import.meta.url)),
    DEMO_DATA_ONLY: 'true', PAYMENT_MODE: 'live'
  };
  delete baseEnv.DEMO_MODE;
  await assert.rejects(runFile(process.execPath, ['server.js'], { cwd, env: baseEnv, timeout: 8000 }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /PAYMENT_MODE=live chưa được triển khai/);
    assert.doesNotMatch(error.stderr, /MongoServerSelectionError|ECONNREFUSED|mongodb:\/\//);
    return true;
  });
});
