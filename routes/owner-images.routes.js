import express from 'express';
import multer from 'multer';
import { uploadDemoQr, deleteDemoQr } from '../services/demo-qr.service.js';
import { requireAuth, requireOwner } from '../middlewares/auth.middleware.js';
import { ownedImageTarget, uploadOwnerImage, changeOwnerImage } from '../services/owner-images.service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });

export default function createOwnerImageRoutes(storage, limiter) {
  const router = express.Router();
  let activeUploads = 0;
  const reserveUploadSlot = (req, res, next) => {
    if (activeUploads >= 2) return res.set('Retry-After', '5').status(429).json({ message: 'Đang xử lý nhiều ảnh. Vui lòng thử lại sau vài giây.' });
    activeUploads++;
    let released = false;
    const release = () => { if (!released) { released = true; activeUploads--; } };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
  router.use(requireAuth, requireOwner);
  const authorize = async (req, res, next) => {
    try {
      await ownedImageTarget(req.params.kind, req.params.id, req.currentUser);
      next();
    } catch (error) { next(error); }
  };
  const provider = (req, res, next) => {
    if (!storage.ready()) return res.status(503).json({ message: 'Tải ảnh chưa được mở. Vui lòng nhờ quản trị viên cấu hình kho ảnh.' });
    next();
  };
  router.post('/facilities/:id/demo-qr', async (req, res, next) => {
    try { await ownedImageTarget('facilities', req.params.id, req.currentUser); next(); } catch (error) { next(error); }
  }, provider, reserveUploadSlot, limiter, (req, res, next) => {
    upload.single('image')(req, res, error => {
      if (!error) return next();
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message: 'Mỗi lần chỉ tải một ảnh tối đa 5 MB.' });
    });
  }, async (req, res, next) => {
    try { await uploadDemoQr(req.params.id, req.currentUser, req.file, storage); res.status(201).json({ message: 'Đã lưu ảnh QR minh họa.' }); }
    catch (error) { if ([409, 415, 502, 503].includes(error.status)) return res.status(error.status).json({ message: error.message }); next(error); }
  });
  router.post('/facilities/:id/demo-qr/delete', async (req, res, next) => {
    try { await deleteDemoQr(req.params.id, req.currentUser, storage); res.redirect(303, `/owner/facilities/${req.params.id}/edit`); }
    catch (error) { next(error); }
  });
  router.post('/:kind/:id/images', authorize, provider, reserveUploadSlot, limiter, (req, res, next) => {
    upload.single('image')(req, res, error => {
      if (!error) return next();
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ message: tooLarge ? 'Ảnh vượt quá 5 MB.' : 'Mỗi lần chỉ tải một ảnh, không kèm trường dữ liệu khác.' });
    });
  }, async (req, res, next) => {
    try {
      await uploadOwnerImage(req.params.kind, req.params.id, req.currentUser, req.file, storage);
      res.status(201).json({ message: 'Đã thêm ảnh. Bạn có thể chọn ảnh này làm ảnh đại diện.' });
    } catch (error) {
      if ([409, 415, 502, 503].includes(error.status)) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  });
  router.post('/:kind/:id/images/:imageId/:action', authorize, async (req, res, next) => {
    try {
      if (!['cover', 'delete'].includes(req.params.action)) return res.sendStatus(404);
      await changeOwnerImage(req.params.kind, req.params.id, req.currentUser, req.params.imageId, req.params.action, storage);
      const path = req.params.kind === 'facilities' ? `/owner/facilities/${req.params.id}/edit` : `/owner/courts/${req.params.id}/edit`;
      res.redirect(303, path);
    } catch (error) { next(error); }
  });
  return router;
}
