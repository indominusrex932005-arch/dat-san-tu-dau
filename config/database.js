import dns from 'node:dns';
import mongoose from 'mongoose';

export default async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('Chưa có MONGODB_URI trong .env.');
  dns.setServers(['1.1.1.1', '8.8.8.8']);
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.DB_NAME || 'quan_ly_dat_san_dev',
    serverSelectionTimeoutMS: 10000
  });
  console.log('Đã kết nối MongoDB');
}
