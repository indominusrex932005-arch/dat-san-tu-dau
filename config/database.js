import dns from 'node:dns';
import mongoose from 'mongoose';

export default async function connectDatabase() {
  dbName: 'quan_ly_dat_san_dev',  
    dns.setServers(['1.1.1.1', '8.8.8.8']);
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  console.log('Đã kết nối MongoDB Atlas');
}