import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createTestEnvironment, User, Facility } from './helpers/database.js';
import { TestBrowser } from './helpers/http.js';

test('Vercel báo hạn mức 3 MB cho ảnh/QR và chặn file lớn trước kho ảnh', { timeout: 60000 }, async t => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  let uploads = 0;
  const storage = { ready: () => true, upload: async () => { uploads++; throw new Error('Không được gọi'); } };
  const env = await createTestEnvironment({ imageStorage: storage });
  t.after(async () => {
    await env.close();
    if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  });
  const password = 'SyntheticImageFixture2026!';
  const owner = await User.create({ fullName: 'Chủ sân thử', email: 'vercel-image@example.test', phone: '0912345678', role: 'OWNER', ownerStatus: 'APPROVED', passwordHash: await bcrypt.hash(password, 4) });
  const facility = await Facility.create({ name: 'Cơ sở thử ảnh', address: 'Địa chỉ dữ liệu thử', phone: '0912345678', owner: owner._id });
  const client = new TestBrowser(env.base);
  await client.login(owner.email, password);
  const page = await client.get(`/owner/facilities/${facility._id}/edit`);
  assert.equal(page.status, 200);
  assert.match(page.html, /data-max-mb="3"/);
  assert.doesNotMatch(page.html, /tối đa 5 MB/);
  for (const path of [`/owner/facilities/${facility._id}/images`, `/owner/facilities/${facility._id}/demo-qr`]) {
    const body = new FormData();
    body.append('image', new Blob([Buffer.alloc(3 * 1024 * 1024 + 1)], { type: 'image/png' }), 'too-large.png');
    const result = await client.request(path, { method: 'POST', headers: { 'X-CSRF-Token': client.csrfToken }, body });
    assert.equal(result.status, 413);
    assert.match(JSON.parse(result.html).message, /3 MB/);
  }
  assert.equal(uploads, 0);
});
