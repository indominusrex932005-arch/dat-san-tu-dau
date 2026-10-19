import mongoose from 'mongoose';

const facilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  address: {
    type: String,
    required: true,
    trim: true
  },

  phone: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

const Facility = mongoose.model('Facility', facilitySchema);

export default Facility;