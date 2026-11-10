import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerlessHandler } from '../services/serverless-handler.js';

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } };
}

test('Serverless dùng chung startup/dọn hạn khi nhiều request cùng tới và dọn lại sau idle', async () => {
  let clock = 0, starts = 0, cleanups = 0, requests = 0;
  let finishStartup;
  const initialized = new Promise(resolve => { finishStartup = resolve; });
  const handler = createServerlessHandler({
    now: () => clock,
    initialize: async () => { starts++; await initialized; return () => { requests++; }; },
    expireHolds: async () => { cleanups++; }
  });
  const first = handler({}, response());
  const second = handler({}, response());
  await Promise.resolve();
  assert.equal(starts, 1);
  assert.equal(requests, 0);
  finishStartup();
  await Promise.all([first, second]);
  assert.deepEqual([starts, cleanups, requests], [1, 1, 2]);
  clock = 29999;
  await handler({}, response());
  assert.equal(cleanups, 1);
  clock = 600000;
  await Promise.all([handler({}, response()), handler({}, response())]);
  assert.deepEqual([starts, cleanups, requests], [1, 2, 5]);
});

test('Startup lỗi trả 503 không lộ nội dung lỗi và request sau có thể khởi tạo lại', async () => {
  let starts = 0, requests = 0;
  const handler = createServerlessHandler({
    initialize: async () => {
      if (++starts === 1) throw new Error('synthetic-private-connection-string');
      return () => { requests++; };
    },
    expireHolds: async () => {}, log() {}
  });
  const failed = response();
  await handler({}, failed);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.headers['Cache-Control'], 'no-store');
  assert.doesNotMatch(failed.body, /synthetic-private/);
  await handler({}, response());
  assert.deepEqual([starts, requests], [2, 1]);
});

test('Lỗi dọn hạn không bỏ qua bảo vệ; lần sau thử lại mà không tạo app khác', async () => {
  let cleanups = 0, starts = 0, requests = 0;
  const handler = createServerlessHandler({
    initialize: async () => { starts++; return () => { requests++; }; },
    expireHolds: async () => { if (++cleanups === 1) throw new Error('temporary'); }, log() {}
  });
  const failed = response();
  await handler({}, failed);
  assert.equal(failed.statusCode, 503);
  assert.equal(requests, 0);
  await handler({}, response());
  assert.deepEqual([starts, cleanups, requests], [1, 2, 1]);
});
