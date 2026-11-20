import mongoose from 'mongoose';
import User from '../models/User.js';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function showError(res, error) {
  const status = error.code === 11000 ? 409 : error.status;
  if (!Number.isInteger(status) || status < 400 || status >= 500) throw error;
  return res.status(status).render('error', {
    title: 'Không thể xử lý yêu cầu quản trị',
    message: error.code === 11000 ? 'Cơ sở hoặc tài khoản đã được cấp quyền. Hãy tải lại danh sách.' : error.message,
    backUrl: '/admin'
  });
}

export async function showAdminDashboard(req, res) {
  const validTabs = new Set(['owners', 'facilities', 'users', 'bookings', 'requests']);
  const activeTab = validTabs.has(req.query.tab) ? req.query.tab : (req.adminDefaultTab || 'owners');
  const userQ = typeof req.query.userQ === 'string' ? req.query.userQ.trim().slice(0, 80) : '';
  const userRole = ['CUSTOMER', 'OWNER', 'ADMIN'].includes(req.query.userRole) ? req.query.userRole : '';
  const bookingStatus = ['HOLD', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'LEGACY_RESERVED'].includes(req.query.bookingStatus)
    ? req.query.bookingStatus : '';
  const bookingFacility = typeof req.query.bookingFacility === 'string' && mongoose.isObjectIdOrHexString(req.query.bookingFacility)
    ? req.query.bookingFacility : '';
  const bookingQ = typeof req.query.bookingQ === 'string' ? req.query.bookingQ.trim().slice(0, 80) : '';
  const requestStatus = ['PENDING', 'APPROVED', 'REJECTED'].includes(req.query.requestStatus) ? req.query.requestStatus : '';
  const requestType = ['CANCEL', 'CHANGE'].includes(req.query.requestType) ? req.query.requestType : '';

  const userFilter = {};
  if (userRole) userFilter.role = userRole;
  if (userQ) {
    const escaped = userQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    userFilter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }

  const bookingFilter = {};
  if (bookingStatus) bookingFilter.status = bookingStatus;
  if (bookingFacility) bookingFilter.facility = bookingFacility;
  if (bookingQ) {
    const escaped = bookingQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    bookingFilter.$or = [{ publicCode: regex }, { guestName: regex }, { guestPhone: regex }];
  }

  const requestFilter = {};
  if (requestStatus) requestFilter.status = requestStatus;
  if (requestType) requestFilter.type = requestType;

  const filters = { userQ, userRole, bookingStatus, bookingFacility, bookingQ, requestStatus, requestType };
  const listByTab = {
    users: { model: User, filter: userFilter, pageSize: 50 },
    bookings: { model: Booking, filter: bookingFilter, pageSize: 30 },
    requests: { model: BookingRequest, filter: requestFilter, pageSize: 30 }
  };
  const list = listByTab[activeTab];
  const total = list ? await list.model.countDocuments(list.filter) : 0;
  const pages = list ? Math.max(1, Math.ceil(total / list.pageSize)) : 1;
  const requestedPage = typeof req.query.page === 'string' && /^\d+$/.test(req.query.page) ? Number(req.query.page) : 1;
  const page = Math.max(1, Math.min(pages, requestedPage));
  const offset = tab => activeTab === tab ? (page - 1) * list.pageSize : 0;
  const now = new Date();

  const [
    applications,
    rejectedOwners,
    facilities,
    allCourts,
    owners,
    users,
    recentBookings,
    recentRequests,
    totalUsers,
    lockedUsersCount,
    totalBookings,
    confirmedBookings,
    holdBookings,
    pendingRequestsCount,
    pendingRefundsCount
  ] = await Promise.all([
    User.find({ role: 'OWNER', ownerStatus: 'PENDING' }).sort({ createdAt: 1 }).lean(),
    User.find({ role: 'OWNER', ownerStatus: 'REJECTED' }).sort({ updatedAt: -1 }).limit(30).lean(),
    Facility.find().populate('owner', 'fullName email').sort({ name: 1 }).lean(),
    Court.find().select('facility active').lean(),
    User.find({ role: 'OWNER', ownerStatus: 'APPROVED' }).sort({ fullName: 1 }).lean(),
    User.find(userFilter)
      .select('fullName email phone role ownerStatus emailVerified +failedLoginAttempts +loginLockedUntil createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset('users'))
      .limit(listByTab.users.pageSize)
      .lean(),
    Booking.find(bookingFilter)
      .populate('facility', 'name')
      .populate('court', 'name')
      .populate('user', 'fullName email')
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset('bookings'))
      .limit(listByTab.bookings.pageSize)
      .lean(),
    BookingRequest.find(requestFilter)
      .populate({
        path: 'booking',
        select: 'publicCode date status totalPrice paymentStatus guestName guestPhone',
        populate: [{ path: 'facility', select: 'name' }, { path: 'court', select: 'name' }]
      })
      .populate('user', 'fullName email')
      .populate('requestedCourt', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset('requests'))
      .limit(listByTab.requests.pageSize)
      .lean(),
    User.countDocuments(),
    User.countDocuments({ loginLockedUntil: { $gt: now } }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'CONFIRMED' }),
    Booking.countDocuments({ status: 'HOLD' }),
    BookingRequest.countDocuments({ status: 'PENDING' }),
    BookingRequest.countDocuments({ status: 'APPROVED', refundAmount: { $gt: 0 }, refundStatus: 'PENDING' })
  ]);

  const courtStatsByFacility = new Map();
  for (const court of allCourts) {
    const key = String(court.facility);
    const entry = courtStatsByFacility.get(key) || { total: 0, active: 0 };
    entry.total++;
    if (court.active) entry.active++;
    courtStatsByFacility.set(key, entry);
  }
  const facilitiesWithStats = facilities.map(item => ({
    ...item,
    courtStats: courtStatsByFacility.get(String(item._id)) || { total: 0, active: 0 }
  }));

  const successMessage = req.session?.adminSuccessMessage || null;
  if (req.session?.adminSuccessMessage) delete req.session.adminSuccessMessage;

  const tabTitles = {
    owners: 'Duyệt người đăng ký chủ sân',
    facilities: 'Quản lý cơ sở & sân',
    users: 'Quản lý tài khoản & đăng nhập',
    bookings: 'Giám sát đặt sân toàn hệ thống',
    requests: 'Giám sát hủy sân & đổi giờ'
  };

  res.render('admin-dashboard', {
    title: tabTitles[activeTab] || 'Quản trị hệ thống',
    activeTab,
    applications,
    rejectedOwners,
    facilities: facilitiesWithStats,
    owners,
    users,
    recentBookings,
    recentRequests,
    stats: {
      totalUsers,
      lockedUsersCount,
      totalCourts: allCourts.length,
      totalBookings,
      confirmedBookings,
      holdBookings,
      pendingRequestsCount,
      pendingRefundsCount
    },
    filters,
    pagination: { page, pages, total },
    errorMessage: null,
    successMessage,
    nowMs: now.getTime()
  });
}

