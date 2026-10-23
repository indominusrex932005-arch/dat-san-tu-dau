import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['CUSTOMER', 'OWNER', 'ADMIN'], default: 'CUSTOMER' },
  ownerStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  phone: { type: String, trim: true, maxlength: 30 },
  requestedFacilityName: { type: String, trim: true, maxlength: 150 },
  requestedFacilityAddress: { type: String, trim: true, maxlength: 500 }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
