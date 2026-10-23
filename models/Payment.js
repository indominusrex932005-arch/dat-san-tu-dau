import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  amountVND: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  type: { type: String, enum: ['INITIAL_DEMO', 'EXTRA_DEMO'], required: true },
  method: { type: String, enum: ['DEMO'], default: 'DEMO' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
paymentSchema.index({ booking: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'INITIAL_DEMO' } });

export default mongoose.model('Payment', paymentSchema);
