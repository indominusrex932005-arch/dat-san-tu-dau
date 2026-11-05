import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import session from 'express-session';
import createApp from '../app.js';
import { createPaymentService } from '../services/payment.service.js';
import { migratePaymentIntents } from '../scripts/chuan-bi-payment-intents.js';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

test('Checkout dự thảo đọc đúng quyền, QR và trạng thái máy chủ', { timeout: 30000 }, async t => {
  let createCalls = 0;
  let lookupCalls = 0;
  let createStatus = 'PENDING';
  const service = createPaymentService({
    adapter: {
      provider: 'ui_fixture', environment: 'sandbox', checkoutOrigins: ['https://sandbox.example.invalid'],
      createIntent: async request => {
        createCalls++;
        return { status: createStatus, amountVND: request.amountVND, currency: 'VND',
          reconciliationCode: request.reconciliationCode, providerPaymentId: 'fixture-' + request.bookingId,
          qrPayload: 'UI-TEST-ONLY-' + request.bookingId,
          checkoutUrl: 'https://sandbox.example.invalid/pay/' + request.bookingId };
      },
      lookupIntent: async () => { lookupCalls++; return { status: 'UNKNOWN' }; }
    },
    resolveRecipient: async () => ({
      verified: true, merchantId: 'fixture-merchant', bindingId: 'fixture-binding',
      recipientId: 'fixture-recipient', displayName: 'Người nhận thử nghiệm'
    }),
    getPaymentConfig: () => ({ mode: 'demo' })
  });
  const env = await createTestEnvironment({ appOptions: { paymentService: service, paymentCheckoutEnabled: true } });
  t.after(() => env.close());
  await migratePaymentIntents(mongoose.connection.db, { apply: true });
  const owner = await User.create({ fullName: 'Chủ sân thử', email: 'owner@ui87.invalid',
    passwordHash: 'fixture-only', role: 'OWNER', ownerStatus: 'APPROVED' });
  const facility = await Facility.create({ name: 'Cơ sở thử', address: 'Địa chỉ thử', phone: '0900000087', owner: owner._id });
  const date = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  let number = 0;
  async function hold() {
    const court = await Court.create({ name: 'Sân UI ' + ++number, facility: facility._id,
      basePriceVND: 50000, peakPriceVND: 75000 });
    const client = new TestBrowser(env.base);
    const response = await client.hold({ courtId: String(court._id), date, times: ['16:30', '18:00'],
      guestName: 'Khách UI', guestPhone: '0900000087' });
    assert.equal(response.status, 303);
    return { ...bookingFromLocation(response.location), client };
  }
  const read = (booking, client = booking.client, token = booking.token) =>
    client.get(`/bookings/${booking.id}/payment-status?token=${encodeURIComponent(token)}`);
  const create = booking => booking.client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token });
  const state = response => JSON.parse(response.html);
  const snapshot = async booking => JSON.stringify({
    booking: await Booking.findById(booking.id).lean(),
    locks: await SlotLock.find({ booking: booking.id }).sort({ _id: 1 }).lean(),
    payments: await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean()
  });

  const booking = await hold();
  const checkout = await booking.client.get(booking.checkout);
  assert.equal(checkout.status, 200);
  assert.match(checkout.html, /payment-checkout\.js/);
  assert.match(checkout.html, /Thử nghiệm Sandbox/);
  assert.doesNotMatch(checkout.html, /qr-minh-hoa\.svg/);
  assert.match(checkout.html, /Mô phỏng thanh toán toàn bộ/);
  assert.match(checkout.html, /action="\/bookings\/[a-f0-9]+\/payment-intents" method="POST"/);

  await t.test('GET chỉ đọc, không tự tạo intent khi mở hoặc tải lại checkout', async () => {
    const before = await snapshot(booking);
    for (let i = 0; i < 3; i++) {
      const result = await read(booking);
      assert.equal(result.status, 200);
      assert.equal(state(result).intent, null);
      assert.equal(state(result).qrImage, null);
      assert.equal(state(result).booking.amountVND, 125000);
      assert.ok(Date.parse(state(result).holdUntil) > Date.parse(state(result).serverNow));
    }
    assert.equal(createCalls, 0);
    assert.equal(lookupCalls, 0);
    assert.equal(await snapshot(booking), before);
  });

  await t.test('QR xuất phát từ intent đã lưu, đúng tổng giá và không lộ thông tin xác thực', async () => {
    assert.equal((await booking.client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token }, { csrf: false })).status, 403);
    assert.equal((await create(booking)).status, 201);
    const before = await snapshot(booking);
    for (let i = 0; i < 3; i++) {
      const response = await read(booking);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const data = state(response);
      assert.equal(data.booking.status, 'HOLD');
      assert.equal(data.intent.status, 'PENDING');
      assert.equal(data.intent.amountVND, 125000);
      assert.equal(data.intent.currency, 'VND');
      assert.equal(data.intent.recipientName, 'Người nhận thử nghiệm');
      assert.equal(data.receiptUrl, undefined);
      const png = Buffer.from(data.qrImage.split(',')[1], 'base64');
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.ok(Date.parse(data.holdUntil) <= Date.parse(data.intent.expiresAt));
      assert.doesNotMatch(response.html, /guestTokenHash|merchantId|bindingId|providerPaymentId|fixture-merchant/);
      assert.ok(!response.html.includes(booking.token));
    }
    assert.equal(createCalls, 1);
    assert.equal(lookupCalls, 0);
    assert.equal(await snapshot(booking), before);
  });

  await t.test('Sai capability và phiên khác không đọc được trạng thái hoặc QR', async () => {
    const outsider = new TestBrowser(env.base);
    for (const token of ['', 'incorrect']) assert.equal((await read(booking, outsider, token)).status, 403);
    const anotherBooking = await hold();
    assert.equal((await read(anotherBooking, booking.client, booking.token)).status, 403);
  });

  await t.test('Provider lỗi không có QR hoặc phiếu xác nhận', async () => {
    createStatus = 'FAILED';
    const failed = await hold();
    assert.equal((await create(failed)).status, 502);
    const data = state(await read(failed));
    assert.equal(data.intent.status, 'FAILED');
    assert.equal(data.qrImage, null);
    assert.equal(data.intent.checkoutUrl, undefined);
    assert.equal(data.receiptUrl, undefined);
    assert.equal(data.booking.paymentStatus, 'UNPAID');
    createStatus = 'PENDING';
  });

  await t.test('Hết hạn bỏ QR/link, không tạo Payment xác nhận hoặc cấp lại ô', async () => {
    const expired = await hold();
    await create(expired);
    await Booking.updateOne({ _id: expired.id }, { $set: { holdExpiresAt: new Date(Date.now() - 1) } });
    const data = state(await read(expired));
    assert.equal(data.booking.status, 'EXPIRED');
    assert.equal(data.intent, null);
    assert.equal(data.qrImage, null);
    assert.equal(data.receiptUrl, undefined);
    assert.equal(await SlotLock.countDocuments({ booking: expired.id }), 0);
    assert.equal(await Payment.countDocuments({ booking: expired.id, method: 'DEMO' }), 0);
  });

  await t.test('Chỉ trả link phiếu khi server đã xác nhận Booking và tiền', async () => {
    const payment = await booking.client.post(`/bookings/${booking.id}/demo-payment`, { token: booking.token });
    assert.equal(payment.status, 303);
    const data = state(await read(booking));
    assert.equal(data.booking.status, 'CONFIRMED');
    assert.equal(data.booking.paymentStatus, 'DEMO_PAID');
    assert.equal(data.qrImage, null);
    assert.equal(data.receiptUrl, `/bookings/${booking.id}/receipt?token=${booking.token}`);
    const receipt = await booking.client.get(data.receiptUrl);
    assert.match(receipt.html, /THANH TOÁN MÔ PHỎNG/);
    assert.match(receipt.html, /In \/ Lưu PDF/);
  });

  await t.test('Bootstrap mặc định tiếp tục checkout mô phỏng và ẩn route thử nghiệm', async () => {
    const server = createApp(new session.MemoryStore()).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const client = new TestBrowser('http://127.0.0.1:' + server.address().port);
      const result = await client.hold({ courtId: String((await Court.findOne())._id), date, times: ['19:00'],
        guestName: 'Khách cũ', guestPhone: '0900000087' });
      assert.equal(result.status, 303);
      const old = bookingFromLocation(result.location);
      const page = await client.get(old.checkout);
      assert.match(page.html, /qr-minh-hoa\.svg/);
      assert.doesNotMatch(page.html, /id="provider-payment-panel"/);
      assert.equal((await client.get(`/bookings/${old.id}/payment-status?token=${old.token}`)).status, 404);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
});

test('UI dự thảo chỉ được bật bằng cấu hình server trong môi trường demo', t => {
  const settings = { DEMO_MODE: 'false', SESSION_SECRET: 'local-ui-bootstrap-only-secret-2026-123456789' };
  const previous = Object.fromEntries(Object.keys(settings).map(name => [name, process.env[name]]));
  Object.assign(process.env, settings);
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  assert.throws(() => createApp(new session.MemoryStore(), { paymentCheckoutEnabled: true }), /môi trường demo thử nghiệm/);
});
