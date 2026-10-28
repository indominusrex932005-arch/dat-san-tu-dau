import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import bcrypt from 'bcryptjs';
import {
  createTestEnvironment, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest
} from './helpers/database.js';
import { TestBrowser } from './helpers/http.js';
import { slotInstant, vietnamDate } from '../domain/booking-rules.js';

const password = 'LocalCalendarHttpTest-2026!';
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;'
})[character]);
const calendarPath = date => '/owner/calendar' + (date === undefined ? '' : '?date=' + encodeURIComponent(date));
const rowIds = html => [...html.matchAll(/<tr\b[^>]*data-court-id="([a-f\d]{24})"[^>]*>/g)]
  .map(match => match[1]).sort();
const selectedDate = html => [...html.matchAll(/<input\b[^>]*>/g)]
  .find(([tag]) => /\bname="date"/.test(tag))?.[0].match(/\bvalue="([^"]*)"/)?.[1];

test('Lịch OWNER qua HTTP chỉ đọc đúng cơ sở và trả lỗi an toàn', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const passwordHash = await bcrypt.hash(password, 4);
  const definitions = [
    ['ownerA', 'Chủ A', 'OWNER', 'APPROVED'],
    ['ownerB', 'Chủ B', 'OWNER', 'APPROVED'],
    ['emptyOwner', 'Chủ cơ sở rỗng', 'OWNER', 'APPROVED'],
    ['unassigned', 'Chủ chưa được cấp', 'OWNER', 'APPROVED'],
    ['customer', 'Khách hàng', 'CUSTOMER', 'PENDING'],
    ['pending', 'Chủ chờ duyệt', 'OWNER', 'PENDING'],
    ['rejected', 'Chủ bị từ chối', 'OWNER', 'REJECTED'],
    ['admin', 'Quản trị', 'ADMIN', 'PENDING']
  ];
  const users = {};
  for (const [alias, fullName, role, ownerStatus] of definitions) {
    users[alias] = await User.create({
      fullName, email: `calendar-${alias.toLowerCase()}@example.test`, role, ownerStatus, passwordHash
    });
  }
  const facilityName = 'Cơ sở A <script>CALENDAR_XSS</script> & ' + 'CHUOIDAI'.repeat(15);
  const facilityAddress = '<img src=x onerror="CALENDAR_ADDRESS_XSS"> & Địa chỉ thử';
  const [facilityA, facilityB, emptyFacility] = await Facility.create([
    { owner: users.ownerA._id, name: facilityName, address: facilityAddress, phone: '0912345678' },
    { owner: users.ownerB._id, name: 'PRIVATE_CALENDAR_B', address: 'Chỉ thuộc B', phone: '0987654321' },
    { owner: users.emptyOwner._id, name: 'Cơ sở chưa tạo sân', address: 'Địa chỉ rỗng', phone: '0901234567' }
  ]);
  const courtName = 'Sân A <img src=x onerror="CALENDAR_COURT_XSS"> & ' + 'TENDAI'.repeat(12);
  const [courtA, inactiveCourt, courtB] = await Court.create([
    { facility: facilityA._id, name: courtName, openTime: '08:00', closeTime: '10:00',
      peakStartTime: '09:00', peakEndTime: '10:00', basePriceVND: 50000, peakPriceVND: 75000 },
    { facility: facilityA._id, name: 'Sân A tạm ngừng', active: false, openTime: '09:00', closeTime: '11:00',
      peakStartTime: '10:00', peakEndTime: '11:00', basePriceVND: 60000, peakPriceVND: 80000 },
    { facility: facilityB._id, name: 'Sân bí mật của B', openTime: '20:00', closeTime: '22:00',
      peakStartTime: '21:00', peakEndTime: '22:00', basePriceVND: 90000, peakPriceVND: 100000 }
  ]);
  const day = vietnamDate(new Date(Date.now() + 3 * 86400000));
  const laterDay = vietnamDate(new Date(Date.now() + 20 * 86400000));
  const yesterday = vietnamDate(new Date(Date.now() - 86400000));
  const guestSentinel = 'CALENDAR_GUEST_PRIVATE';
  const guestTokenHash = 'b'.repeat(64);
  const booking = await Booking.create({
    facility: facilityA._id, court: courtA._id, publicCode: 'CALENDAR-PRIVATE-CODE',
    guestName: guestSentinel, guestPhone: '0901234567', guestTokenHash,
    date: day, slots: [{ startAt: slotInstant(day, '08:30'), endAt: slotInstant(day, '09:00'), priceVND: 12345 }],
    totalPrice: 12345, status: 'CONFIRMED', paymentStatus: 'DEMO_PAID'
  });
  await SlotLock.create({ court: courtA._id, booking: booking._id, slotStart: slotInstant(day, '08:30') });
  await Payment.create({ booking: booking._id, amountVND: 12345, type: 'INITIAL_DEMO' });
  await BookingRequest.create({ booking: booking._id, user: users.customer._id, type: 'CANCEL', reason: 'Lý do riêng' });
  const clients = {};
  for (const [alias, user] of Object.entries(users)) {
    const client = new TestBrowser(environment.base);
    await client.login(user.email, password);
    clients[alias] = client;
  }
  const snapshot = async () => {
    const result = {};
    for (const Model of [User, Facility, Court, Booking, SlotLock, Payment, BookingRequest]) {
      const records = await Model.find().select('+passwordHash +guestTokenHash').sort({ _id: 1 }).lean();
      result[Model.modelName] = {
        count: records.length, sha256: createHash('sha256').update(JSON.stringify(records)).digest('hex')
      };
    }
    return result;
  };

  await t.test('Khách chuyển sang login; CUSTOMER, ADMIN, OWNER chưa duyệt/bị từ chối/chưa cấp cơ sở không xem được', async () => {
    const guest = await new TestBrowser(environment.base).get(calendarPath(day));
    assert.equal(guest.status, 303);
    assert.equal(guest.location, '/login');
    for (const alias of ['customer', 'admin', 'pending', 'rejected', 'unassigned']) {
      const response = await clients[alias].get(calendarPath(day));
      assert.equal(response.status, 403, alias);
      assert.ok(!response.html.includes(courtName));
      assert.ok(!response.html.includes('PRIVATE_CALENDAR_B'));
      assert.equal(rowIds(response.html).length, 0);
    }
  });

  await t.test('Hai OWNER chỉ thấy đủ sân cơ sở mình, kể cả sân inactive; dữ liệu query không đổi phạm vi', async () => {
    const responseA = await clients.ownerA.get(calendarPath(day));
    const responseB = await clients.ownerB.get(calendarPath(day));
    assert.equal(responseA.status, 200, responseA.html);
    assert.equal(responseB.status, 200, responseB.html);
    const expectedA = [courtA.id, inactiveCourt.id].sort();
    assert.deepEqual(rowIds(responseA.html), expectedA);
    assert.deepEqual(rowIds(responseB.html), [courtB.id]);
    assert.ok(!responseA.html.includes('PRIVATE_CALENDAR_B'));
    assert.ok(!responseA.html.includes(courtB.id));
    assert.ok(!responseB.html.includes(courtA.id));
    assert.ok(!responseB.html.includes(inactiveCourt.id));
    const maliciousQuery = new URLSearchParams({
      date: day, facilityId: facilityB.id, facility: facilityB.id,
      ownerId: users.ownerB.id, owner: users.ownerB.id
    });
    const attemptedSwitch = await clients.ownerA.get('/owner/calendar?' + maliciousQuery);
    assert.equal(attemptedSwitch.status, 200);
    assert.deepEqual(rowIds(attemptedSwitch.html), expectedA);
    assert.ok(!attemptedSwitch.html.includes('PRIVATE_CALENDAR_B'));
    assert.ok(!attemptedSwitch.html.includes(courtB.id));
    // Native fetch rejects GET bodies; use real HTTP to verify that even a
    // parsed body cannot choose the owner, facility, or selected date.
    const body = new URLSearchParams({
      owner: users.ownerB.id, facilityId: facilityB.id, facility: facilityB.id, date: 'not-a-date'
    }).toString();
    const attemptedBodySwitch = await new Promise((resolve, reject) => {
      const connection = request(new URL(calendarPath(day), environment.base), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          Cookie: [...clients.ownerA.cookies].map(([key, value]) => `${key}=${value}`).join('; ')
        }
      }, response => {
        let html = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { html += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, html }));
        response.on('error', reject);
      });
      connection.on('error', reject);
      connection.end(body);
    });
    assert.equal(attemptedBodySwitch.status, 200);
    assert.deepEqual(rowIds(attemptedBodySwitch.html), expectedA);
    assert.equal(selectedDate(attemptedBodySwitch.html), day);
    assert.ok(!attemptedBodySwitch.html.includes('PRIVATE_CALENDAR_B'));
    assert.ok(!attemptedBodySwitch.html.includes(courtB.id));
  });

  await t.test('View tối thiểu có form GET đúng ngày và 7 lựa chọn từ hôm nay; ngày xa hơn vẫn xem được', async () => {
    const defaultResponse = await clients.ownerA.get('/owner/calendar');
    assert.equal(defaultResponse.status, 200);
    assert.equal(selectedDate(defaultResponse.html), vietnamDate());
    assert.match(defaultResponse.html, /<h1\b[^>]*>\s*Lịch điều hành sân\s*<\/h1>/);
    const dateForm = [...defaultResponse.html.matchAll(/<form\b[^>]*>/g)]
      .find(([tag]) => /action="\/owner\/calendar"/.test(tag))?.[0];
    assert.ok(dateForm && /method="GET"/i.test(dateForm));
    const options = [...defaultResponse.html.matchAll(/href="\/owner\/calendar\?date=(\d{4}-\d{2}-\d{2})"/g)]
      .map(match => match[1]);
    const expected = Array.from({ length: 7 }, (_, index) => vietnamDate(new Date(Date.now() + index * 86400000)));
    assert.deepEqual(options, expected);
    const futureResponse = await clients.ownerA.get(calendarPath(laterDay));
    assert.equal(futureResponse.status, 200);
    assert.equal(selectedDate(futureResponse.html), laterDay);
  });

  await t.test('Ngày sai, ngày không tồn tại, quá khứ và ngày lặp trả 400 thay vì lịch rỗng hoặc lỗi 500', async () => {
    for (const raw of ['', 'not-a-date', '24/10/2026', '2030-02-30', '2030-13-01', yesterday]) {
      const response = await clients.ownerA.get(calendarPath(raw));
      assert.equal(response.status, 400, JSON.stringify(raw));
      assert.equal(rowIds(response.html).length, 0);
      assert.ok(!response.html.includes('Cơ sở chưa có sân.'));
    }
    for (const query of [`date=${day}&date=${day}`, `date=${day}&date=${laterDay}`, 'date=&date=']) {
      const response = await clients.ownerA.get('/owner/calendar?' + query);
      assert.equal(response.status, 400, query);
      assert.equal(rowIds(response.html).length, 0);
    }
  });

  await t.test('Cơ sở chưa có sân render 200 với trạng thái rỗng, không mượn trục giờ hoặc sân cơ sở khác', async () => {
    const response = await clients.emptyOwner.get(calendarPath(day));
    assert.equal(response.status, 200, response.html);
    assert.match(response.html, /Cơ sở chưa có sân\./);
    assert.equal(rowIds(response.html).length, 0);
    assert.ok(!response.html.includes('data-time='));
    assert.ok(response.html.includes(escape(emptyFacility.name)));
    assert.ok(!response.html.includes('PRIVATE_CALENDAR_B'));
  });

  await t.test('Tên cơ sở/địa chỉ/tên sân dài được escape; lịch không lộ người đặt, mã đơn hoặc token', async () => {
    const response = await clients.ownerA.get(calendarPath(day));
    for (const value of [facilityName, facilityAddress, courtName]) {
      assert.ok(response.html.includes(escape(value)), value);
      assert.ok(!response.html.includes(value));
    }
    for (const privateValue of [guestSentinel, guestTokenHash, booking.id, booking.publicCode]) {
      assert.ok(!response.html.includes(privateValue), privateValue);
    }
    assert.ok(!/guestTokenHash|[?&]token=/.test(response.html));
    assert.match(response.html, /Tạm ngừng/);
    assert.match(response.html, /data-status="BOOKED"/);
    assert.match(response.html, /data-status="UNAVAILABLE"/);
  });

  await t.test('Mọi GET lịch, cả ngày lỗi và query đổi cơ sở, không sửa dữ liệu nghiệp vụ, bảng giá hoặc quyền', async () => {
    const before = await snapshot();
    const paths = [
      '/owner/calendar', calendarPath(day), calendarPath(laterDay),
      calendarPath(yesterday), calendarPath('2030-02-30'),
      `/owner/calendar?date=${day}&facilityId=${facilityB.id}&owner=${users.ownerB.id}`
    ];
    for (const path of paths) await clients.ownerA.get(path);
    await clients.ownerB.get(calendarPath(day));
    await clients.emptyOwner.get(calendarPath(day));
    assert.deepEqual(await snapshot(), before);
  });

  await t.test('Lỗi đọc Facility/Court/SlotLock trả 500 chung, không bị biến thành trang lịch trống', async child => {
    for (const [Model, method] of [[Facility, 'findOne'], [Court, 'find'], [SlotLock, 'find']]) {
      try {
        child.mock.method(Model, method, () => { throw new Error('PRIVATE_DATABASE_ERROR_CALENDAR'); });
        const response = await clients.ownerA.get(calendarPath(day));
        assert.equal(response.status, 500, Model.modelName);
        assert.ok(!response.html.includes('Cơ sở chưa có sân.'));
        assert.ok(!response.html.includes('PRIVATE_DATABASE_ERROR_CALENDAR'));
        assert.equal(rowIds(response.html).length, 0);
      } finally {
        child.mock.restoreAll();
      }
    }
  });

  await t.test('Session cũ mất quyền ngay khi DB thu hồi duyệt/vai trò hoặc chuyển cơ sở sang OWNER khác', async () => {
    try {
      await User.updateOne({ _id: users.ownerA._id }, { $set: { ownerStatus: 'REJECTED' } });
      assert.equal((await clients.ownerA.get(calendarPath(day))).status, 403);
      await User.updateOne({ _id: users.ownerA._id }, { $set: { ownerStatus: 'APPROVED', role: 'CUSTOMER' } });
      assert.equal((await clients.ownerA.get(calendarPath(day))).status, 403);
      await User.updateOne({ _id: users.ownerA._id }, { $set: { role: 'OWNER' } });
      await Facility.updateOne({ _id: facilityA._id }, { $set: { owner: users.unassigned._id } });
      assert.equal((await clients.ownerA.get(calendarPath(day))).status, 403);
      const replacement = await clients.unassigned.get(calendarPath(day));
      assert.equal(replacement.status, 200);
      assert.deepEqual(rowIds(replacement.html), [courtA.id, inactiveCourt.id].sort());
    } finally {
      await User.updateOne({ _id: users.ownerA._id }, { $set: { ownerStatus: 'APPROVED', role: 'OWNER' } });
      await Facility.updateOne({ _id: facilityA._id }, { $set: { owner: users.ownerA._id } });
    }
  });

  await t.test('Trang công khai và quản lý cơ sở hiện có vẫn mở được sau khi thêm route lịch', async () => {
    const guest = new TestBrowser(environment.base);
    for (const path of ['/', '/facilities', '/courts', '/login']) {
      assert.equal((await guest.get(path)).status, 200, path);
    }
    assert.equal((await clients.ownerA.get('/owner')).status, 200);
  });
});