export async function approveOwner(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const body = req.body ?? {};
    if (body.facilityId !== undefined && typeof body.facilityId !== 'string') {
      fail(400, 'Mã cơ sở không hợp lệ.');
    }
    const assignment = body.facilityId?.trim() ?? '';
    const facilityId = assignment === 'new' ? '' : assignment;
    if (facilityId && !mongoose.isObjectIdOrHexString(facilityId)) fail(400, 'Mã cơ sở không hợp lệ.');

    await mongoose.connection.transaction(async session => {
      const applicant = await User.findOne({
        _id: req.params.id, role: 'OWNER', ownerStatus: 'PENDING'
      }).session(session);
      if (!applicant) fail(409, 'Đề nghị không còn chờ duyệt hoặc tài khoản không phải chủ sân.');

      if (facilityId) {
        const available = await Facility.findOne({ _id: facilityId, owner: null }).session(session);
        if (!available) fail(409, 'Cơ sở không tồn tại hoặc đã có chủ sân quản lý.');
        const facility = await Facility.findOneAndUpdate(
          { _id: facilityId, owner: null },
          { $set: { owner: applicant._id, ...(!available.phone?.trim() ? { phone: applicant.phone } : {}) } },
          { returnDocument: 'after', runValidators: true, session }
        );
        if (!facility) fail(409, 'Cơ sở không tồn tại hoặc đã có chủ sân quản lý.');
      } else {
        if (!applicant.requestedFacilityName || !applicant.requestedFacilityAddress || !applicant.phone) {
          fail(400, 'Đề nghị thiếu tên, địa chỉ hoặc số điện thoại. Hãy cấp một cơ sở có sẵn.');
        }
        await Facility.create([{
          name: applicant.requestedFacilityName,
          address: applicant.requestedFacilityAddress,
          phone: applicant.phone,
          owner: applicant._id
        }], { session });
      }
      const result = await User.updateOne(
        { _id: applicant._id, role: 'OWNER', ownerStatus: 'PENDING' },
        { $set: { ownerStatus: 'APPROVED' } }, { session, runValidators: true }
      );
      if (result.matchedCount !== 1) fail(409, 'Đề nghị vừa được xử lý. Hãy tải lại danh sách.');
    });
    if (req.session) req.session.adminSuccessMessage = 'Đã duyệt chủ sân và cấp cơ sở quản lý thành công.';
    res.redirect(303, '/admin');
  } catch (error) {
    return showError(res, error);
  }
}

export async function rejectOwner(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const applicant = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'OWNER', ownerStatus: 'PENDING' },
      { $set: { ownerStatus: 'REJECTED' } }, { returnDocument: 'after', runValidators: true }
    );
    if (!applicant) fail(409, 'Đề nghị không còn chờ duyệt.');
    if (req.session) req.session.adminSuccessMessage = 'Đã từ chối đăng ký chủ sân.';
    res.redirect(303, '/admin');
  } catch (error) {
    return showError(res, error);
  }
}

export async function reopenOwner(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const applicant = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'OWNER', ownerStatus: 'REJECTED' },
      { $set: { ownerStatus: 'PENDING' } }, { returnDocument: 'after', runValidators: true }
    );
    if (!applicant) fail(409, 'Tài khoản không ở trạng thái đã từ chối.');
    if (req.session) req.session.adminSuccessMessage = `Đã đưa ${applicant.email} trở lại danh sách chờ duyệt.`;
    res.redirect(303, '/admin?tab=owners');
  } catch (error) {
    return showError(res, error);
  }
}

export async function unlockUser(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { failedLoginAttempts: 0, loginLockedUntil: null } },
      { returnDocument: 'after' }
    );
    if (!user) fail(404, 'Không tìm thấy tài khoản.');
    if (req.session) req.session.adminSuccessMessage = `Đã mở khóa đăng nhập cho ${user.email}.`;
    res.redirect(303, '/admin?tab=users');
  } catch (error) {
    return showError(res, error);
  }
}

export async function verifyUserEmail(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { emailVerified: true, emailVerifyTokenHash: null, emailVerifyExpiresAt: null } },
      { returnDocument: 'after' }
    );
    if (!user) fail(404, 'Không tìm thấy tài khoản.');
    if (req.session) req.session.adminSuccessMessage = `Đã xác nhận email cho ${user.email}.`;
    res.redirect(303, '/admin?tab=users');
  } catch (error) {
    return showError(res, error);
  }
}
