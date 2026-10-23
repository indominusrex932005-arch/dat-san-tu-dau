import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';

try {
  await connectDatabase();
  await Promise.all([Court.init(), Booking.init()]);
  const facility = await Facility.findOneAndUpdate(
    { name: 'Cơ sở Demo MVC' },
    { $setOnInsert: { name: 'Cơ sở Demo MVC', address: 'Địa chỉ minh họa phục vụ bài nhóm', phone: '' } },
    { upsert: true, returnDocument: 'after', runValidators: true }
  );
  for (const [name, pricePerHour] of [['Sân cầu lông 1', 100000], ['Sân cầu lông 2', 120000]]) {
    await Court.findOneAndUpdate(
      { facility: facility._id, name },
      { $setOnInsert: { facility: facility._id, name, pricePerHour, active: true } },
      { upsert: true, returnDocument: 'after', runValidators: true }
    );
  }
  console.log('Đã chuẩn bị 2 sân mẫu. Không xóa lượt đặt hoặc dữ liệu đang có.');
  console.log('Mở /register để tự đăng ký tài khoản, sau đó đăng nhập để đặt sân.');
} catch (error) {
  console.error('Không thể tạo dữ liệu demo:', error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
