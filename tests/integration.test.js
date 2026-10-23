import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const password = 'LocalTestPassword-2026!';
const futureDate = days => new Date(Date.now() + days * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
const denial = response => assert.ok([403, 404].includes(response.status), `Expected denied access; got ${response.status}.`);

test('Đặt nhiều ô, vai trò, khách vãng lai và xử lý đơn trên MongoDB transaction thật', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const browser = () => new TestBrowser(environment.base);
  const passwordHash = await bcrypt.hash(password, 4);
  const [admin, owner, otherOwner, customer, otherCustomer] = await User.create([
    { fullName: 'Quản trị kiểm thử', email: 'admin@example.test', passwordHash, role: 'ADMIN' },
    { fullName: 'Chủ sân A', email: 'owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED', phone: '0912345678' },
    { fullName: 'Chủ sân B', email: 'other-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED', phone: '0987654321' },
    { fullName: 'Khách A', email: 'customer@example.test', passwordHash, role: 'CUSTOMER', phone: '0912345678' },
    { fullName: 'Khách B', email: 'other-customer@example.test', passwordHash, role: 'CUSTOMER' }
  ]);
  const [facility, otherFacility, unownedFacility] = await Facility.create([
    { name: 'Cơ sở A', address: 'Địa chỉ A', phone: '0912345678', owner: owner._id },
    { name: 'Cơ sở B', address: 'Địa chỉ B', phone: '0987654321', owner: otherOwner._id },
    { name: 'Cơ sở chưa cấp', address: 'Địa chỉ chờ cấp', phone: '0912345678' }
  ]);
  const defaults = { openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00', basePriceVND: 50000, peakPriceVND: 75000 };
  const [court, secondCourt, foreignCourt] = await Court.create([
    { ...defaults, name: 'Sân A1', facility: facility._id },
    { ...defaults, name: 'Sân A2', facility: facility._id, basePriceVND: 70000, peakPriceVND: 90000 },
    { ...defaults, name: 'Sân B1', facility: otherFacility._id }
  ]);
  const date = futureDate(3);
  const adminBrowser = browser(), ownerBrowser = browser(), foreignOwnerBrowser = browser(), customerBrowser = browser(), foreignCustomerBrowser = browser();
  await adminBrowser.login(admin.email, password);
  await ownerBrowser.login(owner.email, password);
  await foreignOwnerBrowser.login(otherOwner.email, password);
  await customerBrowser.login(customer.email, password);
  await foreignCustomerBrowser.login(otherCustomer.email, password);
  let guestBooking;
  let accountBooking;

  async function holdAs(client, targetCourt, times, selectedDate = date, extra = {}) {
    const response = await client.hold({ courtId: String(targetCourt._id), date: selectedDate, times, guestName: 'Khách kiểm thử', guestPhone: '0912345678', ...extra });
    assert.equal(response.status, 303, response.html);
    const details = bookingFromLocation(response.location);
    await client.get(details.checkout);
    return details;
  }

  async function payAs(client, details) {
    const result = await client.post(`/bookings/${details.id}/demo-payment`, { token: details.token });
    assert.equal(result.status, 303, result.html);
    return result;
  }

  await t.test('Đăng ký khách kiểm tra dữ liệu, CSRF và không nhận quyền từ client', async () => {
    const client = browser();
    assert.equal((await client.get('/register')).status, 200);
    const fields = { fullName: ' Người mới <script>alert(1)</script> ', email: ' New@Example.Test ', password, confirmPassword: password, role: 'ADMIN', ownerStatus: 'APPROVED' };
    assert.equal((await client.post('/register', fields, { csrf: false })).status, 403);
    assert.equal((await client.post('/register', { ...fields, confirmPassword: 'wrong-password' })).status, 400);
    const created = await client.post('/register', fields);
    assert.equal(created.status, 303);
    const user = await User.findOne({ email: 'new@example.test' }).select('+passwordHash').lean();
    assert.equal(user.role, 'CUSTOMER');
    assert.equal(await bcrypt.compare(password, user.passwordHash), true);
    assert.notEqual(user.passwordHash, password);
    assert.equal((await User.findById(user._id).lean()).passwordHash, undefined);
    const duplicate = await client.post('/register', fields);
    assert.equal(duplicate.status, 409);
    assert.ok(!duplicate.html.includes(`value="${password}"`));
    assert.equal((await client.post('/register', { ...fields, email: ['a@test.vn', 'b@test.vn'] })).status, 400);
    await client.login('new@example.test', password);
    const home = await client.get('/courts');
    assert.ok(!home.html.includes('<script>alert(1)</script>'));
    denial(await client.get('/admin'));
  });

  await t.test('Chủ sân đăng ký phải chờ admin, không tự nhận cơ sở hoặc tự duyệt', async () => {
    const client = browser();
    assert.equal((await client.get('/register/owner')).status, 200);
    const result = await client.post('/register/owner', {
      fullName: 'Chủ sân chờ duyệt', email: 'pending-owner@example.test', password, confirmPassword: password,
      phone: '0912345678', requestedFacilityName: 'Cơ sở đề nghị', requestedFacilityAddress: 'Địa chỉ đề nghị',
      role: 'ADMIN', ownerStatus: 'APPROVED', facilityId: String(facility._id)
    });
    assert.equal(result.status, 303, result.html);
    const applicant = await User.findOne({ email: 'pending-owner@example.test' }).lean();
    assert.equal(applicant.role, 'OWNER');
    assert.equal(applicant.ownerStatus, 'PENDING');
    assert.equal(await Facility.countDocuments({ owner: applicant._id }), 0);
    await client.login(applicant.email, password);
    assert.equal((await client.get('/owner')).status, 200);
    denial(await client.post('/owner/courts', { name: 'Không được tạo', facility: String(facility._id), ...defaults }));
    denial(await customerBrowser.post(`/admin/owners/${applicant._id}/approve`, { facilityId: String(unownedFacility._id) }));
    const occupied = await adminBrowser.post(`/admin/owners/${applicant._id}/approve`, { facilityId: String(facility._id) });
    assert.equal(occupied.status, 409);
    assert.equal((await User.findById(applicant._id)).ownerStatus, 'PENDING');
    assert.equal(String((await Facility.findById(facility._id)).owner), String(owner._id));
    const approval = await adminBrowser.post(`/admin/owners/${applicant._id}/approve`, { facilityId: String(unownedFacility._id) });
    assert.equal(approval.status, 303, approval.html);
    assert.equal((await User.findById(applicant._id)).ownerStatus, 'APPROVED');
    assert.equal(String((await Facility.findById(unownedFacility._id)).owner), String(applicant._id));
    assert.equal((await client.get('/owner')).status, 200);
    assert.equal(String((await Facility.findById(facility._id)).owner), String(owner._id));
  });

  await t.test('Chủ sân chỉ sửa sân của mình, giá tính theo ô 30 phút', async () => {
    denial(await foreignOwnerBrowser.get(`/owner/courts/${court._id}/edit`));
    denial(await foreignOwnerBrowser.post(`/owner/courts/${court._id}`, { name: 'Bị chiếm', ...defaults }));
    assert.equal((await Court.findById(court._id)).name, 'Sân A1');
    const result = await ownerBrowser.post('/owner/courts', { ...defaults, name: 'Sân quản lý tạo', facility: String(otherFacility._id), active: 'on' });
    assert.equal(result.status, 303, result.html);
    const record = await Court.findOne({ name: 'Sân quản lý tạo' });
    assert.equal(String(record.facility), String(facility._id));
    const invalid = await ownerBrowser.post(`/owner/courts/${record._id}`, { ...defaults, name: record.name, closeTime: '05:00' });
    assert.equal(invalid.status, 400);
    assert.equal((await Court.findById(record._id)).closeTime, '22:00');
  });

  await t.test('Hai lần duyệt đồng thời không thể cấp một cơ sở cho hai chủ sân', async () => {
    const applications = await User.create([
      { fullName: 'Chủ chờ thứ nhất', email: 'race-owner-one@example.test', passwordHash, role: 'OWNER', ownerStatus: 'PENDING', phone: '0912345678', requestedFacilityName: 'Đề nghị một', requestedFacilityAddress: 'Địa chỉ một' },
      { fullName: 'Chủ chờ thứ hai', email: 'race-owner-two@example.test', passwordHash, role: 'OWNER', ownerStatus: 'PENDING', phone: '0912345678', requestedFacilityName: 'Đề nghị hai', requestedFacilityAddress: 'Địa chỉ hai' }
    ]);
    const target = await Facility.create({ name: 'Cơ sở tranh quyền cấp', address: 'Địa chỉ mới' });
    const secondAdmin = browser();
    await secondAdmin.login(admin.email, password);
    const outcomes = await Promise.all([
      adminBrowser.post(`/admin/owners/${applications[0]._id}/approve`, { facilityId: String(target._id) }),
      secondAdmin.post(`/admin/owners/${applications[1]._id}/approve`, { facilityId: String(target._id) })
    ]);
    assert.deepEqual(outcomes.map(item => item.status).sort(), [303, 409]);
    const approved = await User.find({ _id: { $in: applications.map(item => item._id) }, ownerStatus: 'APPROVED' }).lean();
    assert.equal(approved.length, 1);
    assert.equal(String((await Facility.findById(target._id)).owner), String(approved[0]._id));
  });

  await t.test('Khách vãng lai giữ đúng ô rời nhau, server tính lại giá và không nhận user giả', async () => {
    const guest = browser();
    guestBooking = { client: guest, ...await holdAs(guest, court, ['16:30', '17:00', '19:00'], date, { totalPrice: 1, user: String(admin._id), status: 'CONFIRMED', paymentStatus: 'PAID' }) };
    const record = await Booking.findById(guestBooking.id).select('+guestTokenHash').lean();
    assert.equal(record.status, 'HOLD');
    assert.equal(record.paymentStatus, 'UNPAID');
    assert.ok(!record.user);
    assert.equal(record.totalPrice, 200000);
    assert.equal(record.slots.length, 3);
    assert.equal(await SlotLock.countDocuments({ booking: record._id }), 3);
    assert.ok(record.guestTokenHash);
    assert.notEqual(record.guestTokenHash, guestBooking.token);
    assert.equal((await Booking.findById(record._id).lean()).guestTokenHash, undefined);
    assert.ok(new Date(record.holdExpiresAt).getTime() > Date.now() + 9 * 60000);
    assert.ok(new Date(record.holdExpiresAt).getTime() <= Date.now() + 10 * 60000 + 2000);
    const outsider = browser();
    denial(await outsider.get(`/bookings/${record._id}/checkout`));
    denial(await outsider.get(`/bookings/${record._id}/checkout?token=wrong-token`));
    const deniedRequest = await guest.post(`/bookings/${record._id}/requests`, { type: 'CANCEL', token: guestBooking.token });
    assert.ok([302, 303, 403].includes(deniedRequest.status));
    assert.equal(await BookingRequest.countDocuments({ booking: record._id }), 0);
  });

  await t.test('Thanh toán chỉ mô phỏng, idempotent; phiếu có nhãn và lưu PDF', async () => {
    const { client } = guestBooking;
    const first = await payAs(client, guestBooking);
    const record = await Booking.findById(guestBooking.id);
    assert.equal(record.status, 'CONFIRMED');
    assert.equal(record.paymentStatus, 'DEMO_PAID');
    assert.equal(await SlotLock.countDocuments({ booking: record._id, expiresAt: null }), 3);
    assert.equal(await Payment.countDocuments({ booking: record._id, type: 'INITIAL_DEMO' }), 1);
    const receipt = await client.get(first.location);
    assert.equal(receipt.status, 200);
    assert.match(receipt.html, /mô phỏng/i);
    assert.match(receipt.html, /PDF|In phiếu|In \/ Lưu/i);
    assert.ok(receipt.html.includes(record.publicCode));
    assert.ok(receipt.html.includes('0912345678'));
    const second = await client.post(`/bookings/${record._id}/demo-payment`, { token: guestBooking.token });
    assert.equal(second.status, 303, second.html);
    assert.equal(await Payment.countDocuments({ booking: record._id, type: 'INITIAL_DEMO' }), 1);
  });

  await t.test('Hai request đồng thời tranh cùng ô: một thắng, một 409; không chiếm ô một phần', async () => {
    const a = browser(), b = browser();
    await Promise.all([a.get('/login'), b.get('/login')]);
    const data = { courtId: String(court._id), date, times: ['08:00'], guestName: 'Khách tranh ô', guestPhone: '0912345678' };
    const outcomes = await Promise.all([a.post('/bookings', data), b.post('/bookings', data)]);
    assert.deepEqual(outcomes.map(item => item.status).sort(), [303, 409]);
    const slotStart = new Date(`${date}T08:00:00+07:00`);
    assert.equal(await SlotLock.countDocuments({ court: court._id, slotStart }), 1);
    const before = await Booking.countDocuments();
    const partial = await b.post('/bookings', { ...data, times: ['08:00', '08:30'] });
    assert.equal(partial.status, 409);
    assert.equal(await Booking.countDocuments(), before);
    assert.equal(await SlotLock.countDocuments({ court: court._id, slotStart: new Date(`${date}T08:30:00+07:00`) }), 0);
  });

  await t.test('Hết 10 phút giải phóng ô và từ chối thanh toán muộn', async () => {
    const expiredClient = browser();
    const details = await holdAs(expiredClient, court, ['09:00', '09:30']);
    const past = new Date(Date.now() - 1000);
    await Booking.updateOne({ _id: details.id }, { $set: { holdExpiresAt: past } });
    await SlotLock.updateMany({ booking: details.id }, { $set: { expiresAt: past } });
    const late = await expiredClient.post(`/bookings/${details.id}/demo-payment`, { token: details.token });
    assert.equal(late.status, 410);
    const nextClient = browser();
    await holdAs(nextClient, court, ['09:00', '09:30']);
    assert.equal((await Booking.findById(details.id)).status, 'EXPIRED');
    assert.equal(await Payment.countDocuments({ booking: details.id }), 0);
    assert.equal(await SlotLock.countDocuments({ booking: details.id }), 0);
  });

  await t.test('Tắt DEMO_MODE không được xác nhận tiền mô phỏng', async () => {
    const client = browser();
    const details = await holdAs(client, court, ['10:00']);
    const { simulatePayment } = await import('../services/booking.service.js');
    process.env.DEMO_MODE = 'false';
    try {
      await assert.rejects(simulatePayment(details.id, { token: details.token }), error => error.status >= 400 && error.status < 500);
      assert.equal((await Booking.findById(details.id)).paymentStatus, 'UNPAID');
    } finally { process.env.DEMO_MODE = 'true'; }
  });

  await t.test('NODE_ENV production chặn mô phỏng dù DEMO_MODE bật', async () => {
    const client = browser();
    const details = await holdAs(client, court, ['10:30']);
    const { simulatePayment } = await import('../services/booking.service.js');
    process.env.NODE_ENV = 'production';
    try {
      await assert.rejects(simulatePayment(details.id, { token: details.token }), error => error.status === 403);
      assert.equal((await Booking.findById(details.id)).paymentStatus, 'UNPAID');
      assert.equal(await Payment.countDocuments({ booking: details.id }), 0);
    } finally { process.env.NODE_ENV = 'test'; }
  });

  await t.test('Khách có tài khoản chỉ xem/quản lý đơn của mình', async () => {
    accountBooking = await holdAs(customerBrowser, court, ['11:00', '11:30'], date, { user: String(otherCustomer._id) });
    assert.equal(accountBooking.token, '');
    const record = await Booking.findById(accountBooking.id);
    assert.equal(String(record.user), String(customer._id));
    denial(await foreignCustomerBrowser.get(`/bookings/${record._id}/receipt`));
    denial(await foreignCustomerBrowser.post(`/bookings/${record._id}/requests`, { type: 'CANCEL', reason: 'Không phải đơn của tôi' }));
    await payAs(customerBrowser, accountBooking);
    const history = await customerBrowser.get('/my-bookings');
    assert.equal(history.status, 200);
    assert.ok(history.html.includes(record.publicCode));
    assert.ok(!(await foreignCustomerBrowser.get('/my-bookings')).html.includes(record.publicCode));
  });

  await t.test('Yêu cầu hủy giữ lịch đến khi chủ sân duyệt, hoàn tiền chỉ ghi nhận thủ công', async () => {
    const result = await customerBrowser.post(`/bookings/${accountBooking.id}/requests`, { type: 'CANCEL', reason: 'Không thể đến sân' });
    assert.equal(result.status, 303, result.html);
    const request = await BookingRequest.findOne({ booking: accountBooking.id, status: 'PENDING' });
    assert.ok(request);
    assert.equal((await Booking.findById(accountBooking.id)).status, 'CONFIRMED');
    assert.equal(await SlotLock.countDocuments({ booking: accountBooking.id }), 2);
    assert.equal((await customerBrowser.post(`/bookings/${accountBooking.id}/requests`, { type: 'CANCEL', reason: 'Gửi lại' })).status, 409);
    denial(await foreignOwnerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 0 }));
    const overRefund = await ownerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 999999999, ownerNote: 'Sai số tiền' });
    assert.equal(overRefund.status, 400);
    assert.equal((await BookingRequest.findById(request._id)).status, 'PENDING');
    const approved = await ownerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 50000, ownerNote: 'Đồng ý hủy; hoàn thủ công' });
    assert.equal(approved.status, 303, approved.html);
    const record = await BookingRequest.findById(request._id);
    assert.equal(record.status, 'APPROVED');
    assert.equal(record.refundStatus, 'PENDING');
    assert.equal(record.refundAmount, 50000);
    assert.equal((await Booking.findById(accountBooking.id)).status, 'CANCELLED');
    assert.equal(await SlotLock.countDocuments({ booking: accountBooking.id }), 0);
    denial(await foreignOwnerBrowser.post(`/owner/requests/${request._id}/refund`, { ownerNote: 'Không có quyền' }));
    const transferred = await ownerBrowser.post(`/owner/requests/${request._id}/refund`, { ownerNote: 'Đã ghi nhận hoàn theo thỏa thuận' });
    assert.equal(transferred.status, 303, transferred.html);
    assert.equal((await BookingRequest.findById(request._id)).refundStatus, 'TRANSFERRED');
  });

  await t.test('Đổi lịch thất bại giữ đơn cũ; từ chối đổi sang cơ sở khác', async () => {
    const details = await holdAs(customerBrowser, court, ['12:00']);
    await payAs(customerBrowser, details);
    const crossFacility = await customerBrowser.post(`/bookings/${details.id}/requests`, {
      type: 'CHANGE', reason: 'Sang chủ sân khác', requestedCourt: String(foreignCourt._id), requestedDate: date, requestedTimes: ['12:00']
    });
    assert.ok([400, 403, 404].includes(crossFacility.status));
    const submitted = await customerBrowser.post(`/bookings/${details.id}/requests`, {
      type: 'CHANGE', reason: 'Đổi sang sân bên cạnh', requestedCourt: String(secondCourt._id), requestedDate: date, requestedTimes: ['12:00']
    });
    assert.equal(submitted.status, 303, submitted.html);
    const request = await BookingRequest.findOne({ booking: details.id, status: 'PENDING' });
    await holdAs(browser(), secondCourt, ['12:00']);
    const conflict = await ownerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 0, extraPaymentConfirmed: 'on', ownerNote: 'Thử duyệt khi đã có người khác giữ' });
    assert.equal(conflict.status, 409, conflict.html);
    const old = await Booking.findById(details.id);
    assert.equal(String(old.court), String(court._id));
    assert.equal(old.status, 'CONFIRMED');
    assert.equal(await SlotLock.countDocuments({ booking: old._id }), 1);
    assert.equal((await BookingRequest.findById(request._id)).status, 'PENDING');
    assert.equal((await ownerBrowser.post(`/owner/requests/${request._id}/reject`, { ownerNote: 'Chưa có lịch phù hợp' })).status, 303);
    assert.equal((await BookingRequest.findById(request._id)).status, 'REJECTED');
    assert.equal((await Booking.findById(details.id)).status, 'CONFIRMED');
  });

  await t.test('Đổi nhiều ô thành công cần xác nhận khoản chênh lệch', async () => {
    const details = await holdAs(customerBrowser, court, ['13:00']);
    await payAs(customerBrowser, details);
    const submitted = await customerBrowser.post(`/bookings/${details.id}/requests`, {
      type: 'CHANGE', reason: 'Cần nhiều thời gian hơn', requestedCourt: String(secondCourt._id), requestedDate: date, requestedTimes: ['13:00', '19:00']
    });
    assert.equal(submitted.status, 303, submitted.html);
    const request = await BookingRequest.findOne({ booking: details.id, status: 'PENDING' });
    const withoutExtra = await ownerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 0, ownerNote: 'Chưa xác nhận chênh lệch' });
    assert.ok([400, 409].includes(withoutExtra.status));
    assert.equal(String((await Booking.findById(details.id)).court), String(court._id));
    const approval = await ownerBrowser.post(`/owner/requests/${request._id}/approve`, { refundAmount: 0, extraPaymentConfirmed: 'on', ownerNote: 'Đã xử lý chênh lệch mô phỏng' });
    assert.equal(approval.status, 303, approval.html);
    const updated = await Booking.findById(details.id);
    assert.equal(String(updated.court), String(secondCourt._id));
    assert.equal(updated.totalPrice, 160000);
    assert.equal(updated.slots.length, 2);
    assert.equal(await SlotLock.countDocuments({ booking: updated._id, expiresAt: null }), 2);
    assert.equal((await BookingRequest.findById(request._id)).extraAmount, 110000);
  });

  await t.test('Chủ sân xử lý hủy qua điện thoại cho khách vãng lai', async () => {
    denial(await foreignOwnerBrowser.post(`/owner/bookings/${guestBooking.id}/cancel`, { refundAmount: 0, ownerNote: 'Không thuộc cơ sở' }));
    const cancellation = await ownerBrowser.post(`/owner/bookings/${guestBooking.id}/cancel`, { refundAmount: 0, ownerNote: 'Khách gọi điện xin hủy' });
    assert.equal(cancellation.status, 303, cancellation.html);
    assert.equal((await Booking.findById(guestBooking.id)).status, 'CANCELLED');
    assert.equal(await SlotLock.countDocuments({ booking: guestBooking.id }), 0);
    const request = await BookingRequest.findOne({ booking: guestBooking.id, source: 'OWNER_CALL' });
    assert.equal(request.status, 'APPROVED');
  });
});
