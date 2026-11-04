import mongoose from 'mongoose';

const isIntent = function () { return this.type === 'INITIAL_INTENT'; };
const safeText = value => typeof value === 'string' && !!value.trim()
  && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const recipientSchema = new mongoose.Schema({
  bindingId: { type: String, required: true, maxlength: 128, validate: safeText },
  recipientId: { type: String, required: true, maxlength: 128, validate: safeText },
  displayName: { type: String, required: true, maxlength: 150, validate: safeText }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  amountVND: {
    type: Number, required: true, min: 0,
    validate: function (value) { return Number.isSafeInteger(value) && (!isIntent.call(this) || value > 0); }
  },
  type: { type: String, enum: ['INITIAL_DEMO', 'EXTRA_DEMO', 'INITIAL_INTENT'], required: true },
  method: { type: String, enum: ['DEMO', 'PROVIDER'], default: 'DEMO' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  currency: { type: String, enum: ['VND'], required: isIntent },
  provider: { type: String, match: /^[a-z][a-z0-9_-]{0,49}$/, required: isIntent },
  environment: { type: String, enum: ['sandbox'], required: isIntent },
  merchantId: { type: String, maxlength: 128, validate: safeText, required: isIntent },
  recipient: { type: recipientSchema, required: isIntent },
  reconciliationCode: { type: String, match: /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/, required: isIntent },
  expiresAt: { type: Date, required: isIntent },
  attemptedAt: { type: Date, required: isIntent },
  intentStatus: { type: String, enum: ['CREATING', 'PENDING', 'UNKNOWN', 'FAILED', 'EXPIRED'], required: isIntent },
  nextCheckAt: Date,
  lookupLeaseUntil: Date,
  failureCode: { type: String, match: /^[A-Z][A-Z0-9_]{0,49}$/ },
  providerPaymentId: { type: String, maxlength: 200, validate: safeText },
  externalId: { type: String, maxlength: 200, validate: safeText },
  checkoutUrl: {
    type: String, maxlength: 2048,
    validate: value => {
      try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
      catch { return false; }
    }
  },
  qrPayload: { type: String, maxlength: 4096, validate: safeText }
}, { timestamps: true });
paymentSchema.pre('validate', function () {
  if (this.method !== (isIntent.call(this) ? 'PROVIDER' : 'DEMO')) {
    this.invalidate('method', 'Phương thức thanh toán không khớp loại bản ghi.');
  }
});
// Intent indexes are deliberately applied only by the explicit, dry-run-first migration.
paymentSchema.index({ booking: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'INITIAL_DEMO' } });

export default mongoose.model('Payment', paymentSchema);
