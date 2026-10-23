import mongoose from 'mongoose';

const bookingRequestSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['CANCEL', 'CHANGE'], required: true },
  source: { type: String, enum: ['CUSTOMER', 'OWNER_CALL'], default: 'CUSTOMER' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reason: { type: String, trim: true, maxlength: 1000, default: '' },
  requestedCourt: { type: mongoose.Schema.Types.ObjectId, ref: 'Court' },
  requestedDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  requestedTimes: [{ type: String, match: /^(?:[01]\d|2[0-3]):[03]0$/ }],
  ownerNote: { type: String, trim: true, maxlength: 1000, default: '' },
  refundAmount: { type: Number, min: 0, validate: Number.isSafeInteger, default: 0 },
  refundStatus: { type: String, enum: ['NONE', 'PENDING', 'TRANSFERRED'], default: 'NONE' },
  extraAmount: { type: Number, min: 0, validate: Number.isSafeInteger, default: 0 },
  processedAt: Date,
  refundRecordedAt: Date
}, { timestamps: true });
bookingRequestSchema.index({ booking: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });

export default mongoose.model('BookingRequest', bookingRequestSchema);
