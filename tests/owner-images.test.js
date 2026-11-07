import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { createTestEnvironment, User, Facility, Court, Booking, SlotLock } from './helpers/database.js';
import { TestBrowser } from './helpers/http.js';
import { cleanTargetImages } from '../services/owner-images.service.js';
import { seedDemoFacilities } from '../services/demo-seed.service.js';

const password = 'ImagesLocalFixture2026!';
const png = await sharp({ create: { width: 2000, height: 1300, channels: 3, background: '#27634e' } }).png().toBuffer();

function storageFixture() {
  return {
    ready: () => true, uploads: [], deleted: [], failDelete: false, afterUpload: null,
    async upload(buffer, publicId) {
      const info = await sharp(buffer).metadata();
      assert.equal(info.format, 'webp');
      assert.ok(info.width <= 1600 && info.height <= 1200);
      this.uploads.push(publicId);
      if (this.afterUpload) await this.afterUpload();
      return `https://res.cloudinary.com/local-test/image/upload/${publicId}.webp`;
    },
    async destroy(publicId) {
      if (this.failDelete) throw new Error('storage temporarily offline');
      this.deleted.push(publicId);
    }
  };
}

async function fixtures(env) {
  const passwordHash = await bcrypt.hash(password, 4);
  const [owner, other, customer] = await User.create([
    { fullName: 'Chủ A', email: 'image-owner@local.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Chủ B', email: 'image-other@local.test', passwordHash, role: 'OWNER', ownerStatus: 'APPROVED' },
    { fullName: 'Khách', email: 'image-customer@local.test', passwordHash }
  ]);
  const facility = await Facility.create({ name: 'Cơ sở thật đã đổi tên', address: 'Địa chỉ thử', phone: '0900000001', owner: owner._id });
  await Facility.create({ name: 'Cơ sở B', address: 'Địa chỉ B', owner: other._id });
  const court = await Court.create({ facility: facility._id, name: 'Sân A', basePriceVND: 50000, peakPriceVND: 75000 });
  const client = new TestBrowser(env.base);
  await client.login(owner.email, password);
  return { owner, other, customer, facility, court, client };
}

async function upload(client, kind, id, data = png, type = 'image/png', extra = false, csrf = true) {
  const form = new FormData();
  form.append('image', new Blob([data], { type }), '../../not-a-server-path.png');
  if (extra) form.append('owner', 'cannot-change-owner');
  return client.request(`/owner/${kind}/${id}/images`, {
    method: 'POST', headers: csrf ? { 'X-CSRF-Token': client.csrfToken } : {}, body: form
  });
}

