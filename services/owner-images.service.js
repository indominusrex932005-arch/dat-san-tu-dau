import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import User from '../models/User.js';
import { MAX_IMAGES } from '../models/image-fields.js';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const idPattern = /^[a-f0-9-]{36}$/;

export async function ownedImageTarget(kind, id, user) {
  if (!user || !await User.exists({ _id: user._id, role: 'OWNER', ownerStatus: 'APPROVED' })) fail(403, 'Chủ sân chưa được duyệt hoặc quyền quản lý đã thay đổi.');
  if (!['facilities', 'courts'].includes(kind) || !mongoose.isObjectIdOrHexString(id)) fail(404, 'Không tìm thấy nơi quản lý ảnh.');
  const facility = await Facility.findOne({ owner: user._id }).select('+imageVersion +pendingImageDeletes').lean();
  if (!facility) fail(403, 'Bạn chưa được cấp cơ sở quản lý.');
  const Model = kind === 'facilities' ? Facility : Court;
  const scope = kind === 'facilities' ? { _id: id, owner: user._id } : { _id: id, facility: facility._id };
  const document = await Model.findOne(scope).select('+imageVersion +pendingImageDeletes').lean();
  if (!document) fail(404, 'Không tìm thấy sân hoặc cơ sở thuộc quyền quản lý của bạn.');
  return { Model, scope, document, facility };
}

function versionScope(target) {
  const version = target.document.imageVersion || 0;
  return { ...target.scope, ...(version ? { imageVersion: version } : { $or: [{ imageVersion: 0 }, { imageVersion: { $exists: false } }] }) };
}

async function updateImages(target, update) {
  const document = await target.Model.findOneAndUpdate(versionScope(target), {
    ...update, $inc: { imageVersion: 1 }
  }, { returnDocument: 'after', runValidators: true }).lean();
  if (!document) fail(409, 'Ảnh vừa thay đổi. Hãy tải lại trang rồi thử lại.');
  return document;
}

export async function uploadOwnerImage(kind, id, user, file, storage) {
  let target = await ownedImageTarget(kind, id, user);
  if ((target.document.images || []).length >= MAX_IMAGES) fail(409, 'Mỗi sân hoặc cơ sở có tối đa 5 ảnh.');
  if ((target.document.pendingImageDeletes || []).length >= 20) fail(503, 'Chưa thể tải thêm ảnh. Vui lòng thử lại sau.');
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) fail(415, 'Chỉ nhận ảnh JPG, PNG hoặc WebP.');
  let processed;
  try {
    const pipeline = sharp(file.buffer, { limitInputPixels: 40000000, animated: false });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('Unsupported image');
    processed = await pipeline.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  } catch {
    fail(415, 'Ảnh không đọc được hoặc quá lớn. Hãy dùng JPG, PNG hoặc WebP dưới 40 megapixel.');
  }
  const imageId = randomUUID();
  const publicId = `dat-san/${target.facility._id}/${kind}/${id}/${imageId}`;
  let url;
  try { url = await storage.upload(processed.data, publicId); }
  catch { fail(502, 'Chưa tải được ảnh lên kho lưu trữ. Vui lòng thử lại.'); }
  try {
    // Re-read ownership after the external upload, not only before receiving the file.
    target = await ownedImageTarget(kind, id, user);
    if ((target.document.images || []).length >= MAX_IMAGES) fail(409, 'Mỗi sân hoặc cơ sở có tối đa 5 ảnh.');
    const image = { id: imageId, publicId, url, width: processed.info.width, height: processed.info.height };
    return await updateImages(target, {
      $push: { images: image },
      ...(!(target.document.images || []).length ? { $set: { coverImageId: imageId } } : {})
    });
  } catch (error) {
    try { await storage.destroy(publicId); }
    catch { console.error('Không thể dọn ảnh tải lên chưa được lưu:', publicId); }
    throw error;
  }
}

export async function changeOwnerImage(kind, id, user, imageId, action, storage) {
  if (!idPattern.test(imageId)) fail(404, 'Không tìm thấy ảnh.');
  const target = await ownedImageTarget(kind, id, user);
  const image = (target.document.images || []).find(item => item.id === imageId);
  if (!image) fail(404, 'Không tìm thấy ảnh của sân hoặc cơ sở này.');
  if (action === 'cover') return updateImages(target, { $set: { coverImageId: imageId } });
  const remaining = target.document.images.filter(item => item.id !== imageId);
  const document = await updateImages(target, {
    $pull: { images: { id: imageId } },
    $push: { pendingImageDeletes: image.publicId },
    ...(target.document.coverImageId === imageId ? { $set: { coverImageId: remaining[0]?.id || '' } } : {})
  });
  await cleanTargetImages(target.Model, id, [image.publicId], storage);
  return document;
}

export async function cleanTargetImages(Model, id, publicIds, storage) {
  if (!storage.ready()) return;
  for (const publicId of publicIds) {
    try {
      await storage.destroy(publicId);
      await Model.updateOne({ _id: id }, { $pull: { pendingImageDeletes: publicId } });
    } catch {
      // Retain the ID on the document so images:cleanup can retry after an outage.
      console.error('Chưa dọn được ảnh khỏi kho lưu trữ; đã giữ lịch thử lại.');
    }
  }
}
