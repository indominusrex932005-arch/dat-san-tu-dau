import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  court: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  startHour: {
    type: Number, required: true, min: 6, max: 21, validate: Number.isInteger
  },
  totalPrice: { type: Number, required: true, min: 0, validate: Number.isFinite }
}, { timestamps: true });

// Mỗi lượt đặt dài một giờ. MongoDB chỉ nhận một lượt cho cùng sân/ngày/giờ.
bookingSchema.index({ court: 1, date: 1, startHour: 1 }, { unique: true });

export default mongoose.model('Booking', bookingSchema);
