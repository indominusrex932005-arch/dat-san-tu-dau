import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, mongoose, User, Facility, Court, Booking } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const password = 'LocalOwnerFacilityTest-2026!';
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;'
})[character]);
function fieldValue(html, name) {
  const textarea = html.match(new RegExp(`<textarea\\b[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</textarea>`));
  if (textarea) return textarea[1];
  const input = [...html.matchAll(/<input\b[^>]*>/g)].find(([tag]) => tag.includes(`name="${name}"`))?.[0];
  assert.ok(input, `Không có trường ${name}.`);
  return input.match(/\bvalue="([^"]*)"/)?.[1] ?? '';
}

test('OWNER sửa thông tin đúng cơ sở qua HTTP, kiểm tra quyền và dữ liệu trên MongoDB cục bộ', { timeout: 120000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, otherOwner, unassignedOwner, customer, pendingOwner, rejectedOwner, admin] = await User.create([
    { fullName: 'Chủ cơ sở A', email: 'facility-owner@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash },
    { fullName: 'Chủ cơ sở B', email: 'facility-other@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash },
    { fullName: 'Chủ chưa được cấp cơ sở', email: 'facility-unassigned@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash },
    { fullName: 'Khách hàng', email: 'facility-customer@example.test', role: 'CUSTOMER', passwordHash },
    { fullName: 'Chủ chờ duyệt', email: 'facility-pending@example.test', role: 'OWNER', ownerStatus: 'PENDING', passwordHash },
    { fullName: 'Chủ bị từ chối', email: 'facility-rejected@example.test', role: 'OWNER', ownerStatus: 'REJECTED', passwordHash },
    { fullName: 'Quản trị', email: 'facility-admin@example.test', role: 'ADMIN', passwordHash }
  ]);
  const [facility, otherFacility] = await Facility.create([
    { name: 'Cơ sở A', address: 'Địa chỉ A', phone: '0912345678', owner: owner._id },
    { name: 'Cơ sở B', address: 'Địa chỉ B', phone: '0987654321', owner: otherOwner._id }
  ]);
  const editPath = `/owner/facilities/${facility._id}/edit`;
  const savePath = `/owner/facilities/${facility._id}`;
  const valid = { name: 'Cơ sở đổi tên', address: 'Địa chỉ cập nhật', phone: '0901234567' };
  const clientFor = async user => {
    const client = new TestBrowser(environment.base);
    await client.login(user.email, password);
    return client;
  };
  const ownerClient = await clientFor(owner);
  const otherClient = await clientFor(otherOwner);
  const readFacility = () => Facility.findById(facility._id).lean();
  const editable = record => ({ name: record.name, address: record.address, phone: record.phone });

  await t.test('Khách chưa đăng nhập phải vào login; CUSTOMER, OWNER chưa duyệt/bị từ chối và ADMIN không sửa được', async () => {
    const guest = new TestBrowser(environment.base);
    await guest.get('/login');
    const before = editable(await readFacility());
    for (const response of [await guest.get(editPath), await guest.post(savePath, valid)]) {
      assert.equal(response.status, 303);
      assert.equal(response.location, '/login');
    }
    for (const user of [customer, pendingOwner, rejectedOwner, admin]) {
      const client = await clientFor(user);
      assert.equal((await client.get(editPath)).status, 403, user.role + '/' + user.ownerStatus);
      assert.equal((await client.post(savePath, valid)).status, 403, user.role + '/' + user.ownerStatus);
    }
    assert.deepEqual(editable(await readFacility()), before);
  });

  await t.test('Form cơ sở thật giữ đúng action, method, ba trường cho phép và CSRF; không gửi quyền/chủ cơ sở ẩn', async () => {
    const response = await ownerClient.get(editPath);
    assert.equal(response.status, 200);
    assert.match(response.html, new RegExp(`action="${savePath}"[^>]*method="POST"`));
    assert.match(response.html, /name="_csrf"[^>]*value="[a-f0-9]{64}"/);
    for (const [key, value] of Object.entries(editable(facility))) {
      assert.equal(fieldValue(response.html, key), escape(value));
    }
    assert.ok(!/name="(?:owner|ownerId|facilityId|_id|role|ownerStatus)"/.test(response.html));
    assert.match(response.html, /href="\/owner"/);
    assert.ok((await ownerClient.get('/owner')).html.includes(`href="${editPath}"`));
    const publicList = await new TestBrowser(environment.base).get('/facilities');
    assert.equal(publicList.status, 200);
    assert.ok(!publicList.html.includes('/owner/facilities/'));
  });

  await t.test('OWNER khác không đọc hoặc ghi cơ sở, mã sai 400, mã không tồn tại 404; tài khoản chưa cấp cơ sở 403', async () => {
    const before = editable(await readFacility());
    assert.equal((await otherClient.get(editPath)).status, 404);
    assert.equal((await otherClient.post(savePath, valid)).status, 404);
    for (const [id, status] of [['not-an-id', 400], [new mongoose.Types.ObjectId().toString(), 404]]) {
      assert.equal((await ownerClient.get(`/owner/facilities/${id}/edit`)).status, status);
      assert.equal((await ownerClient.post(`/owner/facilities/${id}`, valid)).status, status);
    }
    const unassigned = await clientFor(unassignedOwner);
    assert.equal((await unassigned.get(editPath)).status, 403);
    assert.equal((await unassigned.post(savePath, valid)).status, 403);
    assert.deepEqual(editable(await readFacility()), before);
  });

  await t.test('CSRF thiếu, sai hoặc thuộc phiên khác đều không ghi MongoDB', async () => {
    await ownerClient.get(editPath);
    await otherClient.get(`/owner/facilities/${otherFacility._id}/edit`);
    const before = editable(await readFacility());
    assert.equal((await ownerClient.post(savePath, valid, { csrf: false })).status, 403);
    assert.equal((await ownerClient.post(savePath, { ...valid, _csrf: '0'.repeat(64) })).status, 403);
    assert.equal((await ownerClient.post(savePath, { ...valid, _csrf: otherClient.csrfToken })).status, 403);
    assert.deepEqual(editable(await readFacility()), before);
  });

  await t.test('Cập nhật hợp lệ trim tên/địa chỉ và chuẩn hóa SĐT +84, khoảng trắng, chấm, gạch ngang', async () => {
    for (const [input, normalized] of [
      [' +84 912.345-678 ', '0912345678'],
      ['090-123.4567', '0901234567']
    ]) {
      const response = await ownerClient.post(savePath, {
        name: '  Tên cơ sở sau khi sửa  ', address: '  123 Đường kiểm thử, Thành phố  ', phone: input
      });
      assert.equal(response.status, 303, response.html);
      assert.equal(response.location, '/owner');
      assert.deepEqual(editable(await readFacility()), {
        name: 'Tên cơ sở sau khi sửa', address: '123 Đường kiểm thử, Thành phố', phone: normalized
      });
    }
  });

  await t.test('SĐT mới vẫn cho khách vãng lai xem lịch và giữ ô, không đổi sân, tài khoản hoặc đơn đã có', async () => {
    const court = await Court.create({
      facility: facility._id, name: 'Sân kiểm tra thông tin liên hệ', basePriceVND: 50000, peakPriceVND: 75000
    });
    const date = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    const guest = new TestBrowser(environment.base);
    const hold = async time => {
      const result = await guest.hold({ courtId: String(court._id), date, times: [time], guestName: 'Khách kiểm thử', guestPhone: '0987654321' });
      assert.equal(result.status, 303, result.html);
      return bookingFromLocation(result.location);
    };
    const old = await hold('08:00');
    const bookingBefore = await Booking.findById(old.id).select('+guestTokenHash').lean();
    const courtBefore = await Court.findById(court._id).lean();
    const userBefore = await User.findById(owner._id).lean();
    assert.equal((await ownerClient.post(savePath, { ...valid, phone: '+84 912.345-678' })).status, 303);
    const availability = await guest.get(`/courts/${court._id}?date=${date}`);
    assert.equal(availability.status, 200);
    assert.equal((await readFacility()).phone, '0912345678');
    const nextSlot = availability.html.match(/<input[^>]*name="times"[^>]*value="09:00"[^>]*>/)?.[0];
    assert.ok(nextSlot && !nextSlot.includes('disabled'));
    const next = await hold('09:00');
    assert.equal((await guest.get(next.checkout)).status, 200);
    assert.equal((await Booking.findById(next.id)).status, 'HOLD');
    assert.deepEqual(await Booking.findById(old.id).select('+guestTokenHash').lean(), bookingBefore);
    assert.deepEqual(await Court.findById(court._id).lean(), courtBefore);
    assert.deepEqual(await User.findById(owner._id).lean(), userBefore);
  });

  await t.test('Chỉ nhận name/address/phone; body không thể đổi chủ, ID, quyền hoặc cơ sở khác', async () => {
    const otherBefore = await Facility.findById(otherFacility._id).lean();
    const response = await ownerClient.post(savePath, {
      ...valid, owner: String(otherOwner._id), ownerId: String(otherOwner._id),
      facilityId: String(otherFacility._id), _id: String(otherFacility._id),
      role: 'ADMIN', ownerStatus: 'APPROVED', '$set[owner]': String(otherOwner._id)
    });
    assert.equal(response.status, 303, response.html);
    const saved = await readFacility();
    assert.equal(String(saved._id), String(facility._id));
    assert.equal(String(saved.owner), String(owner._id));
    assert.deepEqual(editable(saved), valid);
    assert.equal(saved.role, undefined);
    assert.equal(saved.ownerStatus, undefined);
    assert.deepEqual(await Facility.findById(otherFacility._id).lean(), otherBefore);
    assert.equal((await User.findById(owner._id)).role, 'OWNER');
    assert.equal(await Facility.countDocuments(), 2);
  });

  await t.test('Tên và địa chỉ ở đúng biên 1/150 và 1/500 ký tự được chấp nhận', async () => {
    for (const fields of [
      { name: 'A', address: 'B', phone: '0901234567' },
      { name: 'N'.repeat(150), address: 'D'.repeat(500), phone: '0901234567' }
    ]) {
      const response = await ownerClient.post(savePath, fields);
      assert.equal(response.status, 303, response.html);
      assert.deepEqual(editable(await readFacility()), fields);
    }
  });

  await t.test('Trống/thiếu, quá dài, sai SĐT hoặc nhiều giá trị cùng input trả 400 và không đổi bản ghi', async () => {
    const before = editable(await readFacility());
    const invalid = [
      { name: '' }, { name: '  ' }, { name: undefined }, { name: 'N'.repeat(151) },
      { address: '' }, { address: '  ' }, { address: undefined }, { address: 'D'.repeat(501) },
      { phone: '' }, { phone: '  ' }, { phone: undefined }, { phone: '1234567890' },
      { phone: '091234567' }, { phone: '09123456789' }, { phone: '+849123456789' },
      { phone: '091234567x' }, { phone: ' '.repeat(31) + '0912345678' },
      { name: ['Tên một', 'Tên hai'] }, { address: ['Địa chỉ một', 'Địa chỉ hai'] },
      { phone: ['0912345678', '0987654321'] }, { name: undefined, 'name[$ne]': '' }
    ];
    for (const change of invalid) {
      const response = await ownerClient.post(savePath, { ...valid, ...change });
      assert.equal(response.status, 400, `Phải từ chối dữ liệu ${JSON.stringify(change)}`);
      assert.match(response.html, /role="alert"/);
      assert.match(response.html, new RegExp(`action="${savePath}"`));
      assert.deepEqual(editable(await readFacility()), before, JSON.stringify(change));
    }
  });

  await t.test('Lỗi giữ cả ba giá trị nhập và escape HTML; tên/địa chỉ nguy hiểm không trở thành mã thực thi', async () => {
    const fields = {
      name: '"><script>alert("name")</script>',
      address: '<img src=x onerror="alert(1)"> & địa chỉ',
      phone: '<svg onload=alert(1)>'
    };
    const before = editable(await readFacility());
    const response = await ownerClient.post(savePath, fields);
    assert.equal(response.status, 400);
    for (const [key, value] of Object.entries(fields)) {
      assert.equal(fieldValue(response.html, key), escape(value), `Phải giữ và escape ${key}`);
      assert.ok(!response.html.includes(value));
    }
    assert.deepEqual(editable(await readFacility()), before);
    const success = await ownerClient.post(savePath, { ...fields, phone: '0912345678' });
    assert.equal(success.status, 303, success.html);
    const reopened = await ownerClient.get(editPath);
    assert.equal(reopened.status, 200);
    assert.ok(reopened.html.includes(escape(fields.name)));
    assert.ok(reopened.html.includes(escape(fields.address)));
    assert.ok(!reopened.html.includes(fields.name));
    assert.ok(!reopened.html.includes(fields.address));
  });

  await t.test('Quyền được đọc lại mỗi request; session cũ không sửa sau khi bị thu hồi vai trò hoặc duyệt', async () => {
    const before = editable(await readFacility());
    try {
      await User.updateOne({ _id: owner._id }, { $set: { ownerStatus: 'REJECTED' } });
      assert.equal((await ownerClient.get(editPath)).status, 403);
      assert.equal((await ownerClient.post(savePath, valid)).status, 403);
      await User.updateOne({ _id: owner._id }, { $set: { ownerStatus: 'APPROVED', role: 'CUSTOMER' } });
      assert.equal((await ownerClient.get(editPath)).status, 403);
      assert.equal((await ownerClient.post(savePath, valid)).status, 403);
      assert.deepEqual(editable(await readFacility()), before);
    } finally {
      await User.updateOne({ _id: owner._id }, { $set: { ownerStatus: 'APPROVED', role: 'OWNER' } });
    }
  });

  await t.test('Chuyển cơ sở sang chủ khác vô hiệu quyền session cũ, không tạo mới khi save; các trang sẵn có vẫn hoạt động', async () => {
    const before = editable(await readFacility());
    const replacement = await User.create({
      fullName: 'Chủ thay thế', email: 'facility-replacement@example.test', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash
    });
    try {
      await Facility.updateOne({ _id: facility._id }, { $set: { owner: replacement._id } });
      assert.equal((await ownerClient.get(editPath)).status, 403);
      assert.equal((await ownerClient.post(savePath, valid)).status, 403);
      assert.deepEqual(editable(await readFacility()), before);
      assert.equal(String((await readFacility()).owner), String(replacement._id));
      assert.equal(await Facility.countDocuments(), 2);
    } finally {
      await Facility.updateOne({ _id: facility._id }, { $set: { owner: owner._id } });
    }
    const guest = new TestBrowser(environment.base);
    for (const path of ['/', '/facilities', '/courts', '/login', '/register']) {
      assert.equal((await guest.get(path)).status, 200, path);
    }
    assert.equal((await ownerClient.get('/owner')).status, 200);
  });
});
