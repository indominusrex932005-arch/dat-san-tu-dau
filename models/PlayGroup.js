import mongoose from 'mongoose';
export const extraLine = new mongoose.Schema({ name: String, unit: String, price: Number, quantity: Number }, { _id: false });
const member = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, name: String, phone: String, extras: [extraLine], share: Number }, { _id: false });
const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  title: { type: String, required: true, maxlength: 100 }, note: { type: String, maxlength: 500 },
  capacity: { type: Number, required: true, min: 2, max: 30 }, closesAt: { type: Date, required: true },
  closedAt: Date, total: Number, members: { type: [member], validate: value => value.length >= 1 && value.length <= 30 }
}, { timestamps: true });
export default mongoose.model('PlayGroup', schema);
