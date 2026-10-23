import mongoose from 'mongoose';

const courtSchema = new mongoose.Schema({
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  name: { type: String, required: true, trim: true },
  pricePerHour: { type: Number, required: true, min: 0, validate: Number.isFinite },
  active: { type: Boolean, default: true }
}, { timestamps: true });

courtSchema.index({ facility: 1, name: 1 }, { unique: true });

export default mongoose.model('Court', courtSchema);
