import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['CUSTOMER', 'OWNER', 'ADMIN'], default: 'CUSTOMER' },
  ownerStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  phone: { type: String, trim: true, maxlength: 30 },
  requestedFacilityName: { type: String, trim: true, maxlength: 150 },
  requestedFacilityAddress: { type: String, trim: true, maxlength: 500 },
  failedLoginAttempts: { type: Number, default: 0, min: 0, select: false },
  loginLockedUntil: { type: Date, default: null, select: false },
  passwordResetTokenHash: { type: String, default: null, select: false },
  passwordResetExpiresAt: { type: Date, default: null, select: false },
  loginOtpHash: { type: String, default: null, select: false },
  loginOtpExpiresAt: { type: Date, default: null, select: false },
  loginOtpAttempts: { type: Number, default: 0, min: 0, select: false },
  emailVerified: { type: Boolean, default: true },
  emailVerifyTokenHash: { type: String, default: null, select: false },
  emailVerifyExpiresAt: { type: Date, default: null, select: false }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
