import mongoose from 'mongoose';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import {
  approveRequest, rejectRequest, recordRefund, cancelByOwner
} from '../services/booking.service.js';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function ownerError(res, error) {
  const status = error.code === 11000 ? 409 : error.status;
  if (!Number.isInteger(status) || status < 400 || status >= 500) throw error;
  return res.status(status).render('error', {
    title: 'Không thể xử lý yêu cầu',
    message: error.code === 11000 ? 'Tên sân hoặc thao tác vừa bị trùng. Hãy tải lại trang và thử lại.' : error.message,
    backUrl: '/owner'
  });
}

async function ownFacility(user) {
  const facility = await Facility.findOne({ owner: user._id }).lean();
  if (!facility) fail(403, 'Tài khoản chưa được cấp cơ sở quản lý. Hãy liên hệ nhóm trưởng.');
  return facility;
}

function courtInput(body) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const values = {};
  for (const key of ['name', 'openTime', 'closeTime', 'peakStartTime', 'peakEndTime']) {
    values[key] = typeof source[key] === 'string' ? source[key].trim() : '';
  }
  for (const key of ['basePriceVND', 'peakPriceVND']) {
    values[key] = typeof source[key] === 'string' ? source[key].trim() : '';
  }
  const activeValues = ['on', 'true', '1', 'false', '0'];
  if (source.active !== undefined && (typeof source.active !== 'string' || !activeValues.includes(source.active))) {
    return { values, error: 'Trạng thái sân không hợp lệ.' };
  }
  values.active = ['on', 'true', '1'].includes(source.active);
  if (!values.name || values.name.length > 150) return { values, error: 'Tên sân cần từ 1 đến 150 ký tự.' };
  for (const key of ['openTime', 'closeTime', 'peakStartTime', 'peakEndTime']) {
    if (!/^(?:[01]\d|2[0-3]):[03]0$/.test(values[key])) {
      return { values, error: 'Giờ phải theo ô 30 phút, ví dụ 06:00 hoặc 17:30.' };
    }
  }
  if (values.openTime >= values.closeTime || values.peakStartTime >= values.peakEndTime
    || values.peakStartTime < values.openTime || values.peakEndTime > values.closeTime) {
    return { values, error: 'Giờ đóng phải sau giờ mở; khoảng cao điểm phải nằm trong giờ hoạt động.' };
  }
  for (const key of ['basePriceVND', 'peakPriceVND']) {
    if (!/^\d+$/.test(values[key]) || !Number.isSafeInteger(Number(values[key]))) {
      return { values, error: 'Giá mỗi ô 30 phút phải là số nguyên đồng không âm.' };
    }
    values[key] = Number(values[key]);
  }
  return { values, error: null };
}

export async function showOwnerDashboard(req, res) {
  if (req.currentUser.role !== 'OWNER') {
    return ownerError(res, { status: 403, message: 'Trang này dành cho tài khoản chủ sân.' });
  }
  if (req.currentUser.ownerStatus !== 'APPROVED') {
    return res.render('owner-pending', { title: 'Đề nghị tài khoản chủ sân', application: req.currentUser });
  }
  try {
    const facility = await ownFacility(req.currentUser);
    const [courts, bookings] = await Promise.all([
      Court.find({ facility: facility._id }).sort({ name: 1 }).lean(),
      Booking.find({ facility: facility._id }).populate('court', 'name')
        .populate('user', 'fullName email').populate('facility').sort({ createdAt: -1 }).lean()
    ]);
    const requests = await BookingRequest.find({ booking: { $in: bookings.map(booking => booking._id) } })
      .populate({ path: 'booking', populate: [{ path: 'court', select: 'name' }, { path: 'user', select: 'fullName email' }] })
      .populate('requestedCourt', 'name').sort({ createdAt: -1 }).lean();
    return res.render('owner-dashboard', {
      title: 'Quản lý cơ sở của bạn', facility, courts, bookings, requests, errorMessage: null
    });
  } catch (error) {
    return ownerError(res, error);
  }
}

export async function showNewCourtForm(req, res) {
  try {
    const facility = await ownFacility(req.currentUser);
    return res.render('owner-court-form', {
      title: 'Thêm sân', court: null, facility, errorMessage: null
    });
  } catch (error) {
    return ownerError(res, error);
  }
}

export async function showEditCourtForm(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã sân không hợp lệ.');
    const facility = await ownFacility(req.currentUser);
    const court = await Court.findOne({ _id: req.params.id, facility: facility._id }).lean();
    if (!court) fail(404, 'Không tìm thấy sân thuộc cơ sở của bạn.');
    return res.render('owner-court-form', {
      title: 'Sửa sân và bảng giá', court, facility, errorMessage: null
    });
  } catch (error) {
    return ownerError(res, error);
  }
}

async function saveCourt(req, res, editing) {
  let facility;
  try {
    if (editing && !mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã sân không hợp lệ.');
    facility = await ownFacility(req.currentUser);
    if (editing && !await Court.exists({ _id: req.params.id, facility: facility._id })) {
      fail(404, 'Không tìm thấy sân thuộc cơ sở của bạn.');
    }
    const { values, error } = courtInput(req.body);
    if (error) {
      return res.status(400).render('owner-court-form', {
        title: editing ? 'Sửa sân và bảng giá' : 'Thêm sân',
        court: { ...values, ...(editing ? { _id: req.params.id } : {}) }, facility, errorMessage: error
      });
    }
    if (editing) {
      const saved = await Court.findOneAndUpdate(
        { _id: req.params.id, facility: facility._id }, { $set: values },
        { returnDocument: 'after', runValidators: true }
      );
      if (!saved) fail(404, 'Không tìm thấy sân thuộc cơ sở của bạn.');
    } else {
      await Court.create({ ...values, facility: facility._id });
    }
    return res.redirect(303, '/owner');
  } catch (error) {
    if (error.code === 11000 && facility) {
      const { values } = courtInput(req.body);
      return res.status(409).render('owner-court-form', {
        title: editing ? 'Sửa sân và bảng giá' : 'Thêm sân',
        court: { ...values, ...(editing ? { _id: req.params.id } : {}) }, facility,
        errorMessage: 'Tên sân đã tồn tại trong cơ sở của bạn.'
      });
    }
    return ownerError(res, error);
  }
}

export function createCourt(req, res) {
  return saveCourt(req, res, false);
}

export function updateCourt(req, res) {
  return saveCourt(req, res, true);
}

async function ownerAction(req, res, operation) {
  try {
    await operation(req.params.id, req.currentUser, req.body ?? {});
    return res.redirect(303, '/owner');
  } catch (error) {
    return ownerError(res, error);
  }
}

export function approveBookingRequest(req, res) {
  return ownerAction(req, res, approveRequest);
}

export function rejectBookingRequest(req, res) {
  return ownerAction(req, res, rejectRequest);
}

export function recordBookingRefund(req, res) {
  return ownerAction(req, res, recordRefund);
}

export function cancelGuestBooking(req, res) {
  return ownerAction(req, res, cancelByOwner);
}
