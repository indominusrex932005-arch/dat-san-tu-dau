import mongoose from 'mongoose';
const schema = new mongoose.Schema({ facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  name: { type: String, required: true, maxlength: 80 }, unit: { type: String, required: true, maxlength: 30 },
  price: { type: Number, required: true, min: 0, max: 10000000, validate: Number.isSafeInteger }, active: { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('ExtraService', schema);
