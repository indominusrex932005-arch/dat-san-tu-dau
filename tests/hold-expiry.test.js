import test from 'node:test';
import assert from 'node:assert/strict';
import { holdExpiresAt, effectiveHoldExpiresAt, slotInstant } from '../domain/booking-rules.js';
import { expireHolds } from '../services/booking.service.js';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const date = '2030-05-10';
const instant = time => new Date(`${date}T${time}+07:00`);
const slotsAt = times => times.map(time => ({ startAt: slotInstant(date, time) }));

for (const { name, created, times, expected } of [
  { name: 'Giữ tương thích 10 phút khi lời gọi cũ không truyền ô', created: '15:55:00', times: [], expected: '16:05:00' },
  { name: 'Ô đầu còn xa hơn 10 phút vẫn chỉ được giữ 10 phút', created: '15:40:00', times: ['16:00'], expected: '15:50:00' },
  { name: 'Ô đầu sắp bắt đầu rút ngắn hạn giữ xuống dưới 10 phút', created: '15:55:00', times: ['16:00'], expected: '16:00:00' },
  { name: 'Nhiều ô rời nhau lấy ô sớm nhất kể cả đầu vào chưa sắp xếp', created: '15:55:00', times: ['19:00', '16:30', '16:00'], expected: '16:00:00' },
  { name: 'Ô đầu bắt đầu đúng mốc 10 phút có cùng hạn UTC', created: '15:50:00', times: ['16:00', '19:00'], expected: '16:00:00' },
  { name: 'Hạn bằng thời điểm ô đầu bắt đầu, không cộng thêm một ô 30 phút', created: '16:00:00', times: ['16:00', '19:00'], expected: '16:00:00' }
]) {
  test(name, () => {
    assert.equal(holdExpiresAt(instant(created), slotsAt(times)).toISOString(), instant(expected).toISOString());
  });
}

test('HOLD cũ có hạn lưu quá muộn bị giới hạn bởi ô sớm nhất', () => {
  const booking = { createdAt: instant('15:55:00'), holdExpiresAt: instant('16:05:00'), slots: slotsAt(['19:00', '16:00']) };
  assert.equal(effectiveHoldExpiresAt(booking).toISOString(), '2030-05-10T09:00:00.000Z');
  assert.equal(booking.holdExpiresAt.toISOString(), instant('16:05:00').toISOString());
});

test('HOLD cũ không được kéo dài quá 10 phút từ createdAt hoặc kéo dài hạn đã ngắn hơn', () => {
  const booking = { createdAt: instant('15:40:00'), holdExpiresAt: instant('16:15:00'), slots: slotsAt(['16:00']) };
  assert.equal(effectiveHoldExpiresAt(booking).toISOString(), instant('15:50:00').toISOString());
  booking.holdExpiresAt = instant('15:45:00');
  assert.equal(effectiveHoldExpiresAt(booking).toISOString(), instant('15:45:00').toISOString());
});

test('HOLD cũ thiếu createdAt vẫn giữ giới hạn hạn đã lưu và ô bắt đầu', () => {
  assert.equal(effectiveHoldExpiresAt({ holdExpiresAt: instant('16:05:00'), slots: slotsAt(['19:00', '16:00']) }).toISOString(), instant('16:00:00').toISOString());
});

