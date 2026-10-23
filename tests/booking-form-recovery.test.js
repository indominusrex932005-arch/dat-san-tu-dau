import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking, SlotLock } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const password = 'LocalFormRecoveryTest-2026!';
const futureDate = () => new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const decodeAttribute = value => value.replace(/&#(?:x([\da-f]+)|(\d+));|&(amp|lt|gt|quot|apos);/gi,
  (match, hex, decimal, named) => hex || decimal
    ? String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10))
    : ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[named.toLowerCase()]);

function inputAttributes(html, name, value) {
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map(match => {
    const attributes = new Map([...match[0].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)]
      .map(attribute => [attribute[1], decodeAttribute(attribute[2])]));
    for (const boolean of ['checked', 'disabled', 'required']) {
      if (new RegExp(`\\s${boolean}(?:\\s|=|>)`).test(match[0])) attributes.set(boolean, true);
    }
    return attributes;
  });
  const result = inputs.find(input => input.get('name') === name && (value === undefined || input.get('value') === value));
  assert.ok(result, `Expected input ${name}${value === undefined ? '' : `=${value}`}.`);
  return result;
}

function checkedTimes(html) {
  return [...html.matchAll(/<input\b[^>]*>/g)]
    .filter(match => /\bname="times"/.test(match[0]) && /\schecked(?:\s|=|>)/.test(match[0]))
    .map(match => decodeAttribute(match[0].match(/\bvalue="([^"]*)"/)[1])).sort();
}

function assertRecovered(response, court, date, status = 400) {
  assert.equal(response.status, status, response.html);
  assert.match(response.html, /id="slot-booking-form"/);
  assert.match(response.html, /role="alert"/);
  assert.equal(response.location, null, 'A failed booking must render a form without a success redirect.');
  assert.equal(response.headers.get('content-location'), `/courts/${court._id}?date=${date}`);
  assert.equal(inputAttributes(response.html, 'courtId').get('value'), String(court._id));
  assert.equal(inputAttributes(response.html, 'date').get('value'), date);
  assert.match(inputAttributes(response.html, '_csrf').get('value'), /^[a-f0-9]{64}$/);
}

function assertGenericError(response, status) {
  assert.equal(response.status, status, response.html);
  assert.doesNotMatch(response.html, /id="slot-booking-form"/);
  assert.equal(response.headers.get('content-location'), null);
}

test('Khôi phục form đặt sân từ lỗi thật, giữ dữ liệu an toàn và đọc lại lịch trên MongoDB transaction', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, customer] = await User.create([
    { fullName: 'Chủ sân kiểm thử phục hồi', email: 'form-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' },
    { fullName: 'Tên hồ sơ khách', email: 'form-customer@example.test', passwordHash, role: 'CUSTOMER', phone: '0987654321' }
  ]);
  const facility = await Facility.create({ name: 'Cơ sở phục hồi form', address: 'Địa chỉ dữ liệu kiểm thử', phone: '0912345678', owner: owner._id });
  const date = futureDate();
  let courtSequence = 0;
  const browser = () => new TestBrowser(environment.base);
  async function freshCourt(extra = {}) {
    return Court.create({
      name: `Sân phục hồi ${++courtSequence}`, facility: facility._id,
      openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00',
      basePriceVND: 50000, peakPriceVND: 75000, ...extra
    });
  }
  const fields = (court, extra = {}) => ({ courtId: String(court._id), date, times: ['16:30', '19:00'], guestName: ' Người đặt kiểm thử ', guestPhone: '0912345678', ...extra });
  async function noHoldFor(court) {
    assert.equal(await Booking.countDocuments({ court: court._id }), 0, 'An invalid submit must not create a Booking.');
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 0, 'An invalid submit must not reserve any slot.');
  }

  await t.test('Sai điện thoại trả400 ở form thật và giữ tên, điện thoại, ngày cùng các ô hợp lệ', async () => {
    const court = await freshCourt(), client = browser();
    assert.equal((await client.get(`/courts/${court._id}?date=${date}`)).status, 200);
    const rawName = '  Tên khách chưa chuẩn hóa  ', rawPhone = '090abc1234';
    const result = await client.post('/bookings', fields(court, { guestName: rawName, guestPhone: rawPhone }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), rawName);
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), rawPhone);
    assert.deepEqual(checkedTimes(result.html), ['16:30', '19:00']);
    await noHoldFor(court);
  });

  await t.test('Tên bỏ trống giữ nguyên chuỗi trống và SĐT đã nhập, không tạo đơn', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    const result = await client.post('/bookings', fields(court, { guestName: '', guestPhone: '+84 912.345-678' }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), '');
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), '+84 912.345-678');
    assert.deepEqual(checkedTimes(result.html), ['16:30', '19:00']);
    await noHoldFor(court);
  });

  await t.test('Khách đăng nhập xóa rõ tên/SĐT thì lỗi giữ trống, không tự lấy lại dữ liệu hồ sơ', async () => {
    const court = await freshCourt(), client = browser();
    await client.login(customer.email, password);
    const initial = await client.get(`/courts/${court._id}?date=${date}`);
    assert.equal(inputAttributes(initial.html, 'guestName').get('value'), customer.fullName);
    assert.equal(inputAttributes(initial.html, 'guestPhone').get('value'), customer.phone);
    const result = await client.post('/bookings', fields(court, { guestName: '', guestPhone: '' }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), '');
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), '');
    await noHoldFor(court);
  });

  await t.test('Trường người chơi không được gửi vẫn dùng đúng hồ sơ khách khi lỗi chọn giờ, khác với xóa rõ trường', async () => {
    const court = await freshCourt(), client = browser();
    await client.login(customer.email, password);
    const result = await client.post('/bookings', fields(court, { times: undefined, guestName: undefined, guestPhone: undefined }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), customer.fullName);
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), customer.phone);
    assert.deepEqual(checkedTimes(result.html), []);
    await noHoldFor(court);
  });

  await t.test('Tên và SĐT chứa HTML/dấu ngoặc được escape mà vẫn giữ nguyên giá trị nhập', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    const guestName = '<img src=x onerror="alert(38)">', guestPhone = '"><script>alert(38)</script>';
    const result = await client.post('/bookings', fields(court, { guestName, guestPhone }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), guestName);
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), guestPhone);
    assert.ok(!result.html.includes(guestName));
    assert.ok(!result.html.includes(guestPhone));
    assert.doesNotMatch(result.html, /<script>alert\(38\)<\/script>/);
    await noHoldFor(court);
  });

  await t.test('Tên/SĐT dạng mảng không bị stringify thành giá trị hoặc HTML trên form', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    const result = await client.post('/bookings', fields(court, { guestName: ['Tên một', 'Tên hai'], guestPhone: ['0912345678', '0987654321'] }));
    assertRecovered(result, court, date);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), '');
    assert.equal(inputAttributes(result.html, 'guestPhone').get('value'), '');
    await noHoldFor(court);
  });

  await t.test('Alias times[] và ô trùng/sai chỉ khôi phục từng ô đúng một lần, không tạo đơn một phần', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    const data = fields(court, { times: undefined, 'times[]': ['16:30', '16:30', '19:00', '17:15', '<svg/onload=alert(38)>'] });
    const result = await client.post('/bookings', data);
    assertRecovered(result, court, date);
    assert.deepEqual(checkedTimes(result.html), ['16:30', '19:00']);
    assert.doesNotMatch(result.html, /<svg\/onload=alert\(38\)>/);
    await noHoldFor(court);
  });

  await t.test('Thiếu hoặc chỉ gửi ô không hợp lệ vẫn hiện lịch thật và không chọn mặc định', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    for (const times of [undefined, '', ['17:15', '25:00'], '[object Object]']) {
      const result = await client.post('/bookings', fields(court, { times }));
      assertRecovered(result, court, date);
      assert.deepEqual(checkedTimes(result.html), []);
      assert.equal(inputAttributes(result.html, 'times', '16:30').get('disabled'), undefined);
    }
    await noHoldFor(court);
  });

  await t.test('Hai khách HTTP tranh cùng nhiều ô: một303, một409 với lịch cập nhật, chỉ một đơn đủ tất cả lock', async () => {
    const court = await freshCourt(), a = browser(), b = browser();
    await Promise.all([a.get(`/courts/${court._id}?date=${date}`), b.get(`/courts/${court._id}?date=${date}`)]);
    const results = await Promise.all([a.post('/bookings', fields(court)), b.post('/bookings', fields(court))]);
    assert.deepEqual(results.map(result => result.status).sort(), [303, 409]);
    const failed = results.find(result => result.status === 409);
    assertRecovered(failed, court, date, 409);
    assert.deepEqual(checkedTimes(failed.html), []);
    assert.match(failed.html, /Các ô sau đã được bỏ khỏi lựa chọn/);
    for (const time of ['16:30', '19:00']) assert.equal(inputAttributes(failed.html, 'times', time).get('disabled'), true);
    const success = bookingFromLocation(results.find(result => result.status === 303).location);
    const records = await Booking.find({ court: court._id }).lean();
    assert.equal(records.length, 1);
    assert.equal(String(records[0]._id), success.id);
    assert.equal(records[0].slots.length, 2);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 2);
    assert.equal(await SlotLock.countDocuments({ booking: success.id }), 2);
  });

  await t.test('Xung đột một ô giữ lại ô còn trống, bỏ ô bị chiếm, giá mới lấy server và chỉ đặt khi gửi lại rõ ràng', async () => {
    const court = await freshCourt(), winner = browser(), retry = browser();
    await Promise.all([winner.get('/login'), retry.get(`/courts/${court._id}?date=${date}`)]);
    const occupied = await winner.post('/bookings', fields(court, { times: ['19:00'] }));
    assert.equal(occupied.status, 303);
    const winnerId = bookingFromLocation(occupied.location).id;
    await Court.updateOne({ _id: court._id }, { $set: { basePriceVND: 63000, peakPriceVND: 91000 } });
    const failed = await retry.post('/bookings', fields(court, { totalPrice: '1', priceVND: '1' }));
    assertRecovered(failed, court, date, 409);
    assert.deepEqual(checkedTimes(failed.html), ['16:30']);
    assert.equal(inputAttributes(failed.html, 'times', '19:00').get('disabled'), true);
    assert.equal(inputAttributes(failed.html, 'times', '16:30').get('data-price'), '63000');
    assert.match(failed.html, /id="selection-summary"[^>]*>1 ô · 30 phút/);
    assert.match(failed.html, /id="selection-total"[^>]*>63\.000/);
    assert.equal(await Booking.countDocuments({ court: court._id }), 1);
    assert.equal(await SlotLock.countDocuments({ court: court._id }), 1);
    assert.equal(await SlotLock.countDocuments({ court: court._id, slotStart: new Date(`${date}T16:30:00+07:00`) }), 0);
    const corrected = await retry.post('/bookings', fields(court, { times: ['16:30'], totalPrice: '1', priceVND: '1' }));
    assert.equal(corrected.status, 303, corrected.html);
    const record = await Booking.findById(bookingFromLocation(corrected.location).id).lean();
    assert.equal(record.totalPrice, 63000);
    assert.equal(record.slots.length, 1);
    assert.equal(record.slots[0].priceVND, 63000);
    assert.equal(await SlotLock.countDocuments({ booking: record._id }), 1);
    assert.equal(await SlotLock.countDocuments({ booking: winnerId }), 1);
  });

  await t.test('Giờ phục vụ đổi sau khi mở form: bỏ ô không phục vụ, không cấp một phần các ô còn hợp lệ', async () => {
    const court = await freshCourt(), client = browser();
    await client.get(`/courts/${court._id}?date=${date}`);
    await Court.updateOne({ _id: court._id }, { $set: { openTime: '08:00', closeTime: '09:00', peakStartTime: '08:30', peakEndTime: '09:00' } });
    const result = await client.post('/bookings', fields(court, { times: ['08:30', '09:00'] }));
    assertRecovered(result, court, date);
    assert.deepEqual(checkedTimes(result.html), ['08:30']);
    assert.ok(!result.html.includes('value="09:00"'));
    await noHoldFor(court);
    const allClosed = await client.post('/bookings', fields(court, { times: ['19:00'] }));
    assertRecovered(allClosed, court, date);
    assert.deepEqual(checkedTimes(allClosed.html), []);
    await noHoldFor(court);
  });

  await t.test('Cơ sở ngừng nhận đặt trả409 với lịch thật nhưng khóa chọn, giữ thông tin nhập và không tạo đơn', async () => {
    const pendingFacility = await Facility.create({ name: 'Cơ sở chưa được cấp chủ', address: 'Địa chỉ chờ', phone: '0912345678' });
    const court = await freshCourt({ facility: pendingFacility._id }), client = browser();
    await client.get('/login');
    const result = await client.post('/bookings', fields(court));
    assertRecovered(result, court, date, 409);
    assert.deepEqual(checkedTimes(result.html), []);
    assert.equal(inputAttributes(result.html, 'times', '16:30').get('disabled'), true);
    assert.equal(inputAttributes(result.html, 'guestName').get('value'), fields(court).guestName);
    await noHoldFor(court);
  });

  await t.test('courtId thiếu/sai/dạng mảng hoặc ngày thiếu/sai/quá khứ vẫn trả lỗi400, không dựng lịch ngày khác', async () => {
    const court = await freshCourt(), client = browser();
    await client.get('/login');
    const malformed = [
      { courtId: undefined }, { courtId: '' }, { courtId: 'bad-id' }, { courtId: [String(court._id), String(court._id)] },
      { date: undefined }, { date: '' }, { date: '2030-02-30' }, { date: [date, date] }, { date: '2001-01-01' }
    ];
    for (const extra of malformed) assertGenericError(await client.post('/bookings', fields(court, extra)), 400);
    await noHoldFor(court);
  });

  await t.test('Sân bị ngừng hoặc xóa sau khi mở form và ObjectId không tồn tại vẫn404, không che lỗi bằng lịch rỗng', async () => {
    const court = await freshCourt(), client = browser();
    await client.get(`/courts/${court._id}?date=${date}`);
    await Court.updateOne({ _id: court._id }, { $set: { active: false } });
    assertGenericError(await client.post('/bookings', fields(court)), 404);
    await Court.deleteOne({ _id: court._id });
    assertGenericError(await client.post('/bookings', fields(court)), 404);
    assertGenericError(await client.post('/bookings', fields(court, { courtId: String(new mongoose.Types.ObjectId()) })), 404);
    await noHoldFor(court);
  });

  await t.test('CSRF thiếu/sai vẫn403 trên trang lỗi chung, không lọt qua luồng phục hồi form', async () => {
    const court = await freshCourt(), client = browser();
    await client.get(`/courts/${court._id}?date=${date}`);
    assertGenericError(await client.post('/bookings', fields(court, { guestPhone: 'sai' }), { csrf: false }), 403);
    assertGenericError(await client.post('/bookings', fields(court, { _csrf: '0'.repeat(64) })), 403);
    await noHoldFor(court);
  });

  await t.test('Lỗi server khi tạo đơn hoặc đọc lại lịch vẫn500, không giả thành lịch rỗng/thành công', async child => {
    const court = await freshCourt(), client = browser();
    await client.get(`/courts/${court._id}?date=${date}`);
    child.mock.method(Court, 'findOne', () => { throw new Error('private-internal-query-diagnostic'); });
    for (const guestPhone of ['0912345678', 'sai']) {
      const result = await client.post('/bookings', fields(court, { guestPhone }));
      assertGenericError(result, 500);
      assert.match(result.html, /Có lỗi máy chủ/);
      assert.ok(!result.html.includes('private-internal-query-diagnostic'));
    }
    await noHoldFor(court);
  });
});
