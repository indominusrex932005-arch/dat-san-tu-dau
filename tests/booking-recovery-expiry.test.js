import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock, Payment } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const date = '2030-05-10';
const instant = time => new Date(`${date}T${time}+07:00`);
const selectedTimes = html => [...html.matchAll(/<input\b[^>]*>/g)]
  .filter(match => /name="times"/.test(match[0]) && /\schecked(?:\s|=|>)/.test(match[0]))
  .map(match => match[0].match(/value="([^"]*)"/)[1]).sort();
function clock(context, initial) {
  // Change only process-local Date; the HTTP server and database transactions remain real.
  context.mock.timers.enable({ apis: ['Date'], now: instant(initial) });
  return time => context.mock.timers.setTime(instant(time).getTime());
}

test('Phục hồi form và hạn giữ theo ô đầu hoạt động chung qua HTTP/MongoDB', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const owner = await User.create({ fullName: 'Chủ thử phục hồi và hạn giữ', email: 'combined-expiry@example.test', passwordHash: 'local-fixture-not-for-login', role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' });
  const facility = await Facility.create({ name: 'Cơ sở thử tích hợp', address: 'Địa chỉ dữ liệu cục bộ', owner: owner._id, phone: '0912345678' });
  let courtNumber = 0;
  const browser = () => new TestBrowser(environment.base);
  async function freshCourt() {
    return Court.create({ name: `Sân thử tích hợp ${++courtNumber}`, facility: facility._id, openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000 });
  }
  const fields = (court, extra = {}) => ({ courtId: String(court._id), date, times: ['16:00', '19:00'], guestName: ' Khách thử tích hợp ', guestPhone: '0912345678', ...extra });
  async function assertDeadline(details, expiry, times) {
    const record = await Booking.findById(details.id).lean();
    const locks = await SlotLock.find({ booking: details.id }).lean();
    assert.equal(record.status, 'HOLD');
    assert.equal(record.holdExpiresAt.toISOString(), instant(expiry).toISOString());
    assert.deepEqual(record.slots.map(slot => slot.startAt.toISOString()), times.map(time => instant(`${time}:00`).toISOString()));
    assert.equal(locks.length, times.length);
    assert.ok(locks.every(lock => lock.expiresAt.toISOString() === record.holdExpiresAt.toISOString()));
    return record;
  }
  async function assertExpired(client, details) {
    const late = await client.post(`/bookings/${details.id}/demo-payment`, { token: details.token });
    assert.equal(late.status, 410, late.html);
    assert.equal((await Booking.findById(details.id)).status, 'EXPIRED');
    assert.equal(await SlotLock.countDocuments({ booking: details.id }), 0);
    assert.equal(await Payment.countDocuments({ booking: details.id }), 0);
  }

  await t.test('400 giữ thông tin và ô; sửa rồi gửi sát giờ tạo hạn một phút, checkout dùng giờ server và hết hạn không thanh toán được', async context => {
    const setTime = clock(context, '15:58:00');
    const court = await freshCourt(), client = browser();
    assert.equal((await client.get(`/courts/${court._id}?date=${date}`)).status, 200);
    const failed = await client.post('/bookings', fields(court, { guestName: ' Khách <b>cần giữ</b> ', guestPhone: 'sai' }));
    assert.equal(failed.status, 400, failed.html);
    assert.deepEqual(selectedTimes(failed.html), ['16:00', '19:00']);
    assert.match(failed.html, /value=" Khách &lt;b&gt;cần giữ&lt;\/b&gt; "/);
    assert.match(failed.html, /value="sai"/);
    assert.equal(await Booking.countDocuments({ court: court._id }), 0);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 0);
    setTime('15:59:00');
    const retry = await client.post('/bookings', fields(court, { times: selectedTimes(failed.html), guestPhone: '+84 912.345-678' }));
    assert.equal(retry.status, 303, retry.html);
    const details = bookingFromLocation(retry.location);
    const record = await assertDeadline(details, '16:00:00', ['16:00', '19:00']);
    assert.equal(Number(record.holdExpiresAt) - Number(record.createdAt), 60000);
    assert.equal(record.guestPhone, '0912345678');
    const checkout = await client.get(details.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /data-hold-until="2030-05-10T09:00:00\.000Z"/);
    assert.match(checkout.html, /data-server-now="2030-05-10T08:59:00\.000Z"/);
    setTime('16:00:00');
    await assertExpired(client, details);
  });

  await t.test('409 giữ ô sắp bắt đầu còn trống với giá mới; hạn ngắn của retry không xóa lock người khác', async context => {
    const setTime = clock(context, '15:58:00');
    const court = await freshCourt(), otherClient = browser(), client = browser();
    await Promise.all([client.get(`/courts/${court._id}?date=${date}`), otherClient.get('/login')]);
    const occupied = await otherClient.post('/bookings', fields(court, { times: ['19:00'] }));
    assert.equal(occupied.status, 303, occupied.html);
    const other = bookingFromLocation(occupied.location);
    await Court.updateOne({ _id: court._id }, { $set: { basePriceVND: 69000 } });
    const failed = await client.post('/bookings', fields(court));
    assert.equal(failed.status, 409, failed.html);
    assert.deepEqual(selectedTimes(failed.html), ['16:00']);
    assert.match(failed.html, /value="19:00"[^>]*\sdisabled(?:\s|>)/);
    assert.match(failed.html, /value="16:00"[^>]*data-price="69000"/);
    assert.equal(await Booking.countDocuments({ court: court._id }), 1);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 1);
    setTime('15:59:00');
    const retry = await client.post('/bookings', fields(court, { times: selectedTimes(failed.html), totalPrice: '1' }));
    assert.equal(retry.status, 303, retry.html);
    const details = bookingFromLocation(retry.location);
    assert.equal((await assertDeadline(details, '16:00:00', ['16:00'])).totalPrice, 69000);
    setTime('16:00:00');
    await assertExpired(client, details);
    assert.equal((await Booking.findById(other.id)).status, 'HOLD');
    assert.equal(await SlotLock.countDocuments({ booking: other.id }), 1);
    assert.equal((await Booking.findById(other.id)).holdExpiresAt.toISOString(), instant('16:08:00').toISOString());
  });

  await t.test('Ô đầu trôi qua khi nhập bị bỏ sau400; retry các ô còn lại lấy hạn ô mới sớm nhất', async context => {
    const setTime = clock(context, '15:59:59');
    const court = await freshCourt(), client = browser();
    assert.equal((await client.get(`/courts/${court._id}?date=${date}`)).status, 200);
    setTime('16:00:00');
    const failed = await client.post('/bookings', fields(court, { times: ['16:00', '16:30', '19:00'], guestName: ' Khách qua mốc giờ ', guestPhone: '09 1234 5678' }));
    assert.equal(failed.status, 400, failed.html);
    assert.deepEqual(selectedTimes(failed.html), ['16:30', '19:00']);
    assert.match(failed.html, /value="16:00"[^>]*\sdisabled(?:\s|>)/);
    assert.match(failed.html, /value=" Khách qua mốc giờ "/);
    assert.match(failed.html, /value="09 1234 5678"/);
    assert.equal(await Booking.countDocuments({ court: court._id }), 0);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 0);
    setTime('16:25:00');
    const retry = await client.post('/bookings', fields(court, { times: selectedTimes(failed.html) }));
    assert.equal(retry.status, 303, retry.html);
    const details = bookingFromLocation(retry.location);
    const record = await assertDeadline(details, '16:30:00', ['16:30', '19:00']);
    assert.equal(Number(record.holdExpiresAt) - Number(record.createdAt), 5 * 60000);
    const checkout = await client.get(details.checkout);
    assert.equal(checkout.status, 200);
    assert.match(checkout.html, /data-hold-until="2030-05-10T09:30:00\.000Z"/);
    assert.match(checkout.html, /data-server-now="2030-05-10T09:25:00\.000Z"/);
    setTime('16:30:00');
    await assertExpired(client, details);
  });
});
