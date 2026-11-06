import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import session from 'express-session';
import createApp from '../app.js';
import { vietnamDate } from '../domain/booking-rules.js';
import { migratePaymentIntents } from '../scripts/chuan-bi-payment-intents.js';
import { createHold } from '../services/booking.service.js';
import { recordProviderReceipt } from '../services/payment-settlement.service.js';
import { createPaymentWebhookHandler } from '../services/payment-webhook.service.js';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';

const endpoint = '/webhooks/payments';
const mockSecret = 'synthetic-webhook-fixture-key';
const hiddenSentinel = 'synthetic-private-details';
const provider = 'mock-pay';
const merchantId = 'fixture-merchant';
const recipientId = 'fixture-recipient';
const receiptFilter = { type: 'PROVIDER_RECEIPT' };

function sign(rawBody, timestamp) {
  return createHmac('sha256', mockSecret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

// Fixture protocol only. A real adapter must follow the selected provider's protocol.
function verifyFixture({ rawBody, headers, receivedAt }) {
  assert.ok(Buffer.isBuffer(rawBody));
  const timestamp = headers['x-fixture-timestamp'];
  const signature = headers['x-fixture-signature'];
  if (!/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)
      || Math.abs(Number(receivedAt) - Number(timestamp)) > 60_000) return null;
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(rawBody, timestamp), 'hex'))) return null;
  return JSON.parse(rawBody.toString('utf8'));
}

test('Webhook mặc định chưa được mở và POST vẫn qua CSRF', async t => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'synthetic-webhook-test-session-secret';
  let server;
  t.after(async () => {
    if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });
  server = createApp(new session.MemoryStore()).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(response.status, 403);
  await response.text();
});

