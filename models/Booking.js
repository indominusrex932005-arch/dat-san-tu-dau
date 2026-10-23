import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  priceVND: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
}, { _id: false });
slotSchema.pre('validate', function () {
  if (this.startAt && this.endAt && Number(this.endAt) - Number(this.startAt) !== 30 * 60000) {
    this.invalidate('endAt', 'Mỗi ô phải dài đúng 30 phút.');
  }
});

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  court: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  publicCode: { type: String, required: true, trim: true },
  guestName: { type: String, required: true, trim: true, maxlength: 100 },
  guestPhone: { type: String, trim: true, maxlength: 30, default: '' },
  guestTokenHash: { type: String, select: false },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  slots: {
    type: [slotSchema],
    validate: { validator: value => value.length > 0 && value.length <= 48, message: 'Đơn phải có từ 1 đến 48 ô.' }
  },
  totalPrice: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  status: { type: String, enum: ['HOLD', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'LEGACY_RESERVED'], default: 'HOLD' },
  paymentStatus: { type: String, enum: ['UNPAID', 'DEMO_PAID', 'PAID'], default: 'UNPAID' },
  holdExpiresAt: { type: Date, required: function () { return this.status === 'HOLD'; } },
  legacy: { type: Boolean, default: false },
  startHour: { type: Number, min: 0, max: 23, validate: Number.isInteger }
}, { timestamps: true });

bookingSchema.index({ publicCode: 1 }, { unique: true, partialFilterExpression: { publicCode: { $type: 'string' } } });
bookingSchema.index({ user: 1, date: -1 });
bookingSchema.index({ facility: 1, createdAt: -1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
bookingSchema.pre('validate', function () {
  const starts = this.slots.map(slot => Number(slot.startAt));
  if (new Set(starts).size !== starts.length) this.invalidate('slots', 'Một đơn không được chọn trùng ô.');
  if (this.slots.length && this.slots.reduce((sum, slot) => sum + slot.priceVND, 0) !== this.totalPrice) {
    this.invalidate('totalPrice', 'Tổng tiền phải bằng tổng giá các ô đã lưu.');
  }
});

export default mongoose.model('Booking', bookingSchema);
