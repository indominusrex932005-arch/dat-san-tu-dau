import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import { cloudImageStorage } from '../services/image-storage.js';
import { cleanTargetImages } from '../services/owner-images.service.js';

try {
  if (!cloudImageStorage.ready()) throw new Error('Chưa cấu hình kho ảnh.');
  await connectDatabase();
  for (const Model of [Facility, Court]) {
    const targets = await Model.find({ 'pendingImageDeletes.0': { $exists: true } }).select('+pendingImageDeletes').lean();
    for (const target of targets) await cleanTargetImages(Model, target._id, target.pendingImageDeletes, cloudImageStorage);
  }
  console.log('Đã thử dọn ảnh chờ xóa. Ảnh chưa dọn được vẫn được giữ để chạy lại.');
} catch (error) {
  console.error('Chưa hoàn tất dọn ảnh:', error.name);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
