import mongoose from 'mongoose';
import { PAGE_SIZE, pageNumber, pageInfo } from '../utils/pagination.js';
import { vietnamDate } from '../domain/booking-rules.js';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import {
  approveRequest, rejectRequest, recordRefund, cancelByOwner, checkInBooking
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

async function editableFacility(req) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã cơ sở không hợp lệ.');
  const facility = await ownFacility(req.currentUser);
  if (String(facility._id) !== req.params.id.toLowerCase()) {
    fail(404, 'Không tìm thấy cơ sở được cấp cho bạn.');
  }
  return facility;
}

function facilityInput(body) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const values = {};
  for (const key of ['name', 'address', 'phone']) {
    values[key] = typeof source[key] === 'string' ? source[key].trim() : '';
  }
  if (['name', 'address', 'phone'].some(key => typeof source[key] !== 'string')) {
    return { values, error: 'Tên, địa chỉ và số điện thoại cơ sở phải là dữ liệu văn bản.' };
  }
  if (!values.name || values.name.length > 150) {
    return { values, error: 'Tên cơ sở cần từ 1 đến 150 ký tự.' };
  }
  if (!values.address || values.address.length > 500) {
    return { values, error: 'Địa chỉ cơ sở cần từ 1 đến 500 ký tự.' };
  }
  const phone = values.phone.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
  if (source.phone.length > 30 || !/^0\d{9}$/.test(phone)) {
    return { values, error: 'Số điện thoại cơ sở bắt buộc có 10 chữ số Việt Nam, bắt đầu bằng 0 hoặc +84.' };
  }
  return { values, updates: { ...values, phone }, error: null };
}

export async function showEditFacilityForm(req, res) {
  try {
    const facility = await editableFacility(req);
    return res.render('owner-facility-form', {
      title: 'Sửa thông tin cơ sở', facility, errorMessage: null
    });
  } catch (error) {
    return ownerError(res, error);
  }
}

export async function updateFacility(req, res) {
  try {
    const facility = await editableFacility(req);
    const { values, updates, error } = facilityInput(req.body);
    if (error) {
      return res.status(400).render('owner-facility-form', {
        title: 'Sửa thông tin cơ sở', facility: { ...facility, ...values }, errorMessage: error
      });
    }
    const saved = await Facility.findOneAndUpdate(
      { _id: facility._id, owner: req.currentUser._id }, { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );
    if (!saved) fail(404, 'Không tìm thấy cơ sở được cấp cho bạn.');
    return res.redirect(303, '/owner');
  } catch (error) {
    return ownerError(res, error);
  }
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
    const requestedPage = pageNumber(req.query.page);
    const requestedRequestPage = pageNumber(req.query.requestPage);
    const bookingFilter = { facility: facility._id };
    const queryText = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (req.query.q !== undefined && (typeof req.query.q !== 'string' || queryText.length > 100)) fail(400, 'Mã đơn tra cứu không hợp lệ.');
    if (queryText) bookingFilter.publicCode = queryText;
    // Join requests to their booking inside MongoDB; do not load all booking IDs.
    const requestScope = [
      { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'bookingDoc' } },
      { $unwind: '$bookingDoc' },
      { $match: { 'bookingDoc.facility': facility._id } }
    ];
    const [courtList, bookingCount, requestCounts] = await Promise.all([
      Court.find({ facility: facility._id }).sort({ name: 1 }).lean(),
      Booking.countDocuments(bookingFilter),
      BookingRequest.aggregate([...requestScope, { $group: {
        _id: null, total: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
        refunds: { $sum: { $cond: [{ $eq: ['$refundStatus', 'PENDING'] }, 1, 0] } }
      } }])
    ]);
    const summary = requestCounts[0] || { total: 0, pending: 0, refunds: 0 };
    const pagination = pageInfo(requestedPage, bookingCount);
    const requestPagination = pageInfo(requestedRequestPage, summary.total);
    const [bookings, requestRows] = await Promise.all([
      Booking.find(bookingFilter).populate('court', 'name')
        .populate('user', 'fullName email').populate('facility')
        .sort({ createdAt: -1, _id: -1 }).skip(pagination.skip).limit(PAGE_SIZE).lean(),
      BookingRequest.aggregate([...requestScope, { $sort: { createdAt: -1, _id: -1 } },
        { $skip: requestPagination.skip }, { $limit: PAGE_SIZE }, { $unset: 'bookingDoc' }])
    ]);
    const requests = await BookingRequest.populate(requestRows, [
      { path: 'booking', populate: [{ path: 'court', select: 'name' }, { path: 'user', select: 'fullName email' }] },
      { path: 'requestedCourt', select: 'name' }
    ]);
    const courts = courtList;
    return res.render('owner-dashboard', {
      title: 'Quản lý cơ sở của bạn', facility, courts, bookings, requests,
      today: vietnamDate(), serverNow: Date.now(), errorMessage: null,
      pagination, requestPagination, summary, queryText
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
  let existingCourt;
  try {
    if (editing && !mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã sân không hợp lệ.');
    facility = await ownFacility(req.currentUser);
    if (editing) existingCourt = await Court.findOne({ _id: req.params.id, facility: facility._id }).lean();
    if (editing && !existingCourt) {
      fail(404, 'Không tìm thấy sân thuộc cơ sở của bạn.');
    }
    const { values, error } = courtInput(req.body);
    if (error) {
      return res.status(400).render('owner-court-form', {
        title: editing ? 'Sửa sân và bảng giá' : 'Thêm sân',
        court: { ...existingCourt, ...values, ...(editing ? { _id: req.params.id } : {}) }, facility, errorMessage: error
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
        court: { ...existingCourt, ...values, ...(editing ? { _id: req.params.id } : {}) }, facility,
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

export function recordBookingCheckIn(req, res) {
  return ownerAction(req, res, (id, owner) => checkInBooking(id, owner));
}
