import mongoose from 'mongoose';

export async function assertDatabaseCompatibility() {
  const db = mongoose.connection.db;
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    const error = new Error('Giữ nhiều ô cần MongoDB replica set. Dùng Atlas hoặc replica set cục bộ theo README.');
    error.code = 'REPLICA_SET_REQUIRED';
    throw error;
  }
  const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
  let oldBookings = 0, oldCourts = 0, oldIndex = false;
  if (collections.has('bookings')) {
    oldBookings = await db.collection('bookings').countDocuments({
      $or: [{ 'slots.0': { $exists: false } }, { status: { $exists: false } }, { publicCode: { $exists: false } }]
    });
    const indexes = await db.collection('bookings').indexes();
    oldIndex = indexes.some(index => index.unique && index.key.court === 1
      && index.key.date === 1 && index.key.startHour === 1);
  }
  if (collections.has('courts')) {
    oldCourts = await db.collection('courts').countDocuments({
      $or: [{ basePriceVND: { $exists: false } }, { peakPriceVND: { $exists: false } }]
    });
  }
  if (oldBookings || oldCourts || oldIndex) {
    const error = new Error('Database còn cấu trúc cũ. Dừng server, sao lưu rồi chạy npm run migrate để xem trước; npm run migrate -- --apply để chuyển dữ liệu.');
    error.code = 'MIGRATION_REQUIRED';
    throw error;
  }
}
