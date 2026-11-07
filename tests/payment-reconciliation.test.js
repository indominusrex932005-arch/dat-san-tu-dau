import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';
import { createPaymentService } from '../services/payment.service.js';
import { recordReceiptForReview } from '../services/payment-reconciliation.service.js';
import { migratePaymentIntents } from '../scripts/chuan-bi-payment-intents.js';
import PaymentReceipt from '../models/PaymentReceipt.js';
import mongoose from 'mongoose';
import { createHmac } from 'node:crypto';
import { createPaymentWebhookHandler } from '../services/payment-webhook.service.js';
import { getPaymentConfig } from '../config/payment-mode.js';

const password = 'SyntheticReconciliationFixture-2026!';
const futureDate = () => new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const ownerQueue = '/owner/payment-reconciliation';
const adminQueue = '/admin/payment-reconciliation';

test('QR reconciliation on isolated MongoDB, through the staff and booking routes', { timeout: 90000 }, async t => {
  const identity = {
    provider: 'fixture_reconciliation', environment: 'sandbox', merchantId: 'fixture-merchant',
    recipientId: 'fixture-recipient', bindingId: 'fixture-binding'
  };
  const paymentService = createPaymentService({
    adapter: {
      provider: identity.provider, environment: identity.environment, checkoutOrigins: ['https://sandbox.example.test'],
      createIntent: request => ({
        status: 'PENDING', amountVND: request.amountVND, currency: request.currency,
        reconciliationCode: request.reconciliationCode, providerPaymentId: `order-${request.bookingId}`,
        checkoutUrl: 'https://sandbox.example.test/fixture', qrPayload: 'MOCK-RECONCILIATION'
      })
    },
    resolveRecipient: () => ({ ...identity, verified: true, displayName: 'Người nhận thử nghiệm' }),
    getPaymentConfig: () => ({ mode: 'demo' })
  });
  const fixtureKey = 'synthetic-handoff-signature-key';
  const paymentWebhookHandler = createPaymentWebhookHandler({
    adapter: {
      provider: identity.provider, environment: identity.environment,
      verifyWebhook({ rawBody, headers }) {
        const expected = createHmac('sha256', fixtureKey).update(rawBody).digest('hex');
        return headers['x-fixture-signature'] === expected ? JSON.parse(rawBody) : null;
      }
    }, getPaymentConfig
  });
  const env = await createTestEnvironment({ appOptions: { paymentService, paymentWebhookHandler, paymentCheckoutEnabled: true } });
  t.after(() => env.close());
  await migratePaymentIntents(mongoose.connection.db, { apply: true });

  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, otherOwner, admin, customer] = await User.create([
    { fullName: 'Chủ sân thử', email: 'owner-review@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash },
    { fullName: 'Chủ sân khác', email: 'other-review@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash },
    { fullName: 'Quản trị thử', email: 'admin-review@example.test', role: 'ADMIN', passwordHash },
    { fullName: 'Khách thử', email: 'customer-review@example.test', role: 'CUSTOMER', passwordHash }
  ]);
  const [facility] = await Facility.create([
    { name: 'Cơ sở đối soát', address: 'Địa chỉ thử', phone: '0912345678', owner: owner._id },
    { name: 'Cơ sở khác', address: 'Địa chỉ thử khác', phone: '0987654321', owner: otherOwner._id }
  ]);
  async function login(user) {
    const browser = new TestBrowser(env.base);
    await browser.login(user.email, password);
    return browser;
  }
  const [ownerBrowser, otherBrowser, adminBrowser, customerBrowser] = await Promise.all(
    [owner, otherOwner, admin, customer].map(login)
  );
  const guest = new TestBrowser(env.base);
  const date = futureDate();
  let courtNumber = 0;

  async function createCourt() {
    return Court.create({
      facility: facility._id, name: `Sân đối soát ${++courtNumber}`, openTime: '06:00', closeTime: '22:00',
      peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000
    });
  }
  async function hold(court, browser) {
    const result = await browser.hold({
      courtId: court.id, date, times: ['08:00'], guestName: 'Khách giữ sân', guestPhone: '0912345678'
    });
    assert.equal(result.status, 303);
    return bookingFromLocation(result.location);
  }
  async function transfer(booking, transactionId, changes = {}) {
    const intent = await Payment.findOne({ booking: booking.id, type: 'INITIAL_INTENT' }).lean();
    assert.ok(intent);
    return {
      ...identity, currency: 'VND', transactionId, amountVND: intent.amountVND, receivedAt: new Date(),
      orderReference: intent.providerPaymentId, orderReferenceKind: 'providerPaymentId',
      reconciliationCode: intent.reconciliationCode, ...changes
    };
  }
  async function issueIntent(booking, browser) {
    const result = await browser.post(`/bookings/${booking.id}/payment-intents`, { token: booking.token });
    assert.equal(result.status, 201);
  }
  async function bookingSnapshot(booking) {
    return {
      booking: await Booking.findById(booking.id).lean(),
      locks: await SlotLock.find({ booking: booking.id }).sort({ _id: 1 }).lean(),
      payments: await Payment.find({ booking: booking.id }).sort({ _id: 1 }).lean()
    };
  }

  async function callback(payment, changes = {}) {
    const body = JSON.stringify({
      status: 'SUCCEEDED', merchantId: identity.merchantId, recipientId: identity.recipientId,
      transactionId: payment.transactionId, receivedAmountMinor: payment.amountVND, currency: payment.currency,
      reconciliationCode: payment.reconciliationCode, providerPaymentId: payment.orderReference, ...changes
    });
    return guest.request('/webhooks/payments', {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        'x-fixture-signature': createHmac('sha256', fixtureKey).update(body).digest('hex')
      }, body
    });
  }

  await t.test('Webhook đủ tiền xác nhận đơn và trả phiếu qua checkout; không vào hàng hoàn bất thường', async () => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    const payment = await transfer(booking, 'handoff-applied');
    const result = await callback(payment);
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.html).status, 'APPLIED');
    const status = await guest.get(`/bookings/${booking.id}/payment-status?token=${booking.token}`);
    const data = JSON.parse(status.html);
    assert.equal(data.booking.status, 'CONFIRMED');
    assert.equal(data.booking.paymentStatus, 'DEMO_PAID');
    assert.match(data.receiptUrl, /\/receipt\?token=/);
    assert.equal(data.qrImage, null);
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: payment.transactionId }), 0);
    assert.equal(JSON.parse((await callback(payment)).html).status, 'DUPLICATE');
  });

  await t.test('Webhook thiếu tiền hiện đúng cơ sở; replay không tạo khoản thứ hai hay xóa lịch sử hoàn', async () => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    const statusUrl = `/bookings/${booking.id}/payment-status?token=${booking.token}`;
    const before = JSON.parse((await guest.get(statusUrl)).html);
    assert.match(before.qrImage, /^data:image\/png;base64,/);
    assert.ok(before.intent.checkoutUrl);
    const payment = await transfer(booking, 'handoff-underpaid', { amountVND: 40000 });
    const results = await Promise.all([callback(payment), callback(payment)]);
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    assert.deepEqual(results.map(result => JSON.parse(result.html).status).sort(), ['DUPLICATE', 'REVIEW']);
    const receipt = await PaymentReceipt.findOne({ transactionId: payment.transactionId }).lean();
    assert.ok(receipt);
    assert.equal(String(receipt.facility), facility.id);
    assert.ok((await ownerBrowser.get(ownerQueue)).html.includes(receipt._id));
    assert.equal((await otherBrowser.get(`${ownerQueue}/${receipt._id}`)).status, 404);
    assert.match((await guest.get(booking.checkout)).html, /QR thử nghiệm đang được đối soát/);
    const status = await guest.get(statusUrl);
    const data = JSON.parse(status.html);
    assert.equal(data.reviewStatus, 'IN_REVIEW');
    assert.equal(data.booking.status, 'HOLD');
    assert.equal(data.qrImage, null);
    assert.equal(data.intent.qrPayload, undefined);
    assert.equal(data.intent.checkoutUrl, undefined);
    assert.ok(!status.html.includes(payment.transactionId));
    assert.equal((await ownerBrowser.post(`${ownerQueue}/${receipt._id}`, {
      action: 'REFUND_RECORDED', reference: 'HANDOFF-REFUND', reason: 'Đã kiểm tra khoản hoàn thử',
      amountVND: '10000', evidenceChecked: 'yes'
    })).status, 303);
    assert.equal((await callback(payment)).status, 200);
    const saved = await PaymentReceipt.findById(receipt._id).lean();
    assert.equal(saved.refundedVND, 10000);
    assert.equal(saved.history.length, 1);
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: payment.transactionId }), 1);
    assert.equal((await callback(payment, { receivedAmountMinor: 45000 })).status, 409);
    assert.equal((await Booking.findById(booking.id).lean()).status, 'HOLD');
  });

  await t.test('Ghi hàng đối soát lỗi trả 503; callback lặp phục hồi từ biên nhận bền vững', async () => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    const payment = await transfer(booking, 'handoff-retry', { amountVND: 49000 });
    const original = PaymentReceipt.create;
    PaymentReceipt.create = async () => { throw new Error('Synthetic review projection outage'); };
    try { assert.equal((await callback(payment)).status, 503); }
    finally { PaymentReceipt.create = original; }
    assert.equal(await Payment.countDocuments({ type: 'PROVIDER_RECEIPT', providerTransactionId: payment.transactionId }), 1);
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: payment.transactionId }), 0);
    const retry = await callback(payment);
    assert.equal(retry.status, 200);
    assert.equal(JSON.parse(retry.html).status, 'DUPLICATE');
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: payment.transactionId }), 1);
    assert.equal((await Booking.findById(booking.id).lean()).status, 'HOLD');
  });

  await t.test('Khoản sai người nhận hoặc đơn vị tiền chỉ hiện cho ADMIN, không ghi hoàn VND cho ngoại tệ', async () => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    for (const changes of [
      { transactionId: 'handoff-wrong-recipient', recipientId: 'other-recipient' },
      { transactionId: 'handoff-foreign', currency: 'USD' }
    ]) {
      const payment = await transfer(booking, changes.transactionId);
      assert.equal((await callback(payment, changes)).status, 200);
      const receipt = await PaymentReceipt.findOne({ transactionId: changes.transactionId }).lean();
      assert.ok(receipt);
      assert.equal(receipt.facility, undefined);
      assert.ok(!(await ownerBrowser.get(ownerQueue)).html.includes(receipt._id));
      const page = await adminBrowser.get(`${adminQueue}/${receipt._id}`);
      assert.equal(page.status, 200);
      if (changes.currency) {
        assert.match(page.html, /USD/);
        assert.doesNotMatch(page.html, /name="action" value="REFUND_RECORDED"/);
        assert.equal((await adminBrowser.post(`${adminQueue}/${receipt._id}`, {
          action: 'REFUND_RECORDED', reference: 'DENIED-FX', reason: 'Không được đổi đơn vị tiền',
          amountVND: '100', evidenceChecked: 'yes'
        })).status, 409);
      }
    }
  });

  await t.test('Tiền tới đúng hạn hết giữ, replay và hoàn thủ công bảo toàn đơn/lock của khách thắng', async () => {
    const court = await createCourt();
    const old = await hold(court, guest);
    await issueIntent(old, guest);
    const deadline = new Date(Date.now() - 1000);
    await Booking.updateOne({ _id: old.id }, { $set: { holdExpiresAt: deadline } });
    const winner = await hold(court, customerBrowser);
    assert.equal((await customerBrowser.post(`/bookings/${winner.id}/demo-payment`)).status, 303);
    const winnerBefore = await bookingSnapshot(winner);
    const oldBefore = await bookingSnapshot(old);
    assert.equal(winnerBefore.booking.status, 'CONFIRMED');
    assert.equal(oldBefore.booking.status, 'EXPIRED');
    assert.equal(winnerBefore.locks.length, 1);
    assert.equal(oldBefore.locks.length, 0);

    const payment = await transfer(old, 'late-receipt', { receivedAt: deadline });
    const results = await Promise.all([recordReceiptForReview(payment), recordReceiptForReview(payment)]);
    const [receipt] = results;
    assert.equal(results[1].id, receipt.id);
    assert.deepEqual([...receipt.flags], ['LATE']);
    assert.equal(String(receipt.facility), facility.id);
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: payment.transactionId }), 1);
    await assert.rejects(recordReceiptForReview({ ...payment, amountVND: 51000 }), { status: 409 });
    assert.equal((await PaymentReceipt.findById(receipt.id)).amountVND, 50000);

    const ownList = await ownerBrowser.get(ownerQueue);
    assert.equal(ownList.status, 200);
    assert.match(ownList.html, /Quá hạn giữ sân/);
    assert.ok(ownList.html.includes(receipt.id));
    assert.ok((await ownerBrowser.get('/owner')).html.includes(ownerQueue));
    assert.ok((await adminBrowser.get('/admin')).html.includes(adminQueue));
    const oldReceiptUrl = `/bookings/${old.id}/receipt?token=${encodeURIComponent(old.token)}`;
    const guestPage = await guest.get(oldReceiptUrl);
    assert.equal(guestPage.status, 200);
    assert.match(guestPage.html, /QR thử nghiệm đang được đối soát/);
    assert.match(guestPage.html, /Đã hết hạn/);
    assert.ok(!guestPage.html.includes(payment.transactionId));
    assert.ok(!guestPage.html.includes(payment.reconciliationCode));
    assert.equal((await customerBrowser.get(`/bookings/${old.id}/receipt`)).status, 403);
    assert.doesNotMatch((await customerBrowser.get(`/bookings/${winner.id}/receipt`)).html, /QR thử nghiệm đang được đối soát/);

    const path = `${ownerQueue}/${receipt.id}`;
    const review = { action: 'REVIEWED', reference: 'CASE-1', reason: 'Đã kiểm tra thời điểm khoản đến' };
    assert.equal((await ownerBrowser.post(path, review, { csrf: false })).status, 403);
    assert.equal((await customerBrowser.post(path, { ...review, role: 'OWNER', facility: facility.id })).status, 403);
    assert.equal((await otherBrowser.get(path)).status, 404);
    assert.equal((await otherBrowser.get(`${ownerQueue}?before=${receipt.id}`)).status, 404);
    assert.equal((await otherBrowser.post(path, { ...review, facility: facility.id, actor: owner.id })).status, 404);
    assert.ok(!(await otherBrowser.get(ownerQueue)).html.includes(receipt.id));
    assert.equal((await PaymentReceipt.findById(receipt.id)).history.length, 0);
    assert.equal((await ownerBrowser.post(path, review)).location, path);
    assert.equal((await ownerBrowser.post(path, review)).status, 303);
    assert.equal((await ownerBrowser.post(path, { ...review, reason: 'Ghi đè nội dung' })).status, 409);
    assert.equal((await adminBrowser.post(`${adminQueue}/${receipt.id}`, {
      ...review, reference: 'CASE-2', reason: 'Rà soát lại bằng chứng'
    })).status, 303);

    const refund = {
      action: 'REFUND_RECORDED', reference: 'REFUND-1', reason: 'Đã đối chiếu hoàn lần đầu',
      amountVND: '20000', evidenceChecked: 'yes'
    };
    assert.equal((await ownerBrowser.post(path, { ...refund, reference: '' })).status, 400);
    assert.equal((await ownerBrowser.post(path, { ...refund, evidenceChecked: undefined })).status, 400);
    assert.equal((await ownerBrowser.post(path, { ...refund, amountVND: '50001' })).status, 409);
    const refundResponses = await Promise.all([ownerBrowser.post(path, refund), ownerBrowser.post(path, refund)]);
    assert.deepEqual(refundResponses.map(response => response.status), [303, 303]);
    let saved = await PaymentReceipt.findById(receipt.id).lean();
    assert.equal(saved.refundedVND, 20000);
    assert.equal(saved.status, 'PARTIALLY_REFUNDED');
    assert.equal(saved.history.length, 3);
    const concurrentRefunds = await Promise.all(['REFUND-2', 'REFUND-3'].map(reference => ownerBrowser.post(path, {
      ...refund, reference, amountVND: '30000'
    })));
    assert.deepEqual(concurrentRefunds.map(response => response.status).sort(), [303, 409]);
    saved = await PaymentReceipt.findById(receipt.id).lean();
    assert.equal(saved.refundedVND, 50000);
    assert.equal(saved.status, 'REFUNDED');
    assert.equal(saved.history.length, 4);
    assert.deepEqual(saved.history.map(item => String(item.actor)), [owner.id, admin.id, owner.id, owner.id]);
    assert.deepEqual(saved.history.map(item => item.amountVND), [0, 0, 20000, 30000]);
    assert.equal(saved.history[0].reason, review.reason);
    assert.ok(saved.history.every(item => item.at instanceof Date && item.reference));
    assert.equal((await recordReceiptForReview(payment)).status, 'REFUNDED');
    assert.match((await ownerBrowser.get(path)).html, /Đã ghi nhận hoàn toàn bộ/);
    assert.match((await guest.get(oldReceiptUrl)).html, /Đã ghi nhận hoàn thủ công cho khoản QR thử nghiệm/);
    assert.deepEqual(await bookingSnapshot(old), oldBefore);
    assert.deepEqual(await bookingSnapshot(winner), winnerBefore);
  });

  await t.test('Thiếu, thừa, sai tham chiếu và chưa khớp giữ riêng từng khoản đã nhận', async () => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    const before = await bookingSnapshot(booking);
    const payment = await transfer(booking, 'underpaid', { amountVND: 49999 });
    const under = await recordReceiptForReview(payment);
    const over = await recordReceiptForReview({ ...payment, transactionId: 'overpaid', amountVND: 50001 });
    const wrong = await recordReceiptForReview({ ...payment, transactionId: 'wrong-reference', reconciliationCode: 'PI-wrong' });
    const unmatched = await recordReceiptForReview({ ...payment, transactionId: 'unmatched', orderReference: 'unknown-order' });
    const wrongRecipient = await recordReceiptForReview({ ...payment, transactionId: 'wrong-recipient', bindingId: 'another-binding' });
    const unknownRecipient = await recordReceiptForReview({ ...payment, transactionId: 'unknown-recipient', bindingId: undefined });
    const malformed = await recordReceiptForReview({ ...payment, transactionId: 'malformed-reference', reconciliationCode: 'x'.repeat(101) });
    assert.equal(malformed.reconciliationCode, undefined);
    assert.deepEqual([under, over, wrong, unmatched, wrongRecipient, unknownRecipient, malformed].map(row => [...row.flags]), [
      ['UNDERPAID'], ['OVERPAID'], ['WRONG_REFERENCE'], ['UNMATCHED'], ['RECIPIENT_MISMATCH'], ['RECIPIENT_MISMATCH'], ['WRONG_REFERENCE']
    ]);
    assert.equal(new Set([under, over, wrong, unmatched, wrongRecipient, unknownRecipient, malformed].map(item => item.id)).size, 7);
    const ownerPage = await ownerBrowser.get(ownerQueue);
    assert.match(ownerPage.html, /Thiếu tiền/);
    assert.match(ownerPage.html, /Thừa tiền/);
    for (const item of [wrong, unmatched, wrongRecipient, unknownRecipient, malformed]) {
      assert.equal(item.facility, undefined);
      assert.equal(item.booking, undefined);
      assert.ok(!ownerPage.html.includes(item.id));
      assert.equal((await ownerBrowser.get(`${ownerQueue}/${item.id}`)).status, 404);
      assert.equal((await adminBrowser.get(`${adminQueue}/${item.id}`)).status, 200);
    }
    const checkout = await guest.get(booking.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /QR thử nghiệm đang được đối soát/);
    assert.doesNotMatch(checkout.html, /underpaid|overpaid|wrong-reference/);
    assert.deepEqual(await bookingSnapshot(booking), before);
  });

  await t.test('Lỗi phân loại sau ghi bền vững giữ khoản nhận và lần gửi lại hoàn tất phân loại', async sub => {
    const booking = await hold(await createCourt(), guest);
    await issueIntent(booking, guest);
    const payment = await transfer(booking, 'classification-retry');
    const fakeFailure = sub.mock.method(Payment, 'findOne', () => { throw new Error('Fixture classification failure'); });
    try {
      await assert.rejects(recordReceiptForReview(payment), /Fixture classification failure/);
    } finally {
      fakeFailure.mock.restore();
    }
    const saved = await PaymentReceipt.findOne({ transactionId: payment.transactionId }).lean();
    assert.equal(saved.amountVND, payment.amountVND);
    assert.equal(saved.status, 'UNCLASSIFIED');
    assert.equal(saved.facility, undefined);
    assert.match((await adminBrowser.get(`${adminQueue}/${saved._id}`)).html, /Chờ phân loại/);
    assert.equal((await ownerBrowser.get(`${ownerQueue}/${saved._id}`)).status, 404);
    assert.equal((await adminBrowser.post(`${adminQueue}/${saved._id}`, {
      action: 'REFUND_RECORDED', amountVND: '10000', reference: 'blocked-refund', reason: 'Chưa phân loại', evidenceChecked: 'yes'
    })).status, 409);
    const replayed = await recordReceiptForReview(payment);
    assert.equal(replayed.id, saved._id);
    assert.equal(replayed.status, 'PENDING');
    assert.deepEqual([...replayed.flags], ['UNALLOCATED']);
    assert.equal((await ownerBrowser.get(`${ownerQueue}/${saved._id}`)).status, 200);
    await assert.rejects(recordReceiptForReview({ ...payment, transactionId: 'fixture-live', environment: 'live' }), { status: 400 });
    assert.equal(await PaymentReceipt.countDocuments({ transactionId: 'fixture-live' }), 0);
  });
});
