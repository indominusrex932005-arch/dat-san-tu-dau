import PlayGroup from '../models/PlayGroup.js';
import ExtraService from '../models/ExtraService.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import { createGroup, groupAction, validId, ownExtraFacility } from '../services/play-group.service.js';
const populate = [{ path: 'booking', populate: [{ path: 'court' }, { path: 'facility' }] }];
export async function listGroups(req, res) {
  const mine = req.query.mine === '1' && req.currentUser;
  const groups = await PlayGroup.find(mine ? { 'members.user': req.currentUser._id } : {}).select('-members.phone').populate(populate).sort({ createdAt: -1 }).limit(60).lean();
  res.render('play-groups', { title: 'Tìm bạn ra sân', groups });
}
export async function newGroup(req, res) {
  const bookings = await Booking.find({ user: req.currentUser._id, status: 'CONFIRMED', checkedInAt: null, 'slots.0.startAt': { $gt: new Date() } }).populate('court').populate('facility').sort({ date: 1 }).limit(100).lean();
  const existing = await PlayGroup.find({ booking: { $in: bookings.map(item => item._id) } }).select('booking').lean();
  res.render('play-group-new', { title: 'Rủ bạn cùng chơi', selectedBooking: typeof req.query.booking === 'string' ? req.query.booking : '', bookings: bookings.filter(item => !existing.some(group => String(group.booking) === String(item._id))) });
}
export async function saveGroup(req, res) {
  try { const group = await createGroup(req.currentUser, req.body || {}); res.redirect(303, `/groups/${group._id}`); }
  catch (error) { if (error.code === 11000) throw Object.assign(new Error('Đơn này đã có nhóm. Bạn xem trong danh sách sân ghép nhé.'), { status: 409 }); throw error; }
}
export async function showGroup(req, res) {
  await groupAction(req.params.id, null, 'refresh');
  const group = await PlayGroup.findById(validId(req.params.id)).populate(populate).lean();
  const organizer = String(group.organizer) === String(req.currentUser?._id);
  const joined = group.members.some(item => String(item.user) === String(req.currentUser?._id));
  const waiting = !!await BookingRequest.exists({ booking: group.booking._id, status: 'PENDING' });
  const extras = await ExtraService.find({ facility: group.facility, active: true }).lean();
  res.render('play-group-detail', { title: group.title, group, organizer, joined, waiting, extras });
}
export async function updateGroup(req, res) { await groupAction(req.params.id, req.currentUser, req.params.action, req.body || {}); res.redirect(303, `/groups/${req.params.id}`); }
export async function extraPage(req, res) {
  const facility = await ownExtraFacility(req.currentUser);
  const extras = await ExtraService.find({ facility: facility._id }).sort({ createdAt: -1 }).lean();
  const bookings = await Booking.find({ facility: facility._id, 'extras.0': { $exists: true } }).sort({ createdAt: -1 }).limit(50).lean();
  const groups = await PlayGroup.find({ facility: facility._id, 'members.extras.0': { $exists: true } }).limit(50).lean();
  res.render('owner-extras', { title: 'Nước và đồ thuê', facility, extras, bookings, groups });
}
export async function saveExtra(req, res) {
  const facility = await ownExtraFacility(req.currentUser); const b = req.body || {};
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80 || typeof b.unit !== 'string' || !b.unit.trim() || b.unit.length > 30 || typeof b.price !== 'string' || !/^\d{1,8}$/.test(b.price) || Number(b.price) > 10000000) throw Object.assign(new Error('Nhập tên dịch vụ, đơn vị và giá từ 0 đến 10.000.000đ.'), { status: 400 });
  if (await ExtraService.countDocuments({ facility: facility._id }) >= 30) throw Object.assign(new Error('Bạn có thể dùng tối đa 30 dịch vụ cho cơ sở.'), { status: 400 });
  await ExtraService.create({ facility: facility._id, name: b.name.trim(), unit: b.unit.trim(), price: Number(b.price) }); res.redirect(303, '/owner/extras');
}
export async function toggleExtra(req, res) {
  const facility = await ownExtraFacility(req.currentUser);
  const item = await ExtraService.findOne({ _id: validId(req.params.id), facility: facility._id });
  if (!item) throw Object.assign(new Error('Không tìm thấy dịch vụ.'), { status: 404 });
  item.active = !item.active; await item.save(); res.redirect(303, '/owner/extras');
}
