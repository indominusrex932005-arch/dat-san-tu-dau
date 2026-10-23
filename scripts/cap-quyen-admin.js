import 'dotenv/config';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import User from '../models/User.js';

try {
  const position = process.argv.indexOf('--email');
  const email = position >= 0 ? process.argv[position + 1]?.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Chạy: npm run admin:grant -- --email tai-khoan-da-dang-ky@example.com');
  await connectDatabase();
  const user = await User.findOne({ email });
  if (!user) throw new Error('Tài khoản chưa tồn tại. Hãy đăng ký tài khoản khách trên web trước.');
  if (user.role === 'OWNER') throw new Error('Không đổi tài khoản chủ sân thành admin. Hãy dùng một tài khoản khách riêng.');
  user.role = 'ADMIN';
  user.ownerStatus = 'APPROVED';
  await user.save();
  console.log('Đã cấp quyền ADMIN cho tài khoản được chỉ định. Đăng xuất/đăng nhập lại rồi mở /admin.');
} catch (error) {
  console.error('Không thể cấp quyền ADMIN:', error.name === 'Error' ? error.message : error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
