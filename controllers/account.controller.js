import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import { getVietnamDate } from '../utils/booking-time.js';

function roleLabelFor(user) {
  if (user?.role === 'ADMIN') return 'Quản trị viên';
  if (user?.role === 'OWNER') return user.ownerStatus === 'APPROVED' ? 'Chủ sân' : 'Chủ sân (chờ duyệt)';
  return 'Khách hàng';
}

async function renderAccount(res, user, overrides = {}) {
  const bookingCount = await Booking.countDocuments({ user: user._id });
  const joinedDate = user.createdAt ? getVietnamDate(new Date(user.createdAt)) : '';
  return res.status(overrides.status || 200).render('account', {
    title: 'Thông tin tài khoản',
    navigationPath: '/account',
    accountUser: user,
    roleLabel: roleLabelFor(user),
    bookingCount,
    joinedDate,
    profileValues: overrides.profileValues || {
      fullName: user.fullName || '',
      phone: user.phone || ''
    },
    profileMessage: overrides.profileMessage || null,
    profileError: overrides.profileError || null,
    passwordMessage: overrides.passwordMessage || null,
    passwordError: overrides.passwordError || null
  });
}

export async function showAccount(req, res) {
  const saved = typeof req.query?.saved === 'string' ? req.query.saved : '';
  return renderAccount(res, req.currentUser, {
    profileMessage: saved === 'profile' ? 'Đã cập nhật thông tin tài khoản.' : null,
    passwordMessage: saved === 'password' ? 'Đã đổi mật khẩu thành công.' : null
  });
}

export async function updateProfile(req, res) {
  const body = req.body ?? {};
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const profileValues = { fullName, phone: rawPhone };

  if (!fullName || fullName.length > 100) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      profileValues,
      profileError: 'Họ tên phải có từ 1 đến 100 ký tự.'
    });
  }
  if (body.phone !== undefined && typeof body.phone !== 'string') {
    return renderAccount(res, req.currentUser, {
      status: 400,
      profileValues,
      profileError: 'Số điện thoại không hợp lệ.'
    });
  }
  const phone = rawPhone.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
  if ((req.currentUser.role === 'OWNER' || phone) && !/^0\d{9}$/.test(phone)) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      profileValues,
      profileError: 'Số điện thoại cần có 10 chữ số Việt Nam, bắt đầu bằng 0 hoặc +84.'
    });
  }

  const update = phone
    ? { $set: { fullName, phone } }
    : { $set: { fullName }, $unset: { phone: 1 } };
  await User.findByIdAndUpdate(req.currentUser._id, update, { runValidators: true });
  return res.redirect(303, '/account?saved=profile');
}

export async function updatePassword(req, res) {
  const body = req.body ?? {};
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      passwordError: 'Vui lòng nhập mật khẩu hiện tại.'
    });
  }
  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      passwordError: 'Mật khẩu mới cần ít nhất 8 ký tự và không quá 72 byte.'
    });
  }
  if (confirmPassword !== newPassword) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      passwordError: 'Mật khẩu nhập lại chưa khớp.'
    });
  }
  if (newPassword === currentPassword) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      passwordError: 'Mật khẩu mới cần khác mật khẩu hiện tại.'
    });
  }

  const user = await User.findById(req.currentUser._id).select('+passwordHash');
  if (!user) return res.redirect(303, '/login');
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return renderAccount(res, req.currentUser, {
      status: 400,
      passwordError: 'Mật khẩu hiện tại chưa chính xác.'
    });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  const userId = String(user._id);
  return req.session.regenerate(err => {
    if (err) return res.redirect(303, '/account?saved=password');
    req.session.userId = userId;
    return req.session.save(() => res.redirect(303, '/account?saved=password'));
  });
}
