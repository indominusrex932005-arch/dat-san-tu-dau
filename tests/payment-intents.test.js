import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';
import { createPaymentService } from '../services/payment.service.js';
import { migratePaymentIntents } from '../scripts/chuan-bi-payment-intents.js';

const password = 'SyntheticIntentFixture-2026!';
const futureDate = () => new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const secretSentinel = 'synthetic-adapter-private-value-never-return';
const denied = response => assert.ok([403, 404].includes(response.status), `Expected permission denial, got ${response.status}.`);
const dto = response => JSON.parse(response.html).intent;
const intentFilter = booking => ({ booking, type: 'INITIAL_INTENT' });
const allowlistedDTOKeys = new Set([
  'id', 'bookingId', 'status', 'mode', 'provider', 'amountVND', 'currency', 'expiresAt',
  'reconciliationCode', 'recipientName', 'checkoutUrl', 'qrPayload', 'failureCode'
]);

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function pendingResult(request, extra = {}) {
  return {
    status: 'PENDING', amountVND: request.amountVND, currency: request.currency,
    reconciliationCode: request.reconciliationCode,
    providerPaymentId: `fixture-${request.bookingId}`,
    checkoutUrl: `https://sandbox.example.test/checkout/${request.bookingId}`,
    qrPayload: `fixture-qr-${request.bookingId}`, ...extra
  };
}

