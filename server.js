import 'dotenv/config';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import createApp from './app.js';
import connectDatabase from './config/database.js';
import User from './models/User.js';
import Court from './models/Court.js';
import Booking from './models/Booking.js';

try {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự.');
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');

  await connectDatabase();
  await Promise.all([User.init(), Court.init(), Booking.init()]);
  const store = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: mongoose.connection.name,
    collectionName: 'sessions',
    ttl: 8 * 60 * 60
  });
  store.on('error', error => console.error('Lỗi session:', error.name));
  const app = createApp(store);
  app.listen(port, () => console.log(`Server đang chạy tại http://localhost:${port}`));
} catch (error) {
  console.error('Không thể khởi động:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