test('Ảnh qua HTTP: quyền/CSRF, file thật, ảnh đại diện, tranh chấp và dọn lại sau lỗi kho ảnh', { timeout: 30000 }, async t => {
  const previous = Object.fromEntries(['RATE_LIMIT_IMAGES_IP_MAX', 'RATE_LIMIT_IMAGES_ACTOR_MAX'].map(key => [key, process.env[key]]));
  process.env.RATE_LIMIT_IMAGES_IP_MAX = '100';
  process.env.RATE_LIMIT_IMAGES_ACTOR_MAX = '100';
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const storage = storageFixture();
  const env = await createTestEnvironment({ imageStorage: storage });
  t.after(() => env.close());
  const { owner, other, customer, facility, court, client } = await fixtures(env);
  await client.get(`/owner/facilities/${facility._id}/edit`);

  await t.test('Sai quyền, thiếu CSRF, file giả/quá lớn không đẩy lên storage', async () => {
    assert.equal((await upload(client, 'facilities', facility._id, png, 'image/png', false, false)).status, 403);
    for (const account of [other, customer]) {
      const stranger = new TestBrowser(env.base);
      await stranger.login(account.email, password);
      assert.equal((await upload(stranger, 'facilities', facility._id)).status, account === other ? 404 : 403);
    }
    assert.equal((await upload(client, 'courts', 'not-an-id')).status, 404);
    assert.equal((await upload(client, 'courts', court._id, Buffer.from('<svg/>'), 'image/svg+xml')).status, 415);
    assert.equal((await upload(client, 'courts', court._id, Buffer.from('fake-png'))).status, 415);
    assert.equal((await upload(client, 'courts', court._id, Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await upload(client, 'courts', court._id, png, 'image/png', true)).status, 400);
    assert.equal(storage.uploads.length, 0);
  });

  await t.test('Hai ảnh cơ sở, đổi ảnh bìa: trang chủ/danh sách chỉ dùng một ảnh được chọn', async () => {
    assert.equal((await upload(client, 'facilities', facility._id)).status, 201);
    assert.equal((await upload(client, 'facilities', facility._id)).status, 201);
    let doc = await Facility.findById(facility._id).lean();
    assert.equal(doc.images.length, 2);
    assert.equal(doc.coverImageId, doc.images[0].id);
    assert.equal((await client.post(`/owner/facilities/${facility._id}/images/${doc.images[1].id}/cover`)).status, 303);
    doc = await Facility.findById(facility._id).lean();
    for (const path of ['/', '/facilities']) {
      const page = await client.get(path);
      assert.equal(page.status, 200);
      assert.ok(page.html.includes(doc.images[1].url));
      assert.ok(!page.html.includes(doc.images[0].url));
    }
    assert.equal((await client.post(`/owner/courts/${court._id}/images/${doc.images[0].id}/cover`)).status, 404);
    assert.equal(await Booking.countDocuments(), 0);
    assert.equal(await SlotLock.countDocuments(), 0);
  });

  await t.test('Giữ ảnh khi form giá lỗi; hai upload tranh ô thứ năm không vượt giới hạn', async () => {
    for (let i = 0; i < 4; i++) assert.equal((await upload(client, 'courts', court._id)).status, 201);
    const pair = await Promise.all([upload(client, 'courts', court._id), upload(client, 'courts', court._id)]);
    assert.deepEqual(pair.map(item => item.status).sort(), [201, 409]);
    const doc = await Court.findById(court._id).lean();
    assert.equal(doc.images.length, 5);
    assert.ok(storage.deleted.length >= 1);
    const invalidForm = await client.post(`/owner/courts/${court._id}`, { name: 'Sân A', basePriceVND: '-1' });
    assert.equal(invalidForm.status, 400);
    assert.ok(invalidForm.html.includes(doc.images[0].url));
    assert.ok((await client.get(`/courts/${court._id}`)).html.includes(doc.images[0].url));
  });

  await t.test('Xóa ảnh bìa chọn ảnh tiếp theo; lỗi storage giữ hàng đợi có thể thử lại', async () => {
    const before = await Facility.findById(facility._id).lean();
    const photo = before.images.find(item => item.id === before.coverImageId);
    storage.failDelete = true;
    assert.equal((await client.post(`/owner/facilities/${facility._id}/images/${photo.id}/delete`)).status, 303);
    let doc = await Facility.findById(facility._id).select('+pendingImageDeletes').lean();
    assert.equal(doc.images.length, 1);
    assert.equal(doc.coverImageId, doc.images[0].id);
    assert.deepEqual(doc.pendingImageDeletes, [photo.publicId]);
    storage.failDelete = false;
    await cleanTargetImages(Facility, doc._id, doc.pendingImageDeletes, storage);
    doc = await Facility.findById(doc._id).select('+pendingImageDeletes').lean();
    assert.deepEqual(doc.pendingImageDeletes, []);
  });

  await t.test('Ba upload đồng thời chỉ nhận hai file; kết thúc xong slot được dùng lại', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    storage.afterUpload = () => gate;
    const before = storage.uploads.length;
    const first = upload(client, 'facilities', facility._id);
    const second = upload(client, 'facilities', facility._id);
    try {
      for (let i = 0; storage.uploads.length < before + 2 && i < 200; i++) await delay(10);
      assert.equal(storage.uploads.length, before + 2);
      const third = await upload(client, 'facilities', facility._id);
      assert.equal(third.status, 429);
      assert.equal(third.headers.get('retry-after'), '5');
      assert.equal(storage.uploads.length, before + 2);
    } finally { release(); }
    const finished = await Promise.all([first, second]);
    assert.ok(finished.every(result => [201, 409].includes(result.status)));
    storage.afterUpload = null;
    assert.equal((await upload(client, 'facilities', facility._id)).status, 201);
  });

  await t.test('Thu hồi quyền trong khi tải ảnh không được lưu ảnh sau upload', async () => {
    storage.afterUpload = () => User.updateOne({ _id: owner._id }, { $set: { ownerStatus: 'PENDING' } });
    const before = await Facility.findById(facility._id).lean();
    const result = await upload(client, 'facilities', facility._id);
    assert.equal(result.status, 403);
    assert.deepEqual((await Facility.findById(facility._id).lean()).images, before.images);
    assert.ok(storage.deleted.includes(storage.uploads.at(-1)));
  });
});

test('Chưa cấu hình kho ảnh: cơ sở cũ vẫn hiện minh họa, upload bị chặn trước storage', async t => {
  const storage = storageFixture();
  storage.ready = () => false;
  const env = await createTestEnvironment({ imageStorage: storage });
  t.after(() => env.close());
  const { facility, client } = await fixtures(env);
  assert.equal((await client.get('/')).status, 200);
  assert.match((await client.get('/')).html, /Ảnh minh họa/);
  const form = await client.get(`/owner/facilities/${facility._id}/edit`);
  assert.match(form.html, /Tải ảnh chưa được mở/);
  assert.equal((await upload(client, 'facilities', facility._id)).status, 503);
  assert.equal(storage.uploads.length, 0);
});

test('Seed thêm ba cơ sở, chạy lại sau đổi tên/ảnh/giá không thêm trùng hay đổi dữ liệu cũ', async t => {
  const env = await createTestEnvironment();
  t.after(() => env.close());
  const facility = await Facility.create({ name: 'Cơ sở đã đổi tên', address: 'Địa chỉ riêng', phone: '0900000001' });
  await Court.create({ facility: facility._id, name: 'Sân đã đổi tên', basePriceVND: 12345, peakPriceVND: 23456 });
  const before = await Facility.findById(facility._id).lean();
  const result = await seedDemoFacilities();
  assert.equal(result.filter(item => item.created).length, 3);
  assert.equal(await Facility.countDocuments(), 4);
  assert.equal(await Court.countDocuments(), 7);
  assert.deepEqual(await Facility.findById(facility._id).lean(), before);
  const sample = await Facility.findOne({ name: 'Cơ sở mẫu Sơn Trà' });
  sample.name = 'Tên chủ sân tự đặt';
  sample.images = [{ id: randomUUID(), url: 'https://res.cloudinary.com/local-test/image/upload/sample.webp', publicId: 'sample', width: 100, height: 100 }];
  await sample.save();
  const snapshot = JSON.stringify(await Facility.find().sort({ _id: 1 }).lean());
  const courts = JSON.stringify(await Court.find().sort({ _id: 1 }).lean());
  assert.equal((await seedDemoFacilities()).filter(item => item.created).length, 0);
  assert.equal(JSON.stringify(await Facility.find().sort({ _id: 1 }).lean()), snapshot);
  assert.equal(JSON.stringify(await Court.find().sort({ _id: 1 }).lean()), courts);
});