test('Payment intent core: HTTP, MongoDB thật và adapter giả lập không chuyển tiền', { timeout: 120000 }, async t => {
  // This suite exercises many HOLD fixtures; the dedicated limiter suite checks production limits.
  const quotaKeys = ['RATE_LIMIT_BOOKINGS_IP_MAX', 'RATE_LIMIT_BOOKINGS_ACTOR_MAX'];
  const previousQuotas = Object.fromEntries(quotaKeys.map(key => [key, process.env[key]]));
  for (const key of quotaKeys) process.env[key] = '1000';
  t.after(() => {
    for (const key of quotaKeys) {
      if (previousQuotas[key] === undefined) delete process.env[key];
      else process.env[key] = previousQuotas[key];
    }
  });
  let mode = 'demo';
  let recipientVerified = true;
  let binding = { bindingId: 'fixture-binding-1', recipientId: 'fixture-recipient-1', displayName: 'Cơ sở dữ liệu thử', merchantId: 'fixture-merchant-1' };
  const createCalls = [], lookupCalls = [], resolverCalls = [];
  let createBehavior = request => pendingResult(request);
  let lookupBehavior = request => pendingResult(request);
  const adapter = {
    provider: 'fixture_provider', environment: 'sandbox', checkoutOrigins: ['https://sandbox.example.test'],
    async createIntent(request, options) {
      createCalls.push(structuredClone(request));
      return createBehavior(request, options);
    },
    async lookupIntent(request, options) {
      lookupCalls.push(structuredClone(request));
      return lookupBehavior(request, options);
    }
  };
  const resolveRecipient = async booking => {
    resolverCalls.push(String(booking._id));
    return { verified: recipientVerified, ...binding };
  };
  const options = { adapter, resolveRecipient, getPaymentConfig: () => ({ mode }), timeoutMs: 500, retryDelayMs: 25 };
  const service = createPaymentService(options);
  const environment = await createTestEnvironment({ appOptions: { paymentService: service } });
  t.after(() => environment.close());
  await migratePaymentIntents(mongoose.connection.db, { apply: true });

  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, otherOwner, customer, otherCustomer, admin] = await User.create([
    { fullName: 'Chủ sân intent', email: 'intent-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Chủ sân khác', email: 'intent-other-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Khách intent', email: 'intent-customer@example.test', passwordHash, role: 'CUSTOMER' },
    { fullName: 'Khách khác', email: 'intent-other-customer@example.test', passwordHash, role: 'CUSTOMER' },
    { fullName: 'Admin intent', email: 'intent-admin@example.test', passwordHash, role: 'ADMIN' }
  ]);
  const [facility] = await Facility.create([
    { name: 'Cơ sở intent', address: 'Địa chỉ thử cục bộ', phone: '0912345678', owner: owner._id },
    { name: 'Cơ sở khác', address: 'Địa chỉ khác', phone: '0987654321', owner: otherOwner._id }
  ]);
  const authenticated = async user => {
    const client = new TestBrowser(environment.base);
    await client.login(user.email, password);
    return client;
  };
  const customerClient = await authenticated(customer);
  const otherCustomerClient = await authenticated(otherCustomer);
  const ownerClient = await authenticated(owner);
  const otherOwnerClient = await authenticated(otherOwner);
  const adminClient = await authenticated(admin);
  let courtNumber = 0;

  async function hold({ client = new TestBrowser(environment.base), date = futureDate(), times = ['08:00'], ...extra } = {}) {
    const court = await Court.create({
      name: `Sân intent ${++courtNumber}`, facility: facility._id, openTime: '06:00', closeTime: '22:00',
      peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000
    });
    const result = await client.hold({ courtId: String(court._id), date, times, guestName: 'Khách dữ liệu thử', guestPhone: '0912345678', ...extra });
    assert.equal(result.status, 303, 'Fixture must create a real HOLD before requesting a payment intent.');
    return { ...bookingFromLocation(result.location), client, court };
  }

  const create = (booking, fields = {}, client = booking.client) => client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token, ...fields });
  const read = (booking, client = booking.client, token = booking.token) => client.get(`/bookings/${booking.id}/payment-intent${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  const callCount = (calls, booking) => calls.filter(item => item.bookingId === booking.id).length;
  async function snapshot(booking, { ignoreReservationMetadata = false } = {}) {
    const record = await Booking.findById(booking.id).lean();
    if (ignoreReservationMetadata) {
      // Reserving an intent may increment the Booking version to contend with expiry transactions.
      delete record.__v;
      delete record.updatedAt;
    }
    return JSON.stringify({ booking: record, locks: await SlotLock.find({ booking: booking.id }).sort({ _id: 1 }).lean() });
  }
  async function assertUnpaid(booking) {
    const record = await Booking.findById(booking.id).lean();
    assert.equal(record.paymentStatus, 'UNPAID');
    assert.notEqual(record.status, 'CONFIRMED');
    assert.equal(await Payment.countDocuments({ booking: booking.id, method: 'DEMO' }), 0);
  }

  await t.test('CSRF, guest capability, tài khoản và quyền xem hiện có đều được kiểm tra trước adapter', async () => {
    const booking = await hold();
    assert.equal((await booking.client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token }, { csrf: false })).status, 403);
    assert.equal((await create(booking, { _csrf: 'not-a-token' })).status, 403);
    const outsider = new TestBrowser(environment.base);
    await outsider.get('/login');
    denied(await create(booking, { token: 'wrong-token', role: 'ADMIN', user: String(admin._id) }, outsider));
    denied(await create(booking, { token: '' }, outsider));
    denied(await create(booking, { token: '' }, otherOwnerClient));
    assert.equal(callCount(createCalls, booking), 0);
    assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
    assert.equal((await create(booking)).status, 201);
    denied(await read(booking, outsider, 'wrong-token'));
    denied(await read(booking, otherOwnerClient, ''));
    for (const client of [ownerClient, adminClient]) {
      assert.equal((await read(booking, client, '')).status, 200);
      assert.equal((await create(booking, { token: '' }, client)).status, 200);
    }
    assert.equal(callCount(createCalls, booking), 1);

    const accountBooking = await hold({ client: customerClient });
    assert.equal(accountBooking.token, '');
    denied(await create(accountBooking, { user: String(customer._id), token: booking.token }, otherCustomerClient));
    assert.equal((await create(accountBooking)).status, 201);
    denied(await read(accountBooking, otherCustomerClient, booking.token));
    assert.equal(callCount(createCalls, accountBooking), 1);
  });

  await t.test('Mã booking sai/không tồn tại giữ lỗi400/404 và không gọi adapter', async () => {
    const before = createCalls.length;
    for (const [id, status] of [['invalid-booking-id', 400], [new mongoose.Types.ObjectId().toString(), 404]]) {
      assert.equal((await customerClient.post(`/bookings/${id}/payment-intents`, {})).status, status);
      assert.equal((await customerClient.get(`/bookings/${id}/payment-intent`)).status, status);
    }
    assert.equal(createCalls.length, before);
  });

  await t.test('Tạo đúng 100% snapshot VND và recipient từ server; DTO chỉ chứa trường công khai, không xác nhận tiền', async () => {
    const booking = await hold({ times: ['16:30', '17:00', '19:00'] });
    const before = await snapshot(booking, { ignoreReservationMetadata: true });
    await Court.updateOne({ _id: booking.court._id }, { $set: { basePriceVND: 1, peakPriceVND: 1 } });
    const originalBehavior = createBehavior;
    createBehavior = request => pendingResult(request, { rawSecret: secretSentinel, merchantSecret: secretSentinel, rawResponse: { apiKey: secretSentinel } });
    try {
      const response = await create(booking, {
        amount: 1, amountVND: 1, totalPrice: 1, currency: 'USD', owner: String(otherOwner._id),
        merchantId: 'fake-merchant', recipientId: 'fake-recipient', mode: 'live', PAYMENT_MODE: 'live',
        provider: 'client-provider', paymentStatus: 'PAID', status: 'CONFIRMED'
      });
      assert.equal(response.status, 201);
      const result = dto(response);
      assert.equal(result.status, 'PENDING');
      assert.equal(result.amountVND, 200000);
      assert.equal(result.currency, 'VND');
      assert.equal(result.mode, 'demo');
      for (const key of Object.keys(result)) assert.ok(allowlistedDTOKeys.has(key), `Unexpected public DTO key: ${key}`);
      assert.doesNotMatch(response.html, /synthetic-adapter-private-value|fixture-merchant-1|fixture-binding-1|fixture-recipient-1/);
      const request = createCalls.find(item => item.bookingId === booking.id);
      assert.equal(request.amountVND, 200000);
      assert.equal(request.currency, 'VND');
      assert.equal(request.mode, 'demo');
      assert.equal(request.merchantId, 'fixture-merchant-1');
      assert.equal(request.recipient.bindingId, 'fixture-binding-1');
      assert.equal(request.recipient.recipientId, 'fixture-recipient-1');
      assert.ok(resolverCalls.includes(booking.id));
      const stored = await Payment.findOne(intentFilter(booking.id)).lean();
      assert.equal(stored.method, 'PROVIDER');
      assert.equal(stored.intentStatus, 'PENDING');
      assert.equal(await snapshot(booking, { ignoreReservationMetadata: true }), before);
      await assertUnpaid(booking);
    } finally { createBehavior = originalBehavior; }
  });

  await t.test('GET chỉ đọc intent cục bộ, không gọi provider hoặc đổi Booking/Payment/SlotLock', async () => {
    const booking = await hold();
    assert.equal((await create(booking)).status, 201);
    const before = await snapshot(booking);
    const payment = JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean());
    const creates = createCalls.length, lookups = lookupCalls.length;
    const result = await read(booking);
    assert.equal(result.status, 200);
    assert.equal(dto(result).status, 'PENDING');
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(createCalls.length, creates);
    assert.equal(lookupCalls.length, lookups);
    assert.equal(await snapshot(booking), before);
    assert.equal(JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean()), payment);
  });

  await t.test('Đổi binding server sau khi tạo không retarget intent hoặc thu lại', async () => {
    const booking = await hold();
    assert.equal((await create(booking)).status, 201);
    const before = JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean());
    const original = binding;
    binding = { ...binding, bindingId: 'changed-binding', recipientId: 'changed-recipient', merchantId: 'changed-merchant' };
    try {
      assert.equal((await create(booking)).status, 409);
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(callCount(lookupCalls, booking), 0);
      assert.equal(JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean()), before);
      await assertUnpaid(booking);
    } finally { binding = original; }
  });

  await t.test('Giá snapshot thay đổi sau khi tạo không tái dùng intent với số tiền cũ', async () => {
    const booking = await hold();
    assert.equal((await create(booking)).status, 201);
    const before = JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean());
    // Simulate an external revision of the stored snapshot; the new total is internally consistent.
    await Booking.collection.updateOne({ _id: new mongoose.Types.ObjectId(booking.id) }, {
      $set: { totalPrice: 60000, 'slots.0.priceVND': 60000 }
    });
    assert.equal((await create(booking)).status, 409);
    assert.equal(callCount(createCalls, booking), 1);
    assert.equal(callCount(lookupCalls, booking), 0);
    assert.equal(JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean()), before);
    await assertUnpaid(booking);
  });

  await t.test('Mất một lock trong lúc provider xử lý ->410 EXPIRED, giữ ID đối soát nhưng không trả QR', async () => {
    const booking = await hold({ times: ['08:00', '08:30'] });
    createBehavior = async request => {
      await SlotLock.deleteOne({ booking: booking.id });
      return pendingResult(request);
    };
    try {
      const response = await create(booking);
      assert.equal(response.status, 410);
      const result = dto(response);
      assert.equal(result.status, 'EXPIRED');
      assert.equal(result.failureCode, 'BOOKING_UNAVAILABLE');
      assert.equal(result.checkoutUrl, undefined);
      assert.equal(result.qrPayload, undefined);
      const record = await Payment.findOne(intentFilter(booking.id)).lean();
      assert.equal(record.intentStatus, 'EXPIRED');
      assert.equal(record.providerPaymentId, `fixture-${booking.id}`);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 1);
      assert.equal(await SlotLock.countDocuments({ booking: booking.id }), 1, 'The lost lock must not be recreated.');
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(callCount(lookupCalls, booking), 0);
      await assertUnpaid(booking);
    } finally { createBehavior = request => pendingResult(request); }
  });

  await t.test('GET ẩn checkout đã lưu sau khi đơn hủy/xác nhận hoặc mất lock; không ghi DB hay gọi provider', async () => {
    for (const scenario of ['cancelled', 'confirmed', 'lost-lock']) {
      const booking = await hold({ times: ['08:00', '08:30'] });
      const created = await create(booking);
      assert.equal(created.status, 201);
      assert.ok(dto(created).checkoutUrl);
      if (scenario === 'cancelled') await Booking.updateOne({ _id: booking.id }, { $set: { status: 'CANCELLED' } });
      else if (scenario === 'confirmed') {
        const paid = await booking.client.post(`/bookings/${booking.id}/demo-payment`, { token: booking.token });
        assert.equal(paid.status, 303, 'A separate existing demo flow confirms the fixture booking.');
      } else await SlotLock.deleteOne({ booking: booking.id });
      const before = await snapshot(booking);
      const paymentsBefore = JSON.stringify(await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean());
      const creates = createCalls.length, lookups = lookupCalls.length;
      const response = await read(booking);
      assert.equal(response.status, 200, scenario);
      assert.equal(dto(response).status, 'EXPIRED', scenario);
      assert.equal(dto(response).failureCode, 'BOOKING_UNAVAILABLE', scenario);
      assert.equal(dto(response).checkoutUrl, undefined, scenario);
      assert.equal(dto(response).qrPayload, undefined, scenario);
      assert.equal(await snapshot(booking), before, scenario);
      assert.equal(JSON.stringify(await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean()), paymentsBefore, scenario);
      assert.equal(createCalls.length, creates, scenario);
      assert.equal(lookupCalls.length, lookups, scenario);
    }
  });

  await t.test('Lock có expiry sớm hơn Booking giới hạn deadline intent và yêu cầu gửi provider', async () => {
    const booking = await hold({ times: ['08:00', '08:30'] });
    const original = await Booking.findById(booking.id).lean();
    const earlier = new Date(Date.now() + 60000);
    assert.ok(Number(earlier) < Number(original.holdExpiresAt));
    await SlotLock.updateOne({ booking: booking.id }, { $set: { expiresAt: earlier } });
    const response = await create(booking);
    assert.equal(response.status, 201);
    assert.equal(dto(response).expiresAt, earlier.toISOString());
    assert.equal(createCalls.find(request => request.bookingId === booking.id).expiresAt, earlier.toISOString());
    assert.equal(Number((await Payment.findOne(intentFilter(booking.id)).lean()).expiresAt), Number(earlier));
    assert.equal(Number((await Booking.findById(booking.id).lean()).holdExpiresAt), Number(original.holdExpiresAt));
    await assertUnpaid(booking);
  });

  await t.test('Hai POST cùng đơn khi provider đang xử lý chỉ tạo một intent và gọi create một lần', async () => {
    const booking = await hold();
    const entered = deferred(), release = deferred();
    createBehavior = async request => { entered.resolve(); await release.promise; return pendingResult(request); };
    const first = create(booking);
    await entered.promise;
    try {
      const second = await create(booking);
      assert.equal(second.status, 202);
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 1);
    } finally { release.resolve(); createBehavior = request => pendingResult(request); }
    assert.equal((await first).status, 201);
    assert.equal((await create(booking)).status, 200);
    assert.equal(callCount(createCalls, booking), 1);
    await assertUnpaid(booking);
  });

  await t.test('Timeout tạo -> UNKNOWN; retry chỉ lookup mã cũ; kết quả create muộn không ghi đè', async () => {
    const booking = await hold();
    const late = deferred();
    createBehavior = () => late.promise;
    try {
      const timedOut = await create(booking);
      assert.equal(timedOut.status, 202);
      assert.equal(dto(timedOut).status, 'UNKNOWN');
      assert.equal(callCount(createCalls, booking), 1);
      await delay(40);
      const found = await create(booking);
      assert.equal(found.status, 200);
      assert.equal(dto(found).status, 'PENDING');
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(callCount(lookupCalls, booking), 1);
      assert.equal(lookupCalls.find(item => item.bookingId === booking.id).reconciliationCode, createCalls.find(item => item.bookingId === booking.id).reconciliationCode);
      const stored = JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean());
      late.resolve(pendingResult(createCalls.find(item => item.bookingId === booking.id), { providerPaymentId: 'late-result-must-not-win' }));
      await delay(20);
      assert.equal(JSON.stringify(await Payment.findOne(intentFilter(booking.id)).lean()), stored);
      await assertUnpaid(booking);
    } finally { late.resolve({ status: 'UNKNOWN' }); createBehavior = request => pendingResult(request); }
  });

  await t.test('Lookup NOT_FOUND/UNKNOWN/không có lookup không bao giờ tạo lần hai', async () => {
    const booking = await hold();
    createBehavior = () => new Promise(() => {});
    assert.equal((await create(booking)).status, 202);
    createBehavior = request => pendingResult(request);
    const originalLookup = adapter.lookupIntent;
    try {
      for (const status of ['NOT_FOUND', 'UNKNOWN']) {
        lookupBehavior = () => ({ status });
        await delay(40);
        const result = await create(booking);
        assert.equal(result.status, 202);
        assert.equal(dto(result).status, 'UNKNOWN');
      }
      adapter.lookupIntent = undefined;
      await delay(40);
      assert.equal((await create(booking)).status, 202);
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 1);
      await assertUnpaid(booking);
    } finally { adapter.lookupIntent = originalLookup; lookupBehavior = request => pendingResult(request); }
  });

  await t.test('Intent CREATING lưu dở qua restart được phục hồi bằng lookup, không gửi create nữa', async () => {
    const booking = await hold();
    createBehavior = () => new Promise(() => {});
    assert.equal((await create(booking)).status, 202);
    createBehavior = request => pendingResult(request);
    await Payment.updateOne(intentFilter(booking.id), { $set: { intentStatus: 'CREATING', nextCheckAt: new Date(0) } });
    const restarted = createPaymentService(options);
    const result = await restarted.ensureIntent(booking.id, { token: booking.token });
    assert.equal(result.created, false);
    assert.equal(result.intent.status, 'PENDING');
    assert.equal(callCount(createCalls, booking), 1);
    assert.equal(callCount(lookupCalls, booking), 1);
    await assertUnpaid(booking);
  });

  for (const [name, change] of [
    ['sai tổng tiền', result => ({ ...result, amountVND: result.amountVND + 1 })],
    ['sai currency', result => ({ ...result, currency: 'USD' })],
    ['sai mã đối soát', result => ({ ...result, reconciliationCode: 'unrelated-order' })],
    ['thiếu provider ID', result => ({ ...result, providerPaymentId: undefined })],
    ['URL HTTP', result => ({ ...result, checkoutUrl: 'http://sandbox.example.test/pay' })],
    ['URL origin khác', result => ({ ...result, checkoutUrl: 'https://attacker.example.test/pay' })],
    ['URL userinfo', result => ({ ...result, checkoutUrl: 'https://user:password@sandbox.example.test/pay' })],
    ['QR chứa ký tự điều khiển', result => ({ ...result, qrPayload: 'fixture-qr\u0000invalid' })],
    ['trạng thái PAID ngoài contract', result => ({ ...result, status: 'PAID' })]
  ]) {
    await t.test(`Phản hồi provider ${name} -> UNKNOWN, không xác nhận tiền hoặc thu lại`, async () => {
      const booking = await hold();
      createBehavior = request => change(pendingResult(request));
      try {
        const response = await create(booking);
        assert.equal(response.status, 202);
        assert.equal(dto(response).status, 'UNKNOWN');
        assert.doesNotMatch(response.html, /attacker\.example|user:password|synthetic-adapter-private/);
        assert.equal(callCount(createCalls, booking), 1);
        assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 1);
        await assertUnpaid(booking);
      } finally { createBehavior = request => pendingResult(request); }
    });
  }

  await t.test('Provider FAILED không bị biến thành PAID và replay không gọi create lại', async () => {
    const booking = await hold();
    createBehavior = () => ({ status: 'FAILED', failureCode: 'PRIVATE_VENDOR_DETAIL', message: secretSentinel, stack: secretSentinel });
    try {
      const result = await create(booking);
      assert.equal(result.status, 502);
      assert.equal(dto(result).status, 'FAILED');
      assert.doesNotMatch(result.html, /PRIVATE_VENDOR_DETAIL|synthetic-adapter-private/);
      assert.equal((await create(booking)).status, 502);
      assert.equal(callCount(createCalls, booking), 1);
      await assertUnpaid(booking);
    } finally { createBehavior = request => pendingResult(request); }
  });

  await t.test('Lỗi adapter chứa dữ liệu riêng trả UNKNOWN an toàn, không lộ exception hoặc tạo thanh toán mới', async () => {
    const booking = await hold();
    createBehavior = () => { throw new Error(secretSentinel); };
    try {
      const response = await create(booking);
      assert.equal(response.status, 202);
      assert.equal(dto(response).status, 'UNKNOWN');
      assert.doesNotMatch(response.html, /synthetic-adapter-private-value|stack|apiKey/);
      assert.equal(callCount(createCalls, booking), 1);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 1);
      await assertUnpaid(booking);
    } finally { createBehavior = request => pendingResult(request); }
  });

  await t.test('Hai đơn không được gắn cùng providerPaymentId; xung đột không xác nhận tiền', async () => {
    const first = await hold(), second = await hold();
    createBehavior = request => pendingResult(request, { providerPaymentId: 'shared-provider-id-fixture' });
    try {
      assert.equal((await create(first)).status, 201);
      const conflicting = await create(second);
      assert.ok([202, 502].includes(conflicting.status));
      assert.equal(await Payment.countDocuments({ providerPaymentId: 'shared-provider-id-fixture' }), 1);
      assert.equal(callCount(createCalls, second), 1);
      await assertUnpaid(first);
      await assertUnpaid(second);
    } finally { createBehavior = request => pendingResult(request); }
  });

  await t.test('Booking sai snapshot hoặc mất một lock không được phát yêu cầu thu tiền', async () => {
    const missingLock = await hold({ times: ['08:00', '08:30'] });
    await SlotLock.deleteOne({ booking: missingLock.id });
    assert.equal((await create(missingLock)).status, 409);
    const invalidSnapshot = await hold();
    await Booking.collection.updateOne({ _id: new mongoose.Types.ObjectId(invalidSnapshot.id) }, { $set: { totalPrice: 1 } });
    assert.ok([400, 409].includes((await create(invalidSnapshot)).status));
    for (const booking of [missingLock, invalidSnapshot]) {
      assert.equal(callCount(createCalls, booking), 0);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
      await assertUnpaid(booking);
    }
  });

  await t.test('Mode off/live, adapter không sandbox và binding chưa xác minh đều chặn create', async () => {
    const booking = await hold();
    try {
      mode = 'off';
      assert.equal((await create(booking, { mode: 'demo', PAYMENT_MODE: 'demo' })).status, 403);
      mode = 'live';
      assert.equal((await create(booking)).status, 503);
      mode = 'demo';
      adapter.environment = 'production';
      assert.equal((await create(booking)).status, 503);
      adapter.environment = 'sandbox';
      recipientVerified = false;
      assert.equal((await create(booking)).status, 503);
      assert.equal(callCount(createCalls, booking), 0);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
    } finally { mode = 'demo'; adapter.environment = 'sandbox'; recipientVerified = true; }
  });

  await t.test('Thiếu unique index intent ->503, không gọi provider; khôi phục chỉ trên DB thử sở hữu', async () => {
    const booking = await hold();
    const indexes = await Payment.collection.listIndexes().toArray();
    const uniqueBooking = indexes.find(index => index.unique && index.key.booking === 1 && index.partialFilterExpression?.type === 'INITIAL_INTENT');
    assert.ok(uniqueBooking, 'Migration must install the unique initial-intent-per-booking guard.');
    await Payment.collection.dropIndex(uniqueBooking.name);
    try {
      assert.equal((await create(booking)).status, 503);
      assert.equal(callCount(createCalls, booking), 0);
      assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
    } finally { await migratePaymentIntents(mongoose.connection.db, { apply: true }); }
  });

  await t.test('Payment DEMO cũ và đơn đã xác nhận không bị sửa khi thử tạo intent mới', async () => {
    const booking = await hold();
    const paid = await booking.client.post(`/bookings/${booking.id}/demo-payment`, { token: booking.token });
    assert.equal(paid.status, 303);
    const before = JSON.stringify(await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean());
    const bookingBefore = await snapshot(booking);
    assert.equal((await create(booking)).status, 409);
    assert.equal(JSON.stringify(await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean()), before);
    assert.equal(await snapshot(booking), bookingBefore);
    assert.equal((await Booking.findById(booking.id).lean()).paymentStatus, 'DEMO_PAID');
    assert.equal(callCount(createCalls, booking), 0);
  });

  await t.test('Hạn intent bị giới hạn bởi giờ bắt đầu; provider trả sau hạn không xác nhận hoặc gia hạn Booking', async context => {
    const date = '2030-05-10';
    const instant = time => new Date(`${date}T${time}+07:00`);
    context.mock.timers.enable({ apis: ['Date'], now: instant('15:55:00') });
    const booking = await hold({ date, times: ['16:00', '19:00'] });
    createBehavior = request => {
      assert.equal(request.expiresAt, instant('16:00:00').toISOString());
      context.mock.timers.setTime(instant('16:00:00').getTime());
      return pendingResult(request);
    };
    try {
      const response = await create(booking);
      assert.ok([200, 201, 202, 410].includes(response.status));
      const stored = await Payment.findOne(intentFilter(booking.id)).lean();
      assert.ok(stored);
      assert.equal(stored.intentStatus, 'EXPIRED');
      assert.equal(Number(stored.expiresAt), Number(instant('16:00:00')));
      assert.equal(callCount(createCalls, booking), 1);
      await assertUnpaid(booking);
      assert.ok(Number((await Booking.findById(booking.id).lean()).holdExpiresAt) <= Number(instant('16:00:00')));
    } finally { createBehavior = request => pendingResult(request); }
  });

  await t.test('Đơn đã hết hạn trước create không gọi provider hoặc tạo intent', async context => {
    const date = '2030-05-11';
    const instant = time => new Date(`${date}T${time}+07:00`);
    context.mock.timers.enable({ apis: ['Date'], now: instant('15:55:00') });
    const booking = await hold({ date, times: ['16:00'] });
    context.mock.timers.setTime(instant('16:00:00').getTime());
    assert.equal((await create(booking)).status, 410);
    assert.equal(callCount(createCalls, booking), 0);
    assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
    await assertUnpaid(booking);
  });
});

test('App mặc định không có adapter/binding trả503 sau CSRF, không tự chọn nhà cung cấp', { timeout: 30000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  await migratePaymentIntents(mongoose.connection.db, { apply: true });
  const owner = await User.create({ fullName: 'Chủ fixture chưa cấu hình', email: 'no-adapter-owner@example.test', passwordHash: 'fixture-only', role: 'OWNER', ownerStatus: 'APPROVED' });
  const facility = await Facility.create({ name: 'Cơ sở chưa adapter', address: 'Địa chỉ thử', phone: '0912345678', owner: owner._id });
  const court = await Court.create({ name: 'Sân chưa adapter', facility: facility._id, openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000 });
  const client = new TestBrowser(environment.base);
  const held = await client.hold({ courtId: String(court._id), date: futureDate(), times: ['08:00'], guestName: 'Khách fixture', guestPhone: '0912345678' });
  assert.equal(held.status, 303);
  const booking = bookingFromLocation(held.location);
  assert.equal((await client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token }, { csrf: false })).status, 403);
  const result = await client.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token, provider: 'sepay_gateway', mode: 'live' });
  assert.equal(result.status, 503);
  assert.equal(await Payment.countDocuments(intentFilter(booking.id)), 0);
  assert.equal((await Booking.findById(booking.id).lean()).paymentStatus, 'UNPAID');
});
