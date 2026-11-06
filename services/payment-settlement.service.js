import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import SlotLock from '../models/SlotLock.js';
import { RuleError } from '../domain/booking-rules.js';
import { assertPaymentReceiptIndex } from './payment-intent-indexes.js';
import { requireHold } from './payment.service.js';

const referenceKeys = ['providerPaymentId', 'externalId'];
const evidenceKeys = [
  'providerRecipientId', 'reconciliationCode', ...referenceKeys, 'receivedAmountMinor', 'currency'
];

class AbortForReview extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function replayResult(existing, receipt) {
  if (evidenceKeys.some(key => existing[key] !== receipt[key])) {
    throw Object.assign(new Error('Mã giao dịch đã được ghi với thông tin khác.'), {
      status: 409, code: 'PAYMENT_RECEIPT_CONFLICT'
    });
  }
  return { status: 'DUPLICATE' };
}

function referenceMismatch(intent, receipt) {
  if (intent.provider !== receipt.provider || intent.environment !== receipt.environment) return 'PROVIDER_MISMATCH';
  if (intent.merchantId !== receipt.merchantId) return 'MERCHANT_MISMATCH';
  if (!receipt.providerRecipientId || intent.recipient?.recipientId !== receipt.providerRecipientId) return 'RECIPIENT_MISMATCH';
  const references = referenceKeys.filter(key => receipt[key] !== undefined);
  if (!references.length || references.some(key => intent[key] !== receipt[key])) return 'INTENT_REFERENCE_MISMATCH';
  return undefined;
}

function paymentMismatch(intent, receipt) {
  if (receipt.currency !== 'VND' || receipt.currency !== intent.currency) return 'CURRENCY_MISMATCH';
  if (receipt.receivedAmountMinor !== intent.amountVND) return 'AMOUNT_MISMATCH';
  if (intent.intentStatus !== 'PENDING') return 'INTENT_NOT_PENDING';
  return undefined;
}

function clockTime(now) {
  const time = now();
  if (!(time instanceof Date) || !Number.isFinite(Number(time))) throw new TypeError('Invalid settlement clock.');
  return time;
}

function beforeDeadline(deadline, now) {
  const time = clockTime(now);
  if (Number(time) >= deadline) throw new AbortForReview('DEADLINE_PASSED');
  return time;
}

/**
 * Internal consumer of a sandbox adapter's authenticated, final success event.
 * Request data and provider I/O belong outside this transaction.
 */
export async function recordProviderReceipt(event, { now = () => new Date() } = {}) {
  const key = {
    type: 'PROVIDER_RECEIPT', provider: event.provider, environment: event.environment,
    merchantId: event.merchantId, providerTransactionId: event.transactionId
  };
  const receipt = {
    ...key,
    method: 'PROVIDER',
    providerRecipientId: event.recipientId,
    reconciliationCode: event.reconciliationCode,
    providerPaymentId: event.providerPaymentId,
    externalId: event.externalId,
    receivedAmountMinor: event.receivedAmountMinor,
    currency: event.currency
  };
  await assertPaymentReceiptIndex();

  async function saveReceipt(session, intent, reviewReason) {
    const status = reviewReason ? 'REVIEW' : 'APPLIED';
    await Payment.create([{
      ...receipt, booking: intent?.booking, intent: intent?._id, receiptStatus: status, reviewReason
    }], { session });
    return { status };
  }

  function transact(abortedReason) {
    return mongoose.connection.transaction(async session => {
      const existing = await Payment.findOne(key).session(session).lean();
      if (existing) return replayResult(existing, receipt);

      const intent = receipt.reconciliationCode
        ? await Payment.findOne({ type: 'INITIAL_INTENT', reconciliationCode: receipt.reconciliationCode }).session(session).lean()
        : null;
      if (!intent) return saveReceipt(session, null, 'INTENT_NOT_FOUND');
      // An unverified association is for ADMIN reconciliation, not a booking owner.
      const badReference = referenceMismatch(intent, receipt);
      if (badReference) return saveReceipt(session, null, badReference);
      const mismatch = paymentMismatch(intent, receipt);
      if (mismatch || abortedReason) return saveReceipt(session, intent, mismatch || abortedReason);
      const intentDeadline = intent.expiresAt instanceof Date ? Number(intent.expiresAt) : NaN;
      if (!Number.isFinite(intentDeadline)) return saveReceipt(session, intent, 'INVALID_INTENT_DEADLINE');

      const booking = await Booking.findById(intent.booking).session(session).lean();
      if (!booking) return saveReceipt(session, intent, 'BOOKING_NOT_FOUND');
      const locks = await SlotLock.find({ booking: booking._id }).session(session).lean();
      let holdDeadline;
      try {
        holdDeadline = requireHold(booking, locks, clockTime(now));
      } catch (error) {
        if (error instanceof RuleError) return saveReceipt(session, intent, 'INVALID_BOOKING_SNAPSHOT');
        if (error.status === 409 || error.status === 410) {
          return saveReceipt(session, intent, error.code || 'BOOKING_NOT_PAYABLE');
        }
        throw error;
      }
      if (booking.totalPrice !== intent.amountVND) return saveReceipt(session, intent, 'BOOKING_AMOUNT_CHANGED');
      const deadline = Math.min(Number(holdDeadline), intentDeadline);
      if (Number(clockTime(now)) >= deadline) return saveReceipt(session, intent, 'DEADLINE_PASSED');

      const result = await saveReceipt(session, intent);
      const lockTime = beforeDeadline(deadline, now);
      const locked = await SlotLock.updateMany({
        _id: { $in: locks.map(lock => lock._id) },
        booking: booking._id, court: booking.court, expiresAt: { $gt: lockTime }
      }, { $set: { expiresAt: null } }, { session });
      if (locked.matchedCount !== booking.slots.length) throw new AbortForReview('BOOKING_LOCKS_MISSING');

      beforeDeadline(deadline, now);
      const confirmed = await Booking.updateOne({
        _id: booking._id, status: 'HOLD', paymentStatus: 'UNPAID',
        legacy: { $ne: true }, totalPrice: intent.amountVND
      }, {
        $set: { status: 'CONFIRMED', paymentStatus: 'DEMO_PAID' }, $unset: { holdExpiresAt: 1 }
      }, { session, runValidators: true });
      if (confirmed.matchedCount !== 1) throw new AbortForReview('BOOKING_NOT_PAYABLE');

      const settled = await Payment.updateOne({ _id: intent._id, type: 'INITIAL_INTENT', intentStatus: 'PENDING' }, {
        $set: { intentStatus: 'SETTLED' }, $unset: { lookupLeaseUntil: 1, nextCheckAt: 1, failureCode: 1 }
      }, { session, runValidators: true });
      if (settled.matchedCount !== 1) throw new AbortForReview('INTENT_NOT_PENDING');
      beforeDeadline(deadline, now);
      return result;
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  }

  try {
    try {
      return await transact();
    } catch (error) {
      if (!(error instanceof AbortForReview)) throw error;
      // An earlier write might have succeeded inside the aborted transaction.
      // Persist only the review receipt in a fresh transaction.
      return await transact(error.reason);
    }
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Payment.findOne(key).read('primary').readConcern('majority').lean();
    if (!existing) throw error;
    return replayResult(existing, receipt);
  }
}
