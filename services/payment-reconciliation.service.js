import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Facility from '../models/Facility.js';
import Payment from '../models/Payment.js';
import PaymentReceipt from '../models/PaymentReceipt.js';
import { effectiveHoldExpiresAt, RuleError } from '../domain/booking-rules.js';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

const validText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max
  && value.trim() === value && !/\p{Cc}/u.test(value);
const validReference = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$/.test(value);
const positiveAmount = value => Number.isSafeInteger(value) && value > 0;
const sameId = (a, b) => String(a) === String(b);

function receiptSnapshot(input) {
  const { provider, environment, merchantId, recipientId, bindingId, transactionId,
    orderReference, orderReferenceKind, reconciliationCode, currency, amountVND, receivedAt,
    receivedAmountMinor = amountVND } = input ?? {};
  if (typeof provider !== 'string' || !/^[a-z][a-z0-9_-]{0,49}$/.test(provider)
      || environment !== 'sandbox' || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)
      || !positiveAmount(receivedAmountMinor)
      || currency === 'VND' && (!positiveAmount(amountVND) || amountVND !== receivedAmountMinor)
      || !validText(merchantId, 128) || !validText(transactionId, 200)
      || !(receivedAt instanceof Date) || !Number.isFinite(+receivedAt)) {
    fail(400, 'Dữ liệu khoản nhận đã xác minh không hợp lệ.');
  }
  const hasOrder = validText(orderReference, 200) && ['providerPaymentId', 'externalId'].includes(orderReferenceKind);
  return {
    provider, environment, merchantId, transactionId, currency, receivedAmountMinor,
    amountVND: currency === 'VND' ? amountVND : undefined, receivedAt,
    recipientId: validText(recipientId, 128) ? recipientId : undefined,
    bindingId: validText(bindingId, 128) ? bindingId : undefined,
    orderReference: hasOrder ? orderReference : undefined,
    orderReferenceKind: hasOrder ? orderReferenceKind : undefined,
    reconciliationCode: validText(reconciliationCode, 100) ? reconciliationCode : undefined
  };
}

async function classify(receipt) {
  if (receipt.currency !== 'VND') return { flags: ['CURRENCY_MISMATCH'] };
  const { provider, environment, merchantId, orderReference, orderReferenceKind } = receipt;
  const intent = orderReference && await Payment.findOne({
    type: 'INITIAL_INTENT', provider, environment, merchantId, [orderReferenceKind]: orderReference
  }).select('booking reconciliationCode recipient amountVND expiresAt').lean();
  if (!intent) return { flags: ['UNMATCHED'] };
  if (!receipt.recipientId || !receipt.bindingId || intent.recipient?.recipientId !== receipt.recipientId
      || intent.recipient?.bindingId !== receipt.bindingId) {
    return { flags: ['RECIPIENT_MISMATCH'] };
  }
  if (!receipt.reconciliationCode || intent.reconciliationCode !== receipt.reconciliationCode) {
    return { flags: ['WRONG_REFERENCE'] };
  }
  const booking = await Booking.findById(intent.booking).select('facility status slots holdExpiresAt createdAt').lean();
  if (!booking?.facility) return { flags: ['UNMATCHED'] };

  const flags = [];
  if (receipt.amountVND < intent.amountVND) flags.push('UNDERPAID');
  if (receipt.amountVND > intent.amountVND) flags.push('OVERPAID');
  try {
    const deadline = Math.min(+effectiveHoldExpiresAt(booking), +intent.expiresAt);
    if (booking.status === 'EXPIRED' || +receipt.receivedAt >= deadline || +receipt.createdAt >= deadline) {
      flags.push('LATE');
    }
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    flags.push('INVALID_DEADLINE');
  }
  if (!flags.length) flags.push('UNALLOCATED');
  return { flags, booking: booking._id, facility: booking.facility, expectedAmountVND: intent.amountVND };
}

// Server-only handoff for a verified transfer that was not allocated. Run outside any
// callback/booking transaction, and acknowledge only after the durable write succeeds.
export async function recordReceiptForReview(verifiedTransfer) {
  const snapshot = receiptSnapshot(verifiedTransfer);
  const { provider, environment, merchantId, transactionId } = snapshot;
  const _id = createHash('sha256').update(JSON.stringify([provider, environment, merchantId, transactionId])).digest('hex');
  let receipt;
  try {
    receipt = await PaymentReceipt.create({ _id, ...snapshot });
  } catch (error) {
    if (error.code !== 11000) throw error;
    receipt = await PaymentReceipt.findById(_id).readConcern('majority');
    if (!receipt) throw error;
    if (Object.entries(snapshot).some(([key, value]) => key === 'receivedAt'
      ? +value !== +receipt[key]
      : key === 'receivedAmountMinor' ? value !== (receipt[key] ?? receipt.amountVND) : value !== receipt[key])) {
      fail(409, 'Dữ liệu nhận lại mâu thuẫn với khoản đã lưu.');
    }
  }
  if (receipt.status !== 'UNCLASSIFIED') return receipt;
  const result = await classify(receipt);
  const classified = await PaymentReceipt.findOneAndUpdate({ _id, status: 'UNCLASSIFIED' }, {
    $set: { ...result, status: 'PENDING' }
  }, { returnDocument: 'after' });
  if (classified) return classified;
  const concurrent = await PaymentReceipt.findById(_id).readConcern('majority');
  if (concurrent && concurrent.status !== 'UNCLASSIFIED') return concurrent;
  fail(503, 'Khoản nhận đã lưu và đang chờ xác nhận phân loại.');
}

