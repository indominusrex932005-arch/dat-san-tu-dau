import mongoose from 'mongoose';
import User from '../models/User.js';

export async function attachCurrentUser(req, res, next) {
  let user = null;
  const userId = req.session.userId;

  if (typeof userId === 'string' && mongoose.isObjectIdOrHexString(userId)) {
    user = await User.findById(userId)
      .select('fullName email role ownerStatus phone requestedFacilityName requestedFacilityAddress').lean();
  }

  if (!user && userId) delete req.session.userId;
  if (user && !['CUSTOMER', 'OWNER', 'ADMIN'].includes(user.role)) user.role = 'CUSTOMER';
  req.currentUser = user;
  res.locals.currentUser = user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.currentUser) return res.redirect(303, '/login');
  next();
}

function forbidden(res, message) {
  return res.status(403).render('error', {
    title: 'Không có quyền truy cập', message, backUrl: '/courts'
  });
}

export function requireOwner(req, res, next) {
  if (!req.currentUser) return res.redirect(303, '/login');
  if (req.currentUser.role !== 'OWNER') {
    return forbidden(res, 'Trang này dành cho chủ sân đã được duyệt.');
  }
  if (req.currentUser.ownerStatus !== 'APPROVED') {
    return forbidden(res, 'Tài khoản chủ sân chưa được duyệt hoặc chưa được cấp cơ sở quản lý.');
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.currentUser) return res.redirect(303, '/login');
  if (req.currentUser.role !== 'ADMIN') {
    return forbidden(res, 'Chỉ nhóm trưởng có quyền duyệt tài khoản chủ sân.');
  }
  next();
}
