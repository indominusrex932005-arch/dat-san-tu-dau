import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  action: { type: String, enum: ['REVIEWED', 'REFUND_RECORDED'], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  at: { type: Date, required: true },
  reference: { type: String, required: true, maxlength: 100 },
  reason: { type: String, required: true, maxlength: 500 },
  amountVND: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { _id: false });

const paymentReceiptSchema = new mongoose.Schema({
  // Deterministic identity uses the collection's built-in unique _id index.
  _id: String,
  provider: { type: String, required: true },
  environment: { type: String, enum: ['sandbox'], required: true },
  merchantId: { type: String, required: true },
  recipientId: String,
  bindingId: String,
  transactionId: { type: String, required: true },
  orderReference: String,
  orderReferenceKind: { type: String, enum: ['providerPaymentId', 'externalId'] },
  reconciliationCode: String,
  currency: { type: String, enum: ['VND'], required: true },
  amountVND: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  receivedAt: { type: Date, required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility' },
  expectedAmountVND: Number,
  flags: [String],
  status: {
    type: String, required: true, default: 'UNCLASSIFIED',
    enum: ['UNCLASSIFIED', 'PENDING', 'REVIEWED', 'PARTIALLY_REFUNDED', 'REFUNDED']
  },
  refundedVND: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  history: [auditSchema]
}, { timestamps: true, autoCreate: false, writeConcern: { w: 'majority' } });

export default mongoose.model('PaymentReceipt', paymentReceiptSchema);
