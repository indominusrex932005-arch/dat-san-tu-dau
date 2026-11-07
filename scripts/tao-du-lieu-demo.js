import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import Court from '../models/Court.js';
import Facility from '../models/Facility.js';
import Booking from '../models/Booking.js';
import { seedDemoFacilities } from '../services/demo-seed.service.js';

try {
  await connectDatabase();
  await Promise.all([Court.init(), Booking.init()]);
  const results = await seedDemoFacilities();
  console.log(`Đã thêm ${results.filter(item => item.created).length} cơ sở mẫu còn thiếu; giữ nguyên thông tin đã có.`);
  console.table(results);
  console.log(`Tổng số cơ sở hiện có: ${await Facility.countDocuments()}. Seed chỉ bổ sung tới 4, không xóa cơ sở có sẵn.`);
  console.log('Cơ sở mới chưa có chủ sân/số liên hệ. ADMIN cần cấp cơ sở, OWNER cập nhật liên hệ trước khi nhận đặt.');
  console.log('Mở /register để tự đăng ký tài khoản, sau đó đăng nhập để đặt sân.');
} catch (error) {
  console.error('Không thể tạo dữ liệu demo:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