test('Hạn giữ theo ô đầu được bảo vệ bằng HTTP và MongoDB transaction thật', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const owner = await User.create({ fullName: 'Chủ kiểm thử hạn giữ', email: 'expiry-owner@example.test', passwordHash: 'local-fixture-not-for-login', role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' });
  const facility = await Facility.create({ name: 'Cơ sở kiểm thử hạn giữ', address: 'Địa chỉ dữ liệu thử cục bộ', phone: '0912345678', owner: owner._id });
  let courtNumber = 0;

  async function courtForTest() {
    return Court.create({ name: `Sân hạn giữ ${++courtNumber}`, facility: facility._id, openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000 });
  }

  function clock(context, time) {
    // Mock only this process's Date; real MongoDB transactions, sockets and timers keep running.
    context.mock.timers.enable({ apis: ['Date'], now: instant(time) });
    return next => context.mock.timers.setTime(instant(next).getTime());
  }

  async function hold(court, times = ['19:00', '16:00'], client = new TestBrowser(environment.base)) {
    const response = await client.hold({ courtId: String(court._id), date, times, guestName: 'Khách kiểm thử hạn giữ', guestPhone: '0912345678' });
    assert.equal(response.status, 303, response.html);
    const details = bookingFromLocation(response.location);
    return { ...details, client };
  }

  async function payment(details) {
    return details.client.post(`/bookings/${details.id}/demo-payment`, { token: details.token });
  }

  async function assertExpired(details) {
    const record = await Booking.findById(details.id).lean();
    assert.equal(record.status, 'EXPIRED');
    assert.equal(record.paymentStatus, 'UNPAID');
    assert.equal(await SlotLock.countDocuments({ booking: details.id }), 0, 'Mọi ô rời nhau của đơn hết hạn phải được giải phóng.');
    assert.equal(await Payment.countDocuments({ booking: details.id }), 0);
  }

  async function makeOldDeadline(details, expiry) {
    await Booking.updateOne({ _id: details.id }, { $set: { holdExpiresAt: instant(expiry) } });
    await SlotLock.updateMany({ booking: details.id }, { $set: { expiresAt: instant(expiry) } });
  }

  await t.test('Đơn mới và tất cả lock lưu cùng hạn 10 phút UTC khi ô đầu còn xa', async context => {
    clock(context, '15:40:00');
    const details = await hold(await courtForTest());
    const record = await Booking.findById(details.id).lean();
    const locks = await SlotLock.find({ booking: details.id }).lean();
    assert.equal(record.createdAt.toISOString(), instant('15:40:00').toISOString());
    assert.equal(record.holdExpiresAt.toISOString(), instant('15:50:00').toISOString());
    assert.equal(locks.length, 2);
    assert.ok(locks.every(lock => lock.expiresAt.toISOString() === record.holdExpiresAt.toISOString()));
  });

  await t.test('Đơn sát giờ lấy ô sớm nhất, lưu đồng nhất UTC và checkout dùng đúng hạn', async context => {
    clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    const record = await Booking.findById(details.id).lean();
    const locks = await SlotLock.find({ booking: details.id }).lean();
    assert.deepEqual(record.slots.map(slot => slot.startAt.toISOString()), ['2030-05-10T09:00:00.000Z', '2030-05-10T12:00:00.000Z']);
    assert.equal(record.holdExpiresAt.toISOString(), '2030-05-10T09:00:00.000Z');
    assert.equal(locks.length, 2);
    assert.ok(locks.every(lock => lock.expiresAt.toISOString() === record.holdExpiresAt.toISOString()));
    const checkout = await details.client.get(details.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /data-hold-until="2030-05-10T09:00:00\.000Z"/);
  });

  await t.test('Không tạo đơn mới tại đúng thời điểm ô đầu đã bắt đầu', async context => {
    clock(context, '16:00:00');
    const court = await courtForTest();
    const client = new TestBrowser(environment.base);
    const result = await client.hold({ courtId: String(court._id), date, times: ['16:00', '19:00'], guestName: 'Khách sát giờ', guestPhone: '0912345678' });
    assert.equal(result.status, 400);
    assert.equal(await Booking.countDocuments({ court: court._id }), 0);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 0);
  });

  await t.test('Trước hạn ô đầu 1 ms vẫn thanh toán được; cleanup và replay không đổi đơn đã xác nhận', async context => {
    const setTime = clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    setTime('15:59:59.999');
    const result = await payment(details);
    assert.equal(result.status, 303, result.html);
    const before = await Booking.findById(details.id).lean();
    assert.equal(before.status, 'CONFIRMED');
    assert.equal(before.paymentStatus, 'DEMO_PAID');
    assert.equal(await SlotLock.countDocuments({ booking: details.id, expiresAt: null }), 2);
    assert.equal(await Payment.countDocuments({ booking: details.id, type: 'INITIAL_DEMO' }), 1);
    setTime('16:00:01');
    await expireHolds();
    assert.equal((await payment(details)).status, 303);
    const after = await Booking.findById(details.id).lean();
    assert.equal(after.status, 'CONFIRMED');
    assert.equal(after.paymentStatus, 'DEMO_PAID');
    assert.deepEqual(after.slots, before.slots);
    assert.equal(after.totalPrice, before.totalPrice);
    assert.equal(await SlotLock.countDocuments({ booking: details.id, expiresAt: null }), 2);
    assert.equal(await Payment.countDocuments({ booking: details.id, type: 'INITIAL_DEMO' }), 1);
  });

  for (const time of ['16:00:00', '16:00:00.001']) {
    await t.test(`Thanh toán tại ${time} trả 410 và commit EXPIRED cùng giải phóng mọi ô`, async context => {
      const setTime = clock(context, '15:55:00');
      const court = await courtForTest();
      const details = await hold(court);
      setTime(time);
      const result = await payment(details);
      assert.equal(result.status, 410, result.html);
      await assertExpired(details);
      assert.equal((await payment(details)).status, 410, 'Gửi lại không được hồi sinh đơn hết hạn.');
      const next = await hold(court, ['19:00', '19:30']);
      assert.notEqual(next.id, details.id);
      assert.equal(await SlotLock.countDocuments({ booking: next.id }), 2);
      assert.equal((await payment(details)).status, 410);
      await assertExpired(details);
    });
  }

  await t.test('Đi qua hạn giữa đọc checkout và transaction payment vẫn commit hết hạn trước khi trả 410', async context => {
    const setTime = clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    setTime('15:59:59.999');
    assert.equal((await details.client.get(details.checkout)).status, 200);
    const probe = mongoose.connection.getClient().startSession();
    const sessionPrototype = Object.getPrototypeOf(probe);
    const startTransaction = sessionPrototype.startTransaction;
    await probe.endSession();
    let transactions = 0;
    // Advance the Date-only clock at the real database transaction boundary, after the viewer check.
    // No database query or transaction result is replaced by a stub.
    context.mock.method(sessionPrototype, 'startTransaction', function (options) {
      transactions++;
      setTime('16:00:00');
      return startTransaction.call(this, options);
    });
    const result = await payment(details);
    assert.equal(result.status, 410, result.html);
    assert.ok(transactions > 0);
    await assertExpired(details);
  });

  await t.test('Chờ ghi lock qua hạn ô đầu không được xác nhận; transaction commit EXPIRED và xóa đủ lock', async context => {
    const setTime = clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    setTime('15:59:59.999');
    const updateMany = SlotLock.updateMany;
    let completedWrites = 0;
    context.mock.method(SlotLock, 'updateMany', function (filter, update, options) {
      const query = updateMany.call(this, filter, update, options);
      if (update?.$set?.expiresAt === null) {
        const execute = query.exec;
        context.mock.method(query, 'exec', async function (...args) {
          const result = await execute.apply(this, args);
          completedWrites++;
          setTime('16:00:00');
          return result;
        });
      }
      return query;
    });
    const result = await payment(details);
    assert.equal(result.status, 410, result.html);
    assert.ok(completedWrites > 0, 'Phải thực sự ghi lock trong transaction trước khi đồng hồ qua hạn.');
    await assertExpired(details);
  });

  await t.test('HOLD cũ lưu hạn muộn hiển thị hạn thực; hết giờ đầu thì payment và checkout đều 410', async context => {
    const setTime = clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    await makeOldDeadline(details, '16:05:00');
    setTime('15:59:00');
    const checkout = await details.client.get(details.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /data-hold-until="2030-05-10T09:00:00\.000Z"/);
    const refreshed = await Booking.findById(details.id).lean();
    assert.equal(refreshed.status, 'HOLD');
    assert.equal(refreshed.holdExpiresAt.toISOString(), '2030-05-10T09:00:00.000Z');
    assert.equal(await SlotLock.countDocuments({ booking: details.id, expiresAt: instant('16:00:00') }), 2);
    setTime('16:00:00');
    assert.equal((await payment(details)).status, 410);
    await assertExpired(details);
    const expiredCheckout = await details.client.get(details.checkout);
    assert.equal(expiredCheckout.status, 410);
    assert.doesNotMatch(expiredCheckout.html, /data-demo-payment/);
  });

  await t.test('Cleanup bắt HOLD cũ đã tới ô đầu dù hạn Booking và lock vẫn còn trong tương lai', async context => {
    const setTime = clock(context, '15:55:00');
    const details = await hold(await courtForTest());
    await makeOldDeadline(details, '16:05:00');
    setTime('16:00:00');
    await expireHolds();
    await assertExpired(details);
    await expireHolds();
    await assertExpired(details);
  });

  await t.test('Cleanup bắt HOLD cũ quá 10 phút từ createdAt dù ô đầu và hạn lưu còn tương lai', async context => {
    const setTime = clock(context, '15:40:00');
    const details = await hold(await courtForTest());
    await makeOldDeadline(details, '16:15:00');
    setTime('15:50:00');
    await expireHolds();
    await assertExpired(details);
  });

  await t.test('Tranh chấp tại ô đầu: payment, cleanup và hai người giữ lại ô sau không hồi sinh hay giữ một phần', async context => {
    const setTime = clock(context, '15:55:00');
    const court = await courtForTest();
    const details = await hold(court);
    await makeOldDeadline(details, '16:05:00');
    const contenders = [new TestBrowser(environment.base), new TestBrowser(environment.base)];
    await Promise.all(contenders.map(client => client.get('/login')));
    setTime('16:00:00');
    const fields = { courtId: String(court._id), date, times: ['19:00', '19:30'], guestName: 'Khách tranh ô được mở lại', guestPhone: '0912345678' };
    const [latePayment, , first, second] = await Promise.all([
      payment(details), expireHolds(), contenders[0].post('/bookings', fields), contenders[1].post('/bookings', fields)
    ]);
    assert.equal(latePayment.status, 410, latePayment.html);
    assert.deepEqual([first.status, second.status].sort(), [303, 409]);
    await assertExpired(details);
    const winner = bookingFromLocation((first.status === 303 ? first : second).location);
    const locks = await SlotLock.find({ court: court._id }).lean();
    assert.equal(locks.length, 2);
    assert.ok(locks.every(lock => String(lock.booking) === winner.id));
    assert.deepEqual(locks.map(lock => lock.slotStart.toISOString()).sort(), ['2030-05-10T12:00:00.000Z', '2030-05-10T12:30:00.000Z']);
    assert.equal(await Booking.countDocuments({ court: court._id, status: 'HOLD' }), 1);
    assert.equal((await payment(details)).status, 410);
    assert.equal(await SlotLock.countDocuments({ booking: winner.id }), 2);
  });

  await t.test('Tranh chấp trước hạn: cleanup không xóa lock của payment thắng, người khác không chiếm ô', async context => {
    const setTime = clock(context, '15:55:00');
    const court = await courtForTest();
    const details = await hold(court);
    const contender = new TestBrowser(environment.base);
    await contender.get('/login');
    setTime('15:59:59.999');
    const [paid, , conflict] = await Promise.all([
      payment(details), expireHolds(), contender.post('/bookings', { courtId: String(court._id), date, times: ['19:00', '19:30'], guestName: 'Khách trùng ô', guestPhone: '0912345678' })
    ]);
    assert.equal(paid.status, 303, paid.html);
    assert.equal(conflict.status, 409);
    assert.equal((await Booking.findById(details.id)).status, 'CONFIRMED');
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 2);
    assert.equal(await SlotLock.countDocuments({ booking: details.id, expiresAt: null }), 2);
    assert.equal(await SlotLock.countDocuments({ court: court._id, slotStart: slotInstant(date, '19:30') }), 0);
    assert.equal(await Payment.countDocuments({ booking: details.id, type: 'INITIAL_DEMO' }), 1);
  });
});
