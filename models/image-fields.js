import mongoose from 'mongoose';

export const MAX_IMAGES = 5;
export const imageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  url: { type: String, required: true, match: /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\// },
  publicId: { type: String, required: true },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 }
}, { _id: false });

export const imageFields = {
  illustrationIndex: { type: Number, min: 1, max: 4 },
  images: { type: [imageSchema], default: [], validate: value => value.length <= MAX_IMAGES },
  coverImageId: { type: String, default: '' },
  imageVersion: { type: Number, default: 0, select: false },
  // Durable retry queue: deleting a photo must not lose its remote cleanup ID.
  pendingImageDeletes: { type: [String], default: [], select: false }
};
