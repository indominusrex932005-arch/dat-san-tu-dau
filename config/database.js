import dns from 'node:dns';
import mongoose from 'mongoose';

export default async function connectDatabase() {
  dns.setServers(['1.1.1.1', '8.8.8.8']);

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'quan_ly_dat_san_dev',
    serverSelectionTimeoutMS: 10000
  });

  console.log('Đã kết nối MongoDB Atlas');
}