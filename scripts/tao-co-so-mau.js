import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import Facility from '../models/Facility.js';

try {
  await connectDatabase();

  const existingFacility = await Facility.findOne({
    name: 'Cơ sở mẫu A'
  });

  if (existingFacility) {
    console.log('Cơ sở mẫu đã có, không tạo thêm.');
  } else {
    const facility = await Facility.create({
      name: 'Cơ sở mẫu A',
      address: 'Địa chỉ mẫu phục vụ học tập'
    });

    console.log('Đã lưu cơ sở:', facility.name);
  }
} catch (error) {
  console.error('Không thể tạo cơ sở. Loại lỗi:', error.name);
  console.error('Mã lỗi:', error.code);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}