async function scopeFor(user, session = null) {
  if (!user?._id) fail(403, 'Bạn không có quyền đối soát.');
  if (user.role === 'ADMIN') return {};
  if (user.role !== 'OWNER' || user.ownerStatus !== 'APPROVED') fail(403, 'Bạn không có quyền đối soát.');
  const facility = await Facility.findOne({ owner: user._id }).select('_id').session(session).lean();
  if (!facility) fail(403, 'Tài khoản chưa được cấp cơ sở quản lý.');
  return { facility: facility._id };
}

function receiptId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) fail(404, 'Không tìm thấy khoản đối soát.');
  return id;
}

export async function listPaymentReceipts(user, before) {
  const scope = await scopeFor(user);
  // The cursor is a record in the same scope, so it cannot expose another facility's data.
  const cursor = before ? await PaymentReceipt.findOne({ ...scope, _id: receiptId(before) }).select('createdAt').lean() : null;
  if (before && !cursor) fail(404, 'Không tìm thấy trang đối soát.');
  const filter = cursor ? { ...scope, $or: [
    { createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }
  ] } : scope;
  const items = await PaymentReceipt.find(filter).select('-history').sort({ createdAt: -1, _id: -1 }).limit(21)
    .populate('facility', 'name').populate('booking', 'publicCode status').lean();
  return { items: items.slice(0, 20), next: items.length > 20 ? items[19]._id : null };
}

export async function getPaymentReceipt(id, user) {
  const receipt = await PaymentReceipt.findOne({ ...await scopeFor(user), _id: receiptId(id) })
    .populate('facility', 'name').populate('booking', 'publicCode status').populate('history.actor', 'fullName').lean();
  if (!receipt) fail(404, 'Không tìm thấy khoản đối soát.');
  return receipt;
}

export async function bookingReceiptReviewStatus(booking) {
  if (!booking.facility?._id) return null;
  const statuses = await PaymentReceipt.distinct('status', { booking: booking._id, facility: booking.facility._id });
  if (!statuses.length) return null;
  return statuses.every(status => status === 'REFUNDED') ? 'REFUNDED' : 'IN_REVIEW';
}

export async function appendPaymentReview(id, user, body = {}) {
  const { action, reference, reason } = body;
  const refund = action === 'REFUND_RECORDED';
  const rawAmount = typeof body.amountVND === 'string' ? body.amountVND : '';
  const amountVND = refund ? Number(rawAmount) : 0;
  if ((!refund && action !== 'REVIEWED') || !validReference(reference) || !validText(reason, 500)
      || refund && (!/^\d{1,16}$/.test(rawAmount) || !positiveAmount(amountVND) || body.evidenceChecked !== 'yes')) {
    fail(400, 'Cần nhập lý do và mã đối soát. Khi ghi nhận hoàn, hãy nhập số tiền hợp lệ và xác nhận đã kiểm tra bằng chứng.');
  }
  return mongoose.connection.transaction(async session => {
    const receipt = await PaymentReceipt.findOne({ ...await scopeFor(user, session), _id: receiptId(id) }).session(session);
    if (!receipt) fail(404, 'Không tìm thấy khoản đối soát.');
    if (refund && receipt.currency !== 'VND') fail(409, 'Khoản sai đơn vị tiền cần ADMIN đối chiếu riêng; không ghi hoàn bằng VND.');
    if (receipt.status === 'UNCLASSIFIED') fail(409, 'Khoản nhận đang chờ phân loại từ nguồn xác minh.');
    const previous = receipt.history.find(item => item.action === action && item.reference === reference);
    if (previous) {
      if (!sameId(previous.actor, user._id) || previous.reason !== reason || previous.amountVND !== amountVND) {
        fail(409, 'Mã đối soát đã được dùng cho một nội dung khác trên khoản này.');
      }
      return;
    }
    if (amountVND > receipt.amountVND - receipt.refundedVND) fail(409, 'Khoản hoàn vượt số tiền còn lại đã nhận.');
    receipt.history.push({ action, reference, reason, amountVND, actor: user._id, at: new Date() });
    if (refund) {
      receipt.refundedVND += amountVND;
      receipt.status = receipt.refundedVND === receipt.amountVND ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    } else if (receipt.status === 'PENDING') {
      receipt.status = 'REVIEWED';
    }
    await receipt.save({ session });
  }, { writeConcern: { w: 'majority' } });
}
