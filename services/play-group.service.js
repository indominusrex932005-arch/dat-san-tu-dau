import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import PlayGroup from '../models/PlayGroup.js';
import ExtraService from '../models/ExtraService.js';
import Facility from '../models/Facility.js';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function validId(id) { if (typeof id !== 'string' || !mongoose.isObjectIdOrHexString(id)) fail(400, 'Đường dẫn chưa đúng. Bạn hãy mở lại từ danh sách.'); return id; }
function words(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export async function extraSelection(facility, body = {}, session) {
  const choices = await ExtraService.find({ facility, active: true }).session(session || null).lean();
  return choices.flatMap(item => {
    const raw = body['extra_' + item._id];
    if (raw === undefined || raw === '' || raw === '0') return [];
    if (typeof raw !== 'string' || !/^\d{1,2}$/.test(raw) || Number(raw) > 20) fail(400, 'Mỗi dịch vụ chọn từ 0 đến 20.');
    return [{ name: item.name, unit: item.unit, price: item.price, quantity: Number(raw) }];
  });
}
async function bookingForGroup(id, session) {
  const booking = await Booking.findById(id).session(session);
  if (!booking) fail(404, 'Không tìm thấy đơn đặt sân.');
  // Serialize group actions with cancellation, changes and check-in on the booking.
  await Booking.updateOne({ _id: booking._id }, { $inc: { __v: 1 } }, { session });
  return booking;
}
async function pending(booking, session) { return !!await BookingRequest.exists({ booking, status: 'PENDING' }).session(session); }
function finish(group, now) {
  if (!group.closedAt && Number(group.closesAt) <= Number(now)) {
    group.closedAt = now;
    const base = Math.floor(group.total / group.members.length);
    const remainder = group.total % group.members.length;
    group.members.forEach((member, i) => { member.share = base + (i < remainder ? 1 : 0); });
  }
}
export async function createGroup(user, body) {
  return mongoose.connection.transaction(async session => {
    const booking = await bookingForGroup(validId(body.bookingId), session);
    if (String(booking.user) !== String(user._id)) fail(403, 'Chọn một đơn của bạn để tạo nhóm.');
    if (booking.status !== 'CONFIRMED' || !['DEMO_PAID', 'PAID'].includes(booking.paymentStatus) || booking.checkedInAt) fail(409, 'Hãy hoàn tất đặt sân trước khi tạo nhóm.');
    if (await pending(booking._id, session)) fail(409, 'Bạn xử lý yêu cầu hủy/đổi trước rồi hãy tạo nhóm nhé.');
    const title = words(body.title, 100); const phone = words(body.phone, 30).replace(/[\s.-]/g, '').replace(/^\+84/, '0');
    const closesAt = new Date(body.closesAt + '+07:00'); const start = Math.min(...booking.slots.map(slot => +slot.startAt));
    if (!title || !/^0\d{9}$/.test(phone) || body.consent !== 'yes') fail(400, 'Nhập tên buổi chơi, số liên hệ và đồng ý chia sẻ số với thành viên.');
    if (typeof body.capacity !== 'string' || !/^\d{1,2}$/.test(body.capacity) || Number(body.capacity) < 2 || Number(body.capacity) > 30) fail(400, 'Nhóm chọn từ 2 đến 30 người, tính cả bạn.');
    if (!Number.isFinite(+closesAt) || +closesAt <= Date.now() || +closesAt >= start) fail(400, 'Chọn hạn đăng ký từ bây giờ đến trước giờ chơi.');
    const [group] = await PlayGroup.create([{ booking: booking._id, organizer: user._id, facility: booking.facility,
      title, note: words(body.note, 500), capacity: Number(body.capacity), closesAt, total: booking.totalPrice,
      members: [{ user: user._id, name: user.fullName, phone, extras: booking.extras || [] }] }], { session });
    return group;
  });
}
export async function groupAction(id, user, action, body = {}) {
  return mongoose.connection.transaction(async session => {
    const group = await PlayGroup.findById(validId(id)).session(session);
    if (!group) fail(404, 'Buổi chơi không còn tồn tại.');
    const booking = await bookingForGroup(group.booking, session);
    finish(group, new Date());
    if (action === 'refresh') { await group.save({ session }); return group.toObject(); }
    if (booking.status !== 'CONFIRMED' || booking.checkedInAt || await pending(booking._id, session)) fail(409, 'Buổi chơi đang dừng nhận thay đổi. Bạn xem trạng thái hoặc liên hệ người tạo nhé.');
    if (group.closedAt) fail(409, 'Nhóm đã chốt. Bạn liên hệ người tạo nếu cần hỗ trợ.');
    if (action === 'join') {
      if (group.members.some(item => String(item.user) === String(user._id))) return group.toObject();
      if (group.members.length >= group.capacity) fail(409, 'Vừa đủ người rồi. Bạn thử buổi chơi khác nhé.');
      const phone = words(body.phone, 30).replace(/[\s.-]/g, '').replace(/^\+84/, '0');
      if (!/^0\d{9}$/.test(phone)) fail(400, 'Nhập số điện thoại để người tạo nhóm liên hệ bạn.');
      group.members.push({ user: user._id, name: user.fullName, phone, extras: await extraSelection(group.facility, body, session) });
    } else {
      if (String(group.organizer) !== String(user._id)) fail(403, 'Chỉ người tạo nhóm thực hiện thao tác này.');
      if (action === 'close') { group.closesAt = new Date(); finish(group, new Date()); }
      else if (action === 'remove') {
        validId(body.memberId);
        if (body.memberId === String(group.organizer)) fail(400, 'Người tạo nhóm được tính trong danh sách.');
        group.members = group.members.filter(item => String(item.user) !== body.memberId);
      } else fail(404, 'Không có thao tác này.');
    }
    await group.save({ session }); return group.toObject();
  });
}
export async function ownExtraFacility(user) {
  if (user.role !== 'OWNER' || user.ownerStatus !== 'APPROVED') fail(403, 'Chỉ chủ sân đã duyệt quản lý dịch vụ.');
  const facility = await Facility.findOne({ owner: user._id }).lean();
  if (!facility) fail(403, 'Tài khoản chưa có cơ sở.');
  return facility;
}
