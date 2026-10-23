import 'dotenv/config';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import mongoose from 'mongoose';

const legacyKey = { court: 1, date: 1, startHour: 1 };
const sameKey = key => JSON.stringify(key) === JSON.stringify(legacyKey);
const id = value => String(value ?? '');
const validMoney = value => Number.isSafeInteger(value) && value >= 0;
const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[03]0$/.test(value);
function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function indexes(collection) {
  try { return await collection.listIndexes().toArray(); }
  catch (error) { if (error.code === 26) return []; throw error; }
}

function courtDefaults(court) {
  const basePriceVND = court.basePriceVND ?? (validMoney(court.pricePerHour) ? Math.ceil(court.pricePerHour / 2) : undefined);
  const openTime = court.openTime ?? '06:00';
  const closeTime = court.closeTime ?? '22:00';
  return {
    basePriceVND,
    peakPriceVND: court.peakPriceVND ?? basePriceVND,
    openTime,
    closeTime,
    peakStartTime: court.peakStartTime ?? (openTime > '17:00' ? openTime : closeTime <= '17:00' ? openTime : '17:00'),
    peakEndTime: court.peakEndTime ?? closeTime
  };
}

/** Read-only by default. Use only against a backed-up development database with writers stopped. */
export async function migrateDatabase(db, { apply = false } = {}) {
  const users = db.collection('users');
  const courts = db.collection('courts');
  const bookings = db.collection('bookings');
  const locks = db.collection('slotlocks');
  const [allUsers, allCourts, legacyBookings, currentLocks, bookingIndexes] = await Promise.all([
    users.find({}, { projection: { _id: 1, fullName: 1, phone: 1, role: 1 } }).toArray(),
    courts.find({}).toArray(),
    bookings.find({ $or: [{ slots: { $exists: false } }, { slots: { $size: 0 } }] }).toArray(),
    locks.find({}).toArray(),
    indexes(bookings)
  ]);
  const userMap = new Map(allUsers.map(user => [id(user._id), user]));
  const courtMap = new Map(allCourts.map(court => [id(court._id), court]));
  const lockMap = new Map(currentLocks.map(lock => [id(lock.court) + ':' + Number(new Date(lock.slotStart)), lock]));
  const errors = [];
  const courtUpdates = [];
  for (const court of allCourts) {
    const defaults = courtDefaults(court);
    if (!validMoney(defaults.basePriceVND) || !validMoney(defaults.peakPriceVND)
      || ![defaults.openTime, defaults.closeTime, defaults.peakStartTime, defaults.peakEndTime].every(validTime)
      || defaults.openTime >= defaults.closeTime || defaults.peakStartTime >= defaults.peakEndTime
      || defaults.peakStartTime < defaults.openTime || defaults.peakEndTime > defaults.closeTime) {
      errors.push(`Sân ${id(court._id)} có giá/giờ không hợp lệ; cần sửa trước khi chuyển.`);
    } else if (Object.entries(defaults).some(([key, value]) => court[key] !== value)) {
      courtUpdates.push({ _id: court._id, values: defaults });
    }
  }
  const bookingUpdates = [];
  for (const booking of legacyBookings) {
    const court = courtMap.get(id(booking.court));
    const start = new Date(`${booking.date}T${String(booking.startHour).padStart(2, '0')}:00:00+07:00`);
    if (!court?.facility || !validDay(booking.date)
      || !Number.isInteger(booking.startHour) || booking.startHour < 0 || booking.startHour > 22
      || !Number.isFinite(start.getTime()) || !validMoney(booking.totalPrice)) {
      errors.push(`Đơn ${id(booking._id)} không đủ dữ liệu v1 hợp lệ; không tự sửa hoặc xóa.`);
      continue;
    }
    if (booking.paymentStatus && booking.paymentStatus !== 'UNPAID') {
      errors.push(`Đơn ${id(booking._id)} có thông tin thanh toán ngoài cấu trúc v1; cần đối chiếu riêng.`);
      continue;
    }
    const user = userMap.get(id(booking.user));
    const firstPrice = Math.floor(booking.totalPrice / 2);
    const slots = [0, 1].map(index => ({
      startAt: new Date(start.getTime() + index * 30 * 60000),
      endAt: new Date(start.getTime() + (index + 1) * 30 * 60000),
      priceVND: index === 0 ? firstPrice : booking.totalPrice - firstPrice
    }));
    for (const slot of slots) {
      const key = id(booking.court) + ':' + Number(slot.startAt);
      const old = lockMap.get(key);
      if (old && id(old.booking) !== id(booking._id)) errors.push(`Ô của đơn ${id(booking._id)} xung đột với đơn ${id(old.booking)}.`);
      lockMap.set(key, { booking: booking._id });
    }
    bookingUpdates.push({
      _id: booking._id,
      values: {
        facility: court.facility,
        publicCode: typeof booking.publicCode === 'string' && booking.publicCode.trim()
          ? booking.publicCode : 'CU-' + id(booking._id).toUpperCase(),
        guestName: booking.guestName || user?.fullName || 'Khách từ phiên bản cũ',
        guestPhone: booking.guestPhone || user?.phone || '',
        slots,
        status: 'LEGACY_RESERVED',
        paymentStatus: 'UNPAID',
        legacy: true
      }
    });
  }
  const legacyIndexes = bookingIndexes.filter(index => sameKey(index.key));
  const report = {
    dryRun: !apply,
    applied: false,
    usersToUpdate: allUsers.filter(user => !user.role).length,
    courtsToUpdate: courtUpdates.length,
    bookingsToUpdate: bookingUpdates.length,
    slotsToReserve: bookingUpdates.length * 2,
    oldIndexesToRemove: legacyIndexes.map(index => index.name),
    errors,
    notes: ['Không xóa tài khoản/đơn cũ.', 'Đơn cũ giữ chỗ, nhưng chưa có ghi nhận thanh toán.', 'Giá ô mặc định làm tròn lên nếu giá mỗi giờ cũ lẻ; tổng tiền đơn cũ luôn giữ nguyên.']
  };
  if (!apply || errors.length) return report;

  const connection = db.client;
  if (!connection?.startSession) throw new Error('Cần MongoDB client có session để chuyển dữ liệu trong transaction.');
  // Chỉ --apply mới tạo collection/index. Dry-run phía trên hoàn toàn chỉ đọc.
  await locks.createIndex({ court: 1, slotStart: 1 }, { unique: true });
  await bookings.createIndex({ publicCode: 1 }, { unique: true, partialFilterExpression: { publicCode: { $type: 'string' } } });
  const session = connection.startSession();
  try {
    await session.withTransaction(async () => {
      await users.updateMany({ role: { $exists: false } }, { $set: { role: 'CUSTOMER' } }, { session });
      for (const court of courtUpdates) await courts.updateOne({ _id: court._id }, { $set: court.values }, { session });
      for (const update of bookingUpdates) {
        const result = await bookings.updateOne({ _id: update._id, $or: [{ slots: { $exists: false } }, { slots: { $size: 0 } }] }, { $set: update.values }, { session });
        if (result.matchedCount !== 1) throw new Error('Dữ liệu đã thay đổi khi chuyển; dừng ghi đơn rồi chạy dry-run lại.');
        const original = legacyBookings.find(booking => id(booking._id) === id(update._id));
        for (const slot of update.values.slots) {
          const existing = await locks.findOne({ court: original.court, slotStart: slot.startAt }, { session });
          if (existing && id(existing.booking) !== id(update._id)) throw new Error('Ô giờ đã thuộc đơn khác; không chuyển một phần.');
          await locks.updateOne({ court: original.court, slotStart: slot.startAt }, {
            $set: { booking: update._id, expiresAt: null },
            $setOnInsert: { court: original.court, slotStart: slot.startAt }
          }, { upsert: true, session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  // Chỉ bỏ index v1 sau khi backfill đơn và occupancy thành công.
  for (const index of legacyIndexes) await bookings.dropIndex(index.name);
  report.applied = true;
  return report;
}

async function run() {
  let connection;
  try {
    if (!process.env.MONGODB_URI) throw new Error('Cần MONGODB_URI trong .env.');
    dns.setServers(['1.1.1.1', '8.8.8.8']);
    connection = await mongoose.createConnection(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'quan_ly_dat_san_dev', serverSelectionTimeoutMS: 10000,
      autoIndex: false, autoCreate: false
    }).asPromise();
    const report = await migrateDatabase(connection.db, { apply: process.argv.includes('--apply') });
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exitCode = 1;
    else if (report.dryRun) console.log('Đây là dry-run, chưa ghi dữ liệu. Sao lưu, dừng server rồi dùng --apply để chuyển.');
  } catch (error) {
    console.error('Không thể chuyển dữ liệu. Kiểm tra kết nối, replica set và dữ liệu. Loại lỗi:', error.name);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
