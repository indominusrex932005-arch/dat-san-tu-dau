import mongoose from 'mongoose';
import { imageFields, imageSchema } from './image-fields.js';

const facilitySchema = new mongoose.Schema({
  ...imageFields,
  demoQr: { type: imageSchema, default: undefined },
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

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  phone: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

facilitySchema.index({ owner: 1 }, { unique: true, partialFilterExpression: { owner: { $type: 'objectId' } } });

const Facility = mongoose.model('Facility', facilitySchema);

export default Facility;
