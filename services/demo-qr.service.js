import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import Facility from '../models/Facility.js';
import { ownedImageTarget, cleanTargetImages } from './owner-images.service.js';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export async function uploadDemoQr(id, user, file, storage) {
  let target = await ownedImageTarget('facilities', id, user);
  if ((target.document.pendingImageDeletes || []).length >= 20) fail(503, 'Không thể tải ảnh lúc này.');
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) fail(415, 'Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  let result;
  try {
    const pipeline = sharp(file.buffer, { limitInputPixels: 40000000, animated: false });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Invalid image');
    result = await pipeline.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  } catch { fail(415, 'Ảnh không hợp lệ hoặc quá lớn.'); }
  const imageId = randomUUID();
  const publicId = `dat-san/${id}/demo-qr/${imageId}`;
  let url;
  try { url = await storage.upload(result.data, publicId); }
  catch { fail(502, 'Chưa tải được ảnh lên kho lưu trữ.'); }
  try {
    target = await ownedImageTarget('facilities', id, user);
    const version = target.document.imageVersion || 0;
    const filter = { ...target.scope, ...(version ? { imageVersion: version } : { $or: [{ imageVersion: 0 }, { imageVersion: { $exists: false } }] }) };
    const oldId = target.document.demoQr?.publicId;
    const update = { $set: { demoQr: { id: imageId, publicId, url, width: result.info.width, height: result.info.height } }, $inc: { imageVersion: 1 } };
    if (oldId) update.$push = { pendingImageDeletes: oldId };
    const saved = await Facility.findOneAndUpdate(filter, update, { returnDocument: 'after', runValidators: true }).lean();
    if (!saved) fail(409, 'Ảnh vừa thay đổi. Hãy thử lại.');
    if (oldId) await cleanTargetImages(Facility, id, [oldId], storage);
    return saved;
  } catch (error) {
    try { await storage.destroy(publicId); } catch { console.error('Chưa dọn được ảnh QR tải lên.'); }
    throw error;
  }
}

export async function deleteDemoQr(id, user, storage) {
  const target = await ownedImageTarget('facilities', id, user);
  const oldId = target.document.demoQr?.publicId;
  if (!oldId) return;
  const version = target.document.imageVersion || 0;
  const filter = { ...target.scope, 'demoQr.publicId': oldId, ...(version ? { imageVersion: version } : { $or: [{ imageVersion: 0 }, { imageVersion: { $exists: false } }] }) };
  const saved = await Facility.findOneAndUpdate(filter, { $unset: { demoQr: 1 }, $push: { pendingImageDeletes: oldId }, $inc: { imageVersion: 1 } });
  if (!saved) fail(409, 'Ảnh vừa thay đổi. Hãy thử lại.');
  await cleanTargetImages(Facility, id, [oldId], storage);
}
