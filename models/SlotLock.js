import mongoose from 'mongoose';

const slotLockSchema = new mongoose.Schema({
  court: { type: mongoose.Schema.Types.ObjectId, ref: 'Court', required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  slotStart: { type: Date, required: true },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });
slotLockSchema.index({ court: 1, slotStart: 1 }, { unique: true });
slotLockSchema.index({ booking: 1 });

export default mongoose.model('SlotLock', slotLockSchema);
