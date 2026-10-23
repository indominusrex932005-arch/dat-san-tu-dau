import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment, mongoose, Booking, Court, User, Facility, SlotLock } from './helpers/database.js';
import { migrateDatabase } from '../scripts/chuyen-du-lieu-v2.js';

test('Chuyển dữ liệu v1 có dry-run, giữ đơn/tiền/giờ và chạy lại an toàn', { timeout: 60000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const db = mongoose.connection.db;
  const userId = new mongoose.Types.ObjectId();
  const facilityId = new mongoose.Types.ObjectId();
  const courtId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const date = new Date(Date.now() + 10 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  await db.collection('users').insertOne({ _id: userId, fullName: 'Khách cũ', email: 'legacy@example.test', passwordHash: 'sentinel-hash' });
  await db.collection('facilities').insertOne({ _id: facilityId, name: 'Cơ sở cũ', address: 'Địa chỉ cũ' });
  await db.collection('courts').insertOne({ _id: courtId, facility: facilityId, name: 'Sân cũ', pricePerHour: 100001, active: true });
  await db.collection('bookings').insertOne({ _id: bookingId, user: userId, court: courtId, date, startHour: 14, totalPrice: 100001 });
  await db.collection('bookings').createIndex({ court: 1, date: 1, startHour: 1 }, { unique: true, name: 'court_1_date_1_startHour_1' });

  await t.test('Dry-run không sửa document hoặc index', async () => {
    const beforeBooking = await db.collection('bookings').findOne({ _id: bookingId });
    const beforeIndexes = await db.collection('bookings').listIndexes().toArray();
    const result = await migrateDatabase(db);
    assert.equal(result.dryRun, true);
    assert.equal(result.applied, false);
    assert.deepEqual(result.errors, []);
    assert.equal(result.bookingsToUpdate, 1);
    assert.deepEqual(await db.collection('bookings').findOne({ _id: bookingId }), beforeBooking);
    assert.deepEqual(await db.collection('bookings').listIndexes().toArray(), beforeIndexes);
    assert.equal((await db.collection('users').findOne({ _id: userId })).role, undefined);
    assert.equal(await SlotLock.countDocuments(), 0);
  });

  await t.test('Apply chia một giờ thành hai ô, giữ ID/tổng tiền và chưa tự ghi nhận đã trả', async () => {
    const result = await migrateDatabase(db, { apply: true });
    assert.deepEqual(result.errors, []);
    assert.equal(result.applied, true);
    const booking = await Booking.findById(bookingId).lean();
    assert.equal(String(booking._id), String(bookingId));
    assert.equal(String(booking.user), String(userId));
    assert.equal(booking.totalPrice, 100001);
    assert.equal(booking.slots.length, 2);
    assert.equal(booking.slots.reduce((sum, slot) => sum + slot.priceVND, 0), 100001);
    assert.equal(new Date(booking.slots[1].endAt) - new Date(booking.slots[0].startAt), 3600000);
    assert.equal(booking.status, 'LEGACY_RESERVED');
    assert.equal(booking.paymentStatus, 'UNPAID');
    assert.equal(await SlotLock.countDocuments({ booking: bookingId, expiresAt: null }), 2);
    assert.equal((await User.findById(userId)).role, 'CUSTOMER');
    assert.equal((await Court.findById(courtId)).basePriceVND, 50001);
    assert.equal((await User.findById(userId).select('+passwordHash')).passwordHash, 'sentinel-hash');
    assert.equal(await db.collection('bookings').countDocuments(), 1);
    const indexes = await db.collection('bookings').listIndexes().toArray();
    assert.ok(!indexes.some(index => index.name === 'court_1_date_1_startHour_1'));
  });

  await t.test('Chạy apply lần hai không tạo thêm đơn hoặc lock', async () => {
    const second = await migrateDatabase(db, { apply: true });
    assert.equal(second.applied, true);
    assert.equal(second.bookingsToUpdate, 0);
    assert.equal(await db.collection('bookings').countDocuments(), 1);
    assert.equal(await SlotLock.countDocuments({ booking: bookingId }), 2);
  });

  await t.test('Hai đơn mới không có startHour không đụng index null cũ; giờ đã đặt cũ vẫn bị giữ', async () => {
    const { createHold } = await import('../services/booking.service.js');
    await assert.rejects(createHold({ courtId: String(courtId), date, times: ['16:00'], guestName: 'Người mới', guestPhone: '0912345678', user: null }),
      error => error.status === 409 && error.message.includes('chủ sân'));
    const owner = await User.create({ fullName: 'Chủ sân được cấp', email: 'legacy-owner@example.test', passwordHash: 'owner-fixture', role: 'OWNER', ownerStatus: 'APPROVED' });
    await Facility.updateOne({ _id: facilityId }, { $set: { owner: owner._id, phone: '0912345678' } });
    await assert.rejects(createHold({ courtId: String(courtId), date, times: ['14:00'], guestName: 'Người mới', guestPhone: '0912345678', user: null }), error => error.status === 409);
    const first = await createHold({ courtId: String(courtId), date, times: ['16:00'], guestName: 'Người mới', guestPhone: '0912345678', user: null });
    const second = await createHold({ courtId: String(courtId), date, times: ['16:30'], guestName: 'Người mới khác', guestPhone: '0912345678', user: null });
    assert.notEqual(String(first.booking._id), String(second.booking._id));
    assert.equal(await db.collection('bookings').countDocuments(), 3);
    assert.equal(await SlotLock.countDocuments({ booking: bookingId }), 2);
  });
});
