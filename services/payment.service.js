import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import SlotLock from '../models/SlotLock.js';
import { getBookingForViewer } from './booking.service.js';
import { effectiveHoldExpiresAt } from '../domain/booking-rules.js';
import { assertPaymentIntentIndexes } from './payment-intent-indexes.js';

function fail(status, code, message) { throw Object.assign(new Error(message), { status, code }); }
const sameId = (a, b) => String(a) === String(b);
const validText = (value, max) => typeof value === 'string' && value.trim() === value
  && value.length > 0 && value.length <= max
  && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
const instant = value => new Date(value).getTime();

function requireHold(booking, locks, now) {
  if (booking?.status === 'EXPIRED') fail(410, 'BOOKING_EXPIRED', 'Đã hết hạn giữ sân. Hãy chọn lại các ô còn trống.');
  if (!booking || booking.status !== 'HOLD' || booking.paymentStatus !== 'UNPAID' || booking.legacy) {
    fail(409, 'BOOKING_NOT_PAYABLE', 'Đơn không còn ở trạng thái giữ chỗ chưa thanh toán.');
  }
  const deadline = effectiveHoldExpiresAt(booking);
  if (!Number.isFinite(Number(deadline)) || Number(deadline) <= Number(now)) {
    fail(410, 'BOOKING_EXPIRED', 'Đã hết hạn giữ sân. Hãy chọn lại các ô còn trống.');
  }
  const slots = booking.slots;
  if (!Array.isArray(slots) || !slots.length || slots.length > 48
      || slots.some(slot => !Number.isSafeInteger(slot.priceVND) || slot.priceVND < 0
        || !Number.isFinite(instant(slot.startAt)) || instant(slot.endAt) - instant(slot.startAt) !== 1800000)
      || new Set(slots.map(slot => instant(slot.startAt))).size !== slots.length
      || !Number.isSafeInteger(booking.totalPrice) || booking.totalPrice <= 0
      || slots.reduce((sum, slot) => sum + slot.priceVND, 0) !== booking.totalPrice) {
    fail(409, 'INVALID_BOOKING_SNAPSHOT', 'Giá hoặc các ô đã lưu của đơn không hợp lệ.');
  }
  if (locks.length !== slots.length || locks.some(lock => !sameId(lock.court, booking.court)
      || !lock.expiresAt || !Number.isFinite(instant(lock.expiresAt)) || instant(lock.expiresAt) <= Number(now))
      || slots.some(slot => !locks.some(lock => instant(lock.slotStart) === instant(slot.startAt)))) {
    fail(409, 'BOOKING_LOCKS_MISSING', 'Đơn không còn giữ đủ các ô đã chọn.');
  }
  return new Date(Math.min(Number(deadline), ...locks.map(lock => instant(lock.expiresAt))));
}

function publicIntent(record) {
  const expired = instant(record.expiresAt) <= Date.now();
  const dto = {
    id: String(record._id), bookingId: String(record.booking),
    status: expired ? 'EXPIRED' : record.intentStatus,
    mode: 'demo', provider: record.provider, amountVND: record.amountVND,
    currency: record.currency, expiresAt: new Date(record.expiresAt).toISOString(),
    reconciliationCode: record.reconciliationCode,
    recipientName: record.recipient.displayName
  };
  if (record.failureCode) dto.failureCode = record.failureCode;
  // Never offer an expired, uncertain or failed checkout to the UI.
  if (dto.status === 'PENDING') {
    if (record.checkoutUrl) dto.checkoutUrl = record.checkoutUrl;
    if (record.qrPayload) dto.qrPayload = record.qrPayload;
  }
  return dto;
}

function providerRequest(record) {
  return {
    bookingId: String(record.booking), reconciliationCode: record.reconciliationCode,
    amountVND: record.amountVND, currency: record.currency,
    expiresAt: new Date(record.expiresAt).toISOString(), merchantId: record.merchantId,
    recipient: {
      bindingId: record.recipient.bindingId, recipientId: record.recipient.recipientId,
      displayName: record.recipient.displayName
    }, mode: 'demo'
  };
}