test('Webhook mock trên replica set: xác thực, đối soát và xác nhận HOLD', { timeout: 120000 }, async t => {
  let mode = 'demo';
  let verify = verifyFixture;
  let record = recordProviderReceipt;
  let verifyCalls = 0;
  let recordCalls = 0;
  const adapter = {
    provider, environment: 'sandbox',
    verifyWebhook(input) {
      verifyCalls++;
      return verify(input);
    }
  };
  const paymentWebhookHandler = createPaymentWebhookHandler({
    adapter, getPaymentConfig: () => ({ mode }), timeoutMs: 200,
    recordReceipt(event) {
      recordCalls++;
      return record(event);
    }
  });
  const environment = await createTestEnvironment({ appOptions: { paymentWebhookHandler } });
  t.after(() => environment.close());
  const db = mongoose.connection.db;
  const owner = await User.create({
    fullName: 'Chủ sân thử', email: 'owner-webhook@example.test', passwordHash: 'fixture-unused', role: 'OWNER', ownerStatus: 'APPROVED'
  });
  const facility = await Facility.create({ name: 'Cơ sở thử', address: 'Địa chỉ giả lập', phone: '0912345678', owner: owner._id });
  let sequence = 0;

  async function setupHold() {
    const index = ++sequence;
    const court = await Court.create({ name: `Sân webhook ${index}`, facility: facility._id, basePriceVND: 50000, peakPriceVND: 75000 });
    const date = vietnamDate(new Date(Date.now() + 86400000));
    const hold = await createHold({
      courtId: court._id, date, times: ['16:30', '17:30'], guestName: 'Khách thử', guestPhone: '0987654321'
    });
    const intent = await Payment.create({
      booking: hold.booking._id, type: 'INITIAL_INTENT', method: 'PROVIDER', amountVND: hold.booking.totalPrice,
      currency: 'VND', provider, environment: 'sandbox', merchantId,
      recipient: { bindingId: 'fixture-binding', recipientId, displayName: 'Cơ sở thử' },
      reconciliationCode: `PI-fixture-${index}`, expiresAt: hold.booking.holdExpiresAt, attemptedAt: new Date(),
      providerPaymentId: `provider-payment-${index}`, externalId: `external-intent-${index}`, intentStatus: 'PENDING',
      checkoutUrl: `https://sandbox.example.test/${index}`, qrPayload: 'synthetic-qr'
    });
    const event = {
      status: 'SUCCEEDED', merchantId, recipientId, transactionId: `transaction-${index}`,
      reconciliationCode: intent.reconciliationCode, providerPaymentId: intent.providerPaymentId, externalId: intent.externalId,
      receivedAmountMinor: hold.booking.totalPrice, currency: 'VND'
    };
    return { ...hold, court, date, intent, event };
  }

  async function send(event, options = {}) {
    const {
      rawBody = Buffer.from(JSON.stringify(event, null, 2) + '\n'), timestamp = Date.now(),
      signature = sign(rawBody, timestamp), path = endpoint, contentType = 'application/json', headers = {}
    } = options;
    const response = await fetch(environment.base + path, {
      method: 'POST',
      headers: { 'Content-Type': contentType, 'x-fixture-timestamp': String(timestamp), 'x-fixture-signature': signature, ...headers },
      body: rawBody
    });
    const body = await response.text();
    return { status: response.status, body, headers: response.headers };
  }

  async function outcome(event, expected) {
    const response = await send(event);
    assert.equal(response.status, 200, response.body);
    assert.deepEqual(JSON.parse(response.body), { status: expected });
    assert.equal(response.headers.has('set-cookie'), false);
    return response;
  }

  const receipts = transactionId => Payment.find({ ...receiptFilter, providerTransactionId: transactionId }).lean();
  const locksFor = booking => SlotLock.find({ booking }).sort({ slotStart: 1 }).lean();
  const snapshot = async ({ booking, intent }) => ({
    booking: await Booking.findById(booking._id).lean(), intent: await Payment.findById(intent._id).lean(),
    locks: await locksFor(booking._id)
  });

  await t.test('Thiếu unique index thì từ chối ghi, migration dry-run không đổi dữ liệu', async () => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const response = await send(fixture.event);
    assert.equal(response.status, 503, response.body);
    assert.deepEqual(await snapshot(fixture), before);
    assert.equal(await Payment.countDocuments(receiptFilter), 0);
    const preview = await migratePaymentIntents(db);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.applied, false);
    assert.deepEqual(preview.errors, []);
    assert.ok(preview.indexesToCreate.some(name => /receipt/i.test(name)));
    assert.deepEqual(await snapshot(fixture), before);
    const applied = await migratePaymentIntents(db, { apply: true });
    assert.equal(applied.applied, true);
    assert.deepEqual(await snapshot(fixture), before);
  });

  await t.test('Giữ nguyên raw bytes, từ chối thiếu/sai chữ ký và chữ ký cũ', async () => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const callCount = recordCalls;
    const rawBody = Buffer.from(JSON.stringify(fixture.event, null, 2) + '\n');
    const timestamp = Date.now();
    const validSignature = sign(rawBody, timestamp);
    const attempts = [
      { rawBody, signature: '' },
      { rawBody, signature: '0'.repeat(64) },
      { rawBody: Buffer.concat([rawBody, Buffer.from(' ')]), timestamp, signature: validSignature },
      { rawBody, timestamp: Date.now() - 120000 }
    ];
    for (const options of attempts) {
      const response = await send(fixture.event, options);
      assert.equal(response.status, 401, response.body);
      assert.equal(response.headers.has('set-cookie'), false);
    }
    assert.equal(recordCalls, callCount);
    assert.deepEqual(await snapshot(fixture), before);
    assert.deepEqual(await receipts(fixture.event.transactionId), []);
    const sessionCount = await db.collection('sessions').countDocuments();
    const response = await send(fixture.event, { rawBody, timestamp, signature: validSignature });
    assert.equal(response.status, 200, response.body);
    assert.deepEqual(JSON.parse(response.body), { status: 'APPLIED' });
    assert.equal(response.headers.has('set-cookie'), false);
    assert.equal(await db.collection('sessions').countDocuments(), sessionCount);
  });

  await t.test('Chỉ route POST chính xác dùng raw parser và miễn CSRF', async () => {
    const fixture = await setupHold();
    const calls = verifyCalls;
    const rawBody = Buffer.from(JSON.stringify(fixture.event));
    assert.equal((await send(fixture.event, { contentType: 'text/plain' })).status, 415);
    assert.equal((await send(fixture.event, { rawBody: gzipSync(rawBody), headers: { 'Content-Encoding': 'gzip' } })).status, 415);
    assert.equal((await send(fixture.event, { rawBody: Buffer.alloc(33 * 1024, 32) })).status, 413);
    for (const path of [`${endpoint}/`, '/webhooks/Payments', `${endpoint}/extra`, '/login', `/bookings/${fixture.booking._id}/payment-intents`]) {
      assert.equal((await send(fixture.event, { path })).status, 403, path);
    }
    assert.equal(verifyCalls, calls);
    assert.deepEqual(await receipts(fixture.event.transactionId), []);
  });

  await t.test('Mode off/live, callback chưa nhận tiền và dữ liệu lỗi không tạo receipt', async () => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const calls = verifyCalls;
    try {
      for (const disabledMode of ['off', 'live']) {
        mode = disabledMode;
        assert.equal((await send(fixture.event)).status, 503);
      }
    } finally { mode = 'demo'; }
    assert.equal(verifyCalls, calls);
    await outcome({ ...fixture.event, status: 'IGNORED' }, 'IGNORED');
    assert.equal((await send({ ...fixture.event, receivedAmountMinor: '125000' })).status, 400);
    assert.equal((await send({ ...fixture.event, transactionId: '' })).status, 400);
    assert.deepEqual(await snapshot(fixture), before);
    assert.deepEqual(await receipts(fixture.event.transactionId), []);
    await outcome(fixture.event, 'APPLIED');
  });

  await t.test('Số tiền thiếu/thừa, sai currency/merchant/người nhận và sai mã vào đối soát', async () => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const variants = [
      { receivedAmountMinor: fixture.event.receivedAmountMinor - 1 },
      { receivedAmountMinor: fixture.event.receivedAmountMinor + 1 },
      { currency: 'USD', receivedAmountMinor: 300 },
      { merchantId: 'another-verified-merchant' },
      { recipientId: 'other-recipient' },
      { providerPaymentId: 'wrong-provider-payment-id' },
      { externalId: 'wrong-external-intent-id' },
      { providerPaymentId: undefined, externalId: undefined },
      { reconciliationCode: 'PI-unmatched' },
      { reconciliationCode: undefined }
    ];
    for (const [index, patch] of variants.entries()) {
      const event = { ...fixture.event, ...patch, transactionId: `review-${index}` };
      await outcome(event, 'REVIEW');
      const [receipt, extra] = await receipts(event.transactionId);
      assert.equal(extra, undefined);
      assert.equal(receipt.receiptStatus, 'REVIEW');
      assert.match(receipt.reviewReason, /^[A-Z][A-Z0-9_]+$/);
      assert.equal(receipt.currency, event.currency);
      assert.equal(receipt.receivedAmountMinor, event.receivedAmountMinor);
      assert.equal(receipt.merchantId, event.merchantId);
      if (index < 3) {
        assert.equal(String(receipt.booking), String(fixture.booking._id));
        assert.equal(String(receipt.intent), String(fixture.intent._id));
      } else {
        assert.equal(receipt.booking, undefined);
        assert.equal(receipt.intent, undefined);
      }
    }
    assert.deepEqual(await snapshot(fixture), before);
  });

  await t.test('Gửi lặp song song chỉ ghi một receipt, có DTO cuối và không ghi PAID thật', async () => {
    const fixture = await setupHold();
    const event = { ...fixture.event, provider: 'forged-provider', environment: 'live', rawSecret: hiddenSentinel };
    const replies = await Promise.all(Array.from({ length: 5 }, () => send(event)));
    for (const response of replies) assert.equal(response.status, 200, response.body);
    assert.deepEqual(replies.map(response => JSON.parse(response.body).status).sort(), [
      'APPLIED', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE'
    ]);
    const [receipt, extra] = await receipts(event.transactionId);
    assert.equal(extra, undefined);
    assert.equal(receipt.receiptStatus, 'APPLIED');
    assert.equal(receipt.provider, provider);
    assert.equal(receipt.environment, 'sandbox');
    assert.doesNotMatch(JSON.stringify(receipt), new RegExp(hiddenSentinel));
    const settled = await snapshot(fixture);
    assert.equal(settled.booking.status, 'CONFIRMED');
    assert.equal(settled.booking.paymentStatus, 'DEMO_PAID');
    assert.equal(settled.booking.holdExpiresAt, undefined);
    assert.equal(settled.locks.length, 2);
    assert.ok(settled.locks.every(lock => !lock.expiresAt));
    assert.equal(settled.intent.intentStatus, 'SETTLED');
    assert.equal(await Payment.countDocuments({ booking: fixture.booking._id, type: 'INITIAL_DEMO' }), 0);
    const pollPath = `/bookings/${fixture.booking._id}/payment-intent?token=${encodeURIComponent(fixture.token)}`;
    async function assertSettledIntent() {
      const response = await fetch(environment.base + pollPath);
      assert.equal(response.status, 200);
      const { intent } = await response.json();
      assert.equal(intent.status, 'SETTLED');
      assert.equal(intent.mode, 'demo');
      assert.equal(intent.checkoutUrl, undefined);
      assert.equal(intent.qrPayload, undefined);
    }
    await assertSettledIntent();
    assert.equal((await send({ ...event, receivedAmountMinor: 1 })).status, 409);
    await outcome({ ...event, transactionId: `${event.transactionId}-extra` }, 'REVIEW');
    assert.deepEqual(await snapshot(fixture), settled);
    await Payment.updateOne({ _id: fixture.intent._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await assertSettledIntent();
  });

  await t.test('Hai mã giao dịch khác nhau đồng thời chỉ xác nhận một lần', async () => {
    const fixture = await setupHold();
    const otherId = `${fixture.event.transactionId}-second`;
    const replies = await Promise.all([send(fixture.event), send({ ...fixture.event, transactionId: otherId })]);
    for (const response of replies) assert.equal(response.status, 200, response.body);
    assert.deepEqual(replies.map(response => JSON.parse(response.body).status).sort(), ['APPLIED', 'REVIEW']);
    const stored = [...await receipts(fixture.event.transactionId), ...await receipts(otherId)];
    assert.deepEqual(stored.map(receipt => receipt.receiptStatus).sort(), ['APPLIED', 'REVIEW']);
    assert.equal((await Booking.findById(fixture.booking._id)).status, 'CONFIRMED');
  });

  await t.test('Timeout xác minh không ghi tiền dù adapter trả về muộn', async () => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const calls = recordCalls;
    let resolveLate;
    let signal;
    verify = input => {
      signal = input.signal;
      const verified = verifyFixture(input);
      return new Promise(resolve => { resolveLate = () => resolve(verified); });
    };
    try {
      const response = await send(fixture.event);
      assert.equal(response.status, 503, response.body);
      assert.equal(signal?.aborted, true);
      resolveLate();
      await setImmediate();
      assert.equal(recordCalls, calls);
      assert.deepEqual(await snapshot(fixture), before);
      assert.deepEqual(await receipts(fixture.event.transactionId), []);
    } finally { verify = verifyFixture; }
    await outcome(fixture.event, 'APPLIED');
  });

  await t.test('Lỗi DB rollback cả đơn, ô và receipt; retry sau mất phản hồi không ghi lại', async sub => {
    const fixture = await setupHold();
    const before = await snapshot(fixture);
    const transaction = mongoose.connection.transaction.bind(mongoose.connection);
    const mock = sub.mock.method(mongoose.connection, 'transaction', work => transaction(async session => {
      await work(session);
      throw new mongoose.mongo.MongoNetworkTimeoutError(hiddenSentinel);
    }));
    try {
      const response = await send(fixture.event);
      assert.equal(response.status, 503, response.body);
      assert.doesNotMatch(response.body, new RegExp(hiddenSentinel));
      assert.deepEqual(await snapshot(fixture), before);
      assert.deepEqual(await receipts(fixture.event.transactionId), []);
    } finally { mock.mock.restore(); }
    record = async event => {
      await recordProviderReceipt(event);
      throw new mongoose.mongo.MongoNetworkTimeoutError(hiddenSentinel);
    };
    try {
      assert.equal((await send(fixture.event)).status, 503);
    } finally { record = recordProviderReceipt; }
    await outcome(fixture.event, 'DUPLICATE');
    assert.equal((await receipts(fixture.event.transactionId)).length, 1);
    assert.equal((await Booking.findById(fixture.booking._id)).paymentStatus, 'DEMO_PAID');
  });

  await t.test('Chạm hạn khi cập nhật lock hoặc mất một ô đều ghi đối soát, giữ nguyên đơn', async () => {
    const crossing = await setupHold();
    const before = await snapshot(crossing);
    const deadline = Number(crossing.booking.holdExpiresAt);
    let reads = 0;
    record = event => recordProviderReceipt(event, { now: () => new Date(reads++ < 3 ? deadline - 1 : deadline) });
    try { await outcome(crossing.event, 'REVIEW'); }
    finally { record = recordProviderReceipt; }
    assert.ok(reads >= 4);
    assert.deepEqual(await snapshot(crossing), before);

    const missing = await setupHold();
    await SlotLock.deleteOne({ booking: missing.booking._id, slotStart: missing.booking.slots[0].startAt });
    const withoutSlot = await snapshot(missing);
    await outcome(missing.event, 'REVIEW');
    assert.deepEqual(await snapshot(missing), withoutSlot);
  });

  await t.test('Đúng lúc ô đầu bắt đầu vẫn không xác nhận dù hạn cũ ghi muộn hơn', async () => {
    const fixture = await setupHold();
    const firstStart = Number(fixture.booking.slots[0].startAt);
    const staleDeadline = new Date(firstStart + 60_000);
    await Booking.collection.updateOne({ _id: fixture.booking._id }, {
      $set: { createdAt: new Date(firstStart - 120_000), holdExpiresAt: staleDeadline }
    });
    await SlotLock.updateMany({ booking: fixture.booking._id }, { $set: { expiresAt: staleDeadline } });
    await Payment.updateOne({ _id: fixture.intent._id }, { $set: { expiresAt: staleDeadline } });
    const before = await snapshot(fixture);
    record = event => recordProviderReceipt(event, { now: () => new Date(firstStart) });
    try { await outcome(fixture.event, 'REVIEW'); }
    finally { record = recordProviderReceipt; }
    assert.deepEqual(await snapshot(fixture), before);
    assert.equal((await receipts(fixture.event.transactionId))[0].reviewReason, 'BOOKING_EXPIRED');
  });

  await t.test('Callback muộn chạy cùng khách mới tranh ô, không hồi sinh HOLD cũ hoặc lấy lock mới', async () => {
    const fixture = await setupHold();
    const past = new Date(Date.now() - 1000);
    await Booking.updateOne({ _id: fixture.booking._id }, { $set: { holdExpiresAt: past } });
    await SlotLock.updateMany({ booking: fixture.booking._id }, { $set: { expiresAt: past } });
    const [, rival] = await Promise.all([
      outcome(fixture.event, 'REVIEW'),
      createHold({ courtId: fixture.court._id, date: fixture.date, times: ['16:30'], guestName: 'Khách mới', guestPhone: '0901234567' })
    ]);
    const expired = await Booking.findById(fixture.booking._id).lean();
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.paymentStatus, 'UNPAID');
    assert.deepEqual(await locksFor(expired._id), []);
    const [rivalLock, extra] = await SlotLock.find({ court: fixture.court._id }).lean();
    assert.equal(extra, undefined);
    assert.equal(String(rivalLock.booking), String(rival.booking._id));
    assert.equal(Number(rivalLock.expiresAt), Number(rival.booking.holdExpiresAt));
    assert.equal((await receipts(fixture.event.transactionId))[0].receiptStatus, 'REVIEW');
  });
});
