import mongoose from 'mongoose';

const money = { type: Number, min: 0, validate: Number.isSafeInteger };
const time = { type: String, match: /^(?:[01]\d|2[0-3]):[03]0$/ };
const courtSchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  sportType: { type: String, enum: ['BADMINTON', 'PICKLEBALL'], default: 'BADMINTON' },
  openTime: { ...time, default: '06:00' },
  closeTime: { ...time, default: '22:00' },
  peakStartTime: { ...time, default: '17:00' },
  peakEndTime: { ...time, default: '22:00' },
  basePriceVND: { ...money, required: true },
  peakPriceVND: { ...money, required: true },
  pricePerHour: { type: Number, min: 0, validate: Number.isFinite },
  active: { type: Boolean, default: true }
}, { timestamps: true });

courtSchema.index({ facility: 1, name: 1 }, { unique: true });
courtSchema.pre('validate', function () {
  if (this.openTime >= this.closeTime) this.invalidate('closeTime', 'Giờ đóng cửa phải sau giờ mở cửa.');
  if (this.peakStartTime >= this.peakEndTime || this.peakStartTime < this.openTime || this.peakEndTime > this.closeTime) {
    this.invalidate('peakEndTime', 'Khoảng cao điểm phải nằm trong giờ mở cửa và có giờ kết thúc sau giờ bắt đầu.');
  }
});

export default mongoose.model('Court', courtSchema);