async function currentPublicIntent(record) {
  const [booking, locks] = await Promise.all([
    Booking.findById(record.booking).lean(), SlotLock.find({ booking: record.booking }).lean()
  ]);
  let usable = false;
  try {
    const deadline = requireHold(booking, locks, new Date());
    usable = record.amountVND === booking.totalPrice && instant(record.expiresAt) <= Number(deadline)
      && instant(record.expiresAt) > Date.now();
  } catch (error) {
    if (![409, 410].includes(error.status)) throw error;
  }
  const dto = publicIntent(record);
  if (!usable) {
    dto.status = 'EXPIRED';
    dto.failureCode = 'BOOKING_UNAVAILABLE';
    delete dto.checkoutUrl;
    delete dto.qrPayload;
  }
  return dto;
}

function normaliseResult(result, record, origins) {
  const uncertain = { intentStatus: 'UNKNOWN', failureCode: 'INVALID_PROVIDER_RESPONSE' };
  if (!result || typeof result !== 'object' || Array.isArray(result)) return uncertain;
  if (['NOT_FOUND', 'UNKNOWN'].includes(result.status)) {
    return { intentStatus: 'UNKNOWN', failureCode: 'PROVIDER_RESULT_UNKNOWN' };
  }
  if (result.status === 'FAILED') return { intentStatus: 'FAILED', failureCode: 'PROVIDER_REJECTED' };
  if (result.status !== 'PENDING' || result.amountVND !== record.amountVND
      || result.currency !== 'VND' || result.reconciliationCode !== record.reconciliationCode) return uncertain;
  const patch = { intentStatus: 'PENDING' };
  for (const key of ['providerPaymentId', 'externalId']) {
    if (result[key] !== undefined) {
      if (!validText(result[key], 200)) return uncertain;
      if (record[key] && record[key] !== result[key]) return uncertain;
      patch[key] = result[key];
    }
  }
  if (!patch.providerPaymentId && !patch.externalId) return uncertain;
  if (result.checkoutUrl !== undefined) {
    if (!validText(result.checkoutUrl, 2048)) return uncertain;
    let url;
    try { url = new URL(result.checkoutUrl); } catch { return uncertain; }
    if (url.protocol !== 'https:' || url.username || url.password || !origins.has(url.origin)) return uncertain;
    patch.checkoutUrl = url.href;
  }
  if (result.qrPayload !== undefined) {
    if (!validText(result.qrPayload, 4096)) return uncertain;
    patch.qrPayload = result.qrPayload;
  }
  return patch.checkoutUrl || patch.qrPayload ? patch : uncertain;
}

// The adapter and resolver are supplied by trusted server bootstrap only.
// Nothing in this module chooses a provider/recipient or reads a second mode flag.
export function createPaymentService({ adapter, resolveRecipient, getPaymentConfig, timeoutMs = 5000, retryDelayMs = 1000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
      || !Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 60000) {
    throw new Error('Thời gian chờ payment adapter không hợp lệ.');
  }

  async function context(booking) {
    if (!adapter || typeof adapter.createIntent !== 'function' || typeof resolveRecipient !== 'function'
        || typeof getPaymentConfig !== 'function') {
      fail(503, 'PAYMENT_NOT_CONFIGURED', 'Chức năng yêu cầu thanh toán chưa được cấu hình.');
    }
    let config;
    try { config = await getPaymentConfig(); }
    catch { fail(503, 'PAYMENT_NOT_CONFIGURED', 'Cấu hình thanh toán chưa sẵn sàng.'); }
    if (config?.mode === 'off') fail(403, 'PAYMENTS_DISABLED', 'Yêu cầu thanh toán đang được tắt.');
    if (config?.mode !== 'demo') fail(503, 'PAYMENTS_LIVE_DISABLED', 'Chức năng này chưa mở thanh toán thật.');
    if (!/^[a-z][a-z0-9_-]{0,49}$/.test(adapter.provider || '') || adapter.environment !== 'sandbox') {
      fail(503, 'INVALID_PAYMENT_ADAPTER', 'Cần adapter môi trường thử hợp lệ.');
    }
    let origins;
    try {
      if (!Array.isArray(adapter.checkoutOrigins) || !adapter.checkoutOrigins.length) throw new Error();
      origins = new Set(adapter.checkoutOrigins.map(value => {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.origin !== value) throw new Error();
        return url.origin;
      }));
    } catch { fail(503, 'INVALID_PAYMENT_ADAPTER', 'Cấu hình địa chỉ thanh toán không hợp lệ.'); }
    let recipient;
    try { recipient = await resolveRecipient(booking); }
    catch { fail(503, 'RECIPIENT_NOT_VERIFIED', 'Chưa thể xác minh cấu hình người nhận.'); }
    if (recipient?.verified !== true || !validText(recipient.merchantId, 128)
        || !validText(recipient.bindingId, 128) || !validText(recipient.recipientId, 128)
        || !validText(recipient.displayName, 150)
        || (recipient.facilityId && !sameId(recipient.facilityId, booking.facility?._id || booking.facility))) {
      fail(503, 'RECIPIENT_NOT_VERIFIED', 'Chưa có cấu hình người nhận đã được xác minh cho cơ sở.');
    }
    return { origins, recipient };
  }

  async function callProvider(operation, record, origins) {
    const controller = new AbortController();
    let timer;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => adapter[operation](providerRequest(record), { signal: controller.signal })),
        new Promise((resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error('Provider timeout'), { paymentTimeout: true }));
          }, timeoutMs);
        })
      ]);
      return normaliseResult(result, record, origins);
    } catch (error) {
      return { intentStatus: 'UNKNOWN', failureCode: error?.paymentTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE' };
    } finally { clearTimeout(timer); }
  }

  async function finish(record, patch, { leaseUntil } = {}) {
    const work = async value => mongoose.connection.transaction(async session => {
      const intent = await Payment.findById(record._id).session(session);
      if (!intent || !['CREATING', 'UNKNOWN'].includes(intent.intentStatus)) return intent;
      if (leaseUntil ? instant(intent.lookupLeaseUntil) !== Number(leaseUntil) : intent.lookupLeaseUntil) return intent;
      const booking = await Booking.findById(intent.booking).session(session).lean();
      const locks = await SlotLock.find({ booking: intent.booking }).session(session).lean();
      let usable = false;
      try {
        const deadline = requireHold(booking, locks, new Date());
        usable = intent.amountVND === booking.totalPrice && instant(intent.expiresAt) <= Number(deadline);
      } catch (error) {
        if (![409, 410].includes(error.status)) throw error;
      }
      Object.assign(intent, value);
      intent.lookupLeaseUntil = undefined;
      intent.nextCheckAt = new Date(Date.now() + retryDelayMs);
      if (!usable || instant(intent.expiresAt) <= Date.now()) {
        intent.intentStatus = 'EXPIRED';
        intent.failureCode = 'BOOKING_UNAVAILABLE';
      } else {
        // Serialize with normal Booking expiry/confirmation writers after I/O.
        await Booking.updateOne({ _id: intent.booking, status: 'HOLD' }, { $inc: { __v: 1 } }, { session });
      }
      if (intent.intentStatus === 'PENDING') intent.failureCode = undefined;
      await intent.save({ session });
      return intent;
    });
    try { return await work(patch); }
    catch (error) {
      if (error.code !== 11000) throw error;
      return work({ intentStatus: 'UNKNOWN', failureCode: 'PROVIDER_REFERENCE_CONFLICT' });
    }
  }

  async function recover(record, origins) {
    if (!['CREATING', 'UNKNOWN'].includes(record.intentStatus)
        || typeof adapter.lookupIntent !== 'function' || instant(record.nextCheckAt) > Date.now()) return record;
    const now = new Date();
    const leaseUntil = new Date(Number(now) + timeoutMs + 1000);
    const leased = await Payment.findOneAndUpdate({
      _id: record._id, intentStatus: { $in: ['CREATING', 'UNKNOWN'] },
      $and: [
        { $or: [{ nextCheckAt: { $exists: false } }, { nextCheckAt: { $lte: now } }] },
        { $or: [{ lookupLeaseUntil: { $exists: false } }, { lookupLeaseUntil: { $lte: now } }] }
      ]
    }, { $set: { lookupLeaseUntil: leaseUntil, nextCheckAt: new Date(Number(now) + retryDelayMs) } }, { returnDocument: 'after' });
    if (!leased) return Payment.findById(record._id);
    return finish(leased, await callProvider('lookupIntent', leased, origins), { leaseUntil });
  }

  return {
    async ensureIntent(bookingId, { user, token } = {}) {
      const visible = await getBookingForViewer(bookingId, { user, token });
      const { origins, recipient } = await context(visible);
      await assertPaymentIntentIndexes();
      const reserve = async () => mongoose.connection.transaction(async session => {
        const booking = await Booking.findById(bookingId).session(session).lean();
        const locks = await SlotLock.find({ booking: bookingId }).session(session).lean();
        const deadline = requireHold(booking, locks, new Date());
        const existing = await Payment.findOne({ booking: bookingId, type: 'INITIAL_INTENT' }).session(session);
        if (existing) {
          if (existing.amountVND !== booking.totalPrice || instant(existing.expiresAt) > Number(deadline)) {
            fail(409, 'PAYMENT_SNAPSHOT_CHANGED', 'Dữ liệu đơn đã thay đổi; yêu cầu cũ cần được đối soát.');
          }
          if (instant(existing.expiresAt) <= Date.now()) fail(410, 'BOOKING_EXPIRED', 'Yêu cầu thanh toán đã hết hạn.');
          if (existing.provider !== adapter.provider || existing.environment !== adapter.environment
              || existing.merchantId !== recipient.merchantId || existing.recipient.bindingId !== recipient.bindingId
              || existing.recipient.recipientId !== recipient.recipientId) {
            fail(409, 'PAYMENT_CONFIGURATION_CHANGED', 'Cấu hình người nhận đã đổi; yêu cầu cũ cần được đối soát.');
          }
          return { record: existing, created: false };
        }
        // Compete with expiry/confirmation on the Booking, not just an index.
        await Booking.updateOne({ _id: bookingId, status: 'HOLD' }, { $inc: { __v: 1 } }, { session });
        const now = new Date();
        if (Number(deadline) <= Number(now)) fail(410, 'BOOKING_EXPIRED', 'Đã hết hạn giữ sân.');
        const [record] = await Payment.create([{
          booking: bookingId, type: 'INITIAL_INTENT', method: 'PROVIDER', recordedBy: user?._id || null,
          amountVND: booking.totalPrice, currency: 'VND', provider: adapter.provider, environment: adapter.environment,
          merchantId: recipient.merchantId,
          recipient: { bindingId: recipient.bindingId, recipientId: recipient.recipientId, displayName: recipient.displayName },
          reconciliationCode: 'PI-' + randomBytes(16).toString('hex'),
          expiresAt: deadline, attemptedAt: now, intentStatus: 'CREATING',
          nextCheckAt: new Date(Number(now) + timeoutMs + retryDelayMs)
        }], { session });
        return { record, created: true };
      });
      let result;
      try { result = await reserve(); }
      catch (error) {
        if (error.code !== 11000) throw error;
        // Another request may have won the unique intent reservation.
        result = await reserve();
      }
      let record = result.record;
      if (result.created) {
        const patch = instant(record.expiresAt) <= Date.now()
          ? { intentStatus: 'EXPIRED', failureCode: 'BOOKING_UNAVAILABLE' }
          : await callProvider('createIntent', record, origins);
        record = await finish(record, patch);
      }
      else record = await recover(record, origins);
      return { intent: await currentPublicIntent(record), created: result.created };
    },

    async getIntent(bookingId, { user, token } = {}) {
      await getBookingForViewer(bookingId, { user, token });
      const record = await Payment.findOne({ booking: bookingId, type: 'INITIAL_INTENT' });
      if (!record) fail(404, 'PAYMENT_INTENT_NOT_FOUND', 'Đơn chưa có yêu cầu thanh toán.');
      return currentPublicIntent(record);
    }
  };
}
