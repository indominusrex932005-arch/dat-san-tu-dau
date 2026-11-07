import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { createTestEnvironment, User, Facility, Court } from './helpers/database.js';
import { TestBrowser, bookingFromLocation } from './helpers/http.js';

const password = 'QRExample2026!';
const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#dddddd' } }).png().toBuffer();
test('Ảnh QR minh họa theo cơ sở: upload, thay, xóa, quyền, CSRF và checkout demo', async t => {
  const storage = { uploads: [], deleted: [], ready: () => true,
    async upload(buffer, publicId) { assert.equal((await sharp(buffer).metadata()).format, 'webp'); this.uploads.push(publicId); return `https://res.cloudinary.com/example/image/upload/${publicId}.webp`; },
    async destroy(id) { this.deleted.push(id); } };
  const env = await createTestEnvironment({ imageStorage: storage });
  t.after(() => env.close());
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, other] = await User.create([
    { fullName: 'Chủ thử', email: 'qr-owner@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Chủ khác', email: 'qr-other@example.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' }
  ]);
  const facility = await Facility.create({ name: 'Cơ sở QR', address: 'Thử', phone: '0900000000', owner: owner._id });
  await Facility.create({ name: 'Cơ sở khác', address: 'Thử', phone: '0900000001', owner: other._id });
  const court = await Court.create({ facility: facility._id, name: 'Sân thử', basePriceVND: 10000, peakPriceVND: 20000 });
  const ownerBrowser = new TestBrowser(env.base); await ownerBrowser.login(owner.email, password);
  const otherBrowser = new TestBrowser(env.base); await otherBrowser.login(other.email, password);
  const path = `/owner/facilities/${facility.id}/demo-qr`;
  const upload = async (browser, bytes = png, csrf = true) => {
    const data = new FormData(); data.append('image', new Blob([bytes], { type: 'image/png' }), 'mock.png');
    return browser.request(path, { method: 'POST', headers: csrf ? { 'X-CSRF-Token': browser.csrfToken } : {}, body: data });
  };
  assert.equal((await upload(ownerBrowser, png, false)).status, 403);
  assert.equal((await upload(otherBrowser)).status, 404);
  assert.equal((await upload(ownerBrowser, Buffer.from('not-an-image'))).status, 415);
  assert.equal((await upload(ownerBrowser)).status, 201);
  let doc = await Facility.findById(facility.id).lean();
  assert.equal(doc.images.length, 0);
  assert.ok(doc.demoQr.url.includes('/demo-qr/'));
  const old = doc.demoQr.publicId;
  const guest = new TestBrowser(env.base);
  const date = new Date(Date.now() + 3 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
  const hold = await guest.hold({ courtId: court.id, date, times: ['08:00'], guestName: 'Khách thử', guestPhone: '0900000002' });
  assert.equal(hold.status, 303);
  const checkout = await guest.get(bookingFromLocation(hold.location).checkout);
  assert.ok(checkout.html.includes(doc.demoQr.url));
  assert.match(checkout.html, /không quét hoặc chuyển tiền/i);
  assert.match(checkout.html, /Mô phỏng thanh toán toàn bộ/);
  assert.equal((await upload(ownerBrowser)).status, 201);
  doc = await Facility.findById(facility.id).lean();
  assert.notEqual(doc.demoQr.publicId, old);
  assert.ok(storage.deleted.includes(old));
  assert.equal((await otherBrowser.post(path + '/delete')).status, 404);
  assert.equal((await ownerBrowser.post(path + '/delete')).status, 303);
  assert.equal((await Facility.findById(facility.id).lean()).demoQr, undefined);
  const fallback = await guest.get(bookingFromLocation(hold.location).checkout);
  assert.ok(fallback.html.includes('/assets/images/qr-minh-hoa.svg'));
});
