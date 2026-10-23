import mongoose from 'mongoose';
import User from '../models/User.js';
import Facility from '../models/Facility.js';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function showError(res, error) {
  const status = error.code === 11000 ? 409 : error.status;
  if (!Number.isInteger(status) || status < 400 || status >= 500) throw error;
  return res.status(status).render('error', {
    title: 'Không thể xử lý tài khoản chủ sân',
    message: error.code === 11000 ? 'Cơ sở hoặc tài khoản đã được cấp quyền. Hãy tải lại danh sách.' : error.message,
    backUrl: '/admin'
  });
}

export async function showAdminDashboard(req, res) {
  const [applications, facilities, owners] = await Promise.all([
    User.find({ role: 'OWNER', ownerStatus: 'PENDING' }).sort({ createdAt: 1 }).lean(),
    Facility.find().populate('owner', 'fullName email').sort({ name: 1 }).lean(),
    User.find({ role: 'OWNER', ownerStatus: 'APPROVED' }).sort({ fullName: 1 }).lean()
  ]);
  res.render('admin-dashboard', {
    title: 'Duyệt tài khoản chủ sân', applications, facilities, owners, errorMessage: null
  });
}

export async function approveOwner(req, res) {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) fail(400, 'Mã tài khoản không hợp lệ.');
    const body = req.body ?? {};
    if (body.facilityId !== undefined && typeof body.facilityId !== 'string') {
      fail(400, 'Mã cơ sở không hợp lệ.');
    }
    const facilityId = body.facilityId?.trim() ?? '';
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
    res.redirect(303, '/admin');
  } catch (error) {
    return showError(res, error);
  }
}
