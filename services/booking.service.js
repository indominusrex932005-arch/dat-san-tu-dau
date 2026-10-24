import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import Court from '../models/Court.js';
import Facility from '../models/Facility.js';
import Booking from '../models/Booking.js';
import SlotLock from '../models/SlotLock.js';
import Payment from '../models/Payment.js';
import BookingRequest from '../models/BookingRequest.js';
import User from '../models/User.js';
import { HOLD_MINUTES, makeSlots, quoteSelection, vietnamDate, slotInstant, holdExpiresAt, effectiveHoldExpiresAt, validateDate } from '../domain/booking-rules.js';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function objectId(value, label = 'Mã dữ liệu') {
  if ((typeof value !== 'string' && !(value instanceof mongoose.Types.ObjectId))
      || !mongoose.isObjectIdOrHexString(value)) fail(400, `${label} không hợp lệ.`);
  return value;
}
function text(value, max, fallback = '') {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max) fail(400, 'Dữ liệu văn bản không hợp lệ.');
  return value.trim();
}
function selectedTimes(value) {
  const times = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(times) || !times.length || times.length > 48
      || times.some(time => typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[03]0$/.test(time))
      || new Set(times).size !== times.length) fail(400, 'Chọn các ô 30 phút hợp lệ, không lặp lại.');
  return [...times].sort();
}
function bookingDate(value, now = new Date()) {
  if (typeof value !== 'string') fail(400, 'Ngày chơi không hợp lệ.');
  validateDate(value);
  if (value < vietnamDate(now)) fail(400, 'Ngày chơi không được ở quá khứ.');
  return value;
}
function normalizedGuest(name, phone, user) {
  const guestName = text(name, 100, user?.fullName || '');
  const guestPhone = text(phone, 30, user?.phone || '').replace(/[\s.-]/g, '').replace(/^\+84/, '0');
  if (!guestName || !/^0\d{9}$/.test(guestPhone)) fail(400, 'Nhập họ tên và số điện thoại Việt Nam gồm 10 số.');
  return { guestName, guestPhone };
}
function sameId(a, b) { return !!a && !!b && String(a) === String(b); }
function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
function tokenMatches(token, hash) {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)
    && typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)
    && timingSafeEqual(Buffer.from(tokenHash(token), 'hex'), Buffer.from(hash, 'hex'));
}
function asSlots(quote, date) {
  return quote.slots.map(slot => ({ startAt: slotInstant(date, slot.time), endAt: slotInstant(date, slot.endTime), priceVND: slot.priceVND }));
}
function checkedQuote(court, date, times, locks, now) {
  const calendar = makeSlots(court, date, locks, now);
  for (const time of times) {
    const slot = calendar.find(item => item.time === time);
    if (!slot || slot.status === 'UNAVAILABLE') fail(400, `Ô ${time} không thuộc giờ phục vụ hoặc đã qua.`);
    if (slot.status !== 'AVAILABLE') fail(409, `Ô ${time} đã được giữ hoặc đặt. Hãy chọn ô khác.`);
  }
  return quoteSelection(court, date, times, locks, now);
}
function refundValue(value, maximum) {
  const raw = value === undefined || value === '' ? '0' : value;
  if (!((typeof raw === 'number' && Number.isSafeInteger(raw))
    || (typeof raw === 'string' && /^\d{1,15}$/.test(raw)))) fail(400, 'Số tiền hoàn phải là số nguyên không âm.');
  const result = Number(raw);
  if (!Number.isSafeInteger(result) || result < 0 || result > maximum) fail(400, 'Số tiền hoàn vượt quá khoản được phép ghi nhận.');
  return result;
}
function canModify(booking, now) {
  if (!['CONFIRMED', 'LEGACY_RESERVED'].includes(booking.status)) fail(409, 'Đơn chưa xác nhận, đã hết hạn hoặc đã hủy.');
  if (!booking.slots?.length || Math.min(...booking.slots.map(slot => Number(slot.startAt))) <= Number(now)) {
    fail(409, 'Chỉ xử lý hủy/đổi trước khi ô đầu tiên của đơn bắt đầu.');
  }
}
async function transaction(work) {
  try { return await mongoose.connection.transaction(work); }
  catch (error) {
    if (error.code === 11000) fail(409, 'Ô giờ hoặc yêu cầu đã được người khác xử lý. Hãy tải lại để kiểm tra.');
    if (error.code === 20 || /Transaction numbers are only allowed/.test(error.message || '')) {
      fail(503, 'Chức năng giữ nhiều ô cần MongoDB Atlas hoặc MongoDB replica set.');
    }
    throw error;
  }
}
async function cleanupExpired(session, now) {
  const filter = {
    status: 'HOLD',
    $or: [
      { holdExpiresAt: { $lte: now } },
      { 'slots.startAt': { $lte: now } },
      { createdAt: { $lte: new Date(Number(now) - HOLD_MINUTES * 60000) } }
    ]
  };
  const expired = await Booking.find(filter).select('_id').session(session).lean();
  if (!expired.length) return 0;
  const ids = expired.map(item => item._id);
  await Booking.updateMany({ ...filter, _id: { $in: ids } }, { $set: { status: 'EXPIRED' } }, { session });
  await SlotLock.deleteMany({ booking: { $in: ids } }, { session });
  return ids.length;
}
async function expireBooking(booking, session) {
  booking.holdExpiresAt = effectiveHoldExpiresAt(booking);
  booking.status = 'EXPIRED';
  await booking.save({ session });
  await SlotLock.deleteMany({ booking: booking._id }, { session });
}
async function refreshHoldDeadline(id) {
  return transaction(async session => {
    const booking = await Booking.findById(id).session(session);
    if (!booking || booking.status !== 'HOLD') return;
    const deadline = effectiveHoldExpiresAt(booking);
    if (Number(deadline) <= Date.now()) {
      await expireBooking(booking, session);
      return;
    }
    if (Number(deadline) !== Number(booking.holdExpiresAt)) {
      booking.holdExpiresAt = deadline;
      await booking.save({ session });
      // Only shorten old HOLD locks; never extend or recreate a missing lock.
      await SlotLock.updateMany({ booking: booking._id, expiresAt: { $gt: deadline } }, { $set: { expiresAt: deadline } }, { session });
    }
  });
}
async function activeCourt(id, session) {
  objectId(id, 'Mã sân');
  const query = Court.findOne({ _id: id, active: true });
  if (session) query.session(session);
  const court = await query.lean();
  if (!court) fail(404, 'Sân không tồn tại hoặc đã ngừng nhận đặt.');
  return court;
}
async function facilityReady(facility, session) {
  const phone = typeof facility?.phone === 'string'
    ? facility.phone.trim().replace(/[\s.-]/g, '').replace(/^\+84/, '0') : '';
  if (!facility?.owner || !/^0\d{9}$/.test(phone)) return false;
  const query = User.exists({ _id: facility.owner, role: 'OWNER', ownerStatus: 'APPROVED' });
  if (session) query.session(session);
  return !!await query;
}
async function locksFor(courtId, date, session, ignoreBooking) {
  const start = slotInstant(date, '00:00');
  const filter = { court: courtId, slotStart: { $gte: start, $lt: new Date(Number(start) + 86400000) } };
  if (ignoreBooking) filter.booking = { $ne: ignoreBooking };
  const query = SlotLock.find(filter);
  if (session) query.session(session);
  return query.lean();
}
async function ownerFacility(owner, session) {
  if (owner?.role !== 'OWNER' || owner.ownerStatus !== 'APPROVED') fail(403, 'Cần tài khoản chủ sân đã được duyệt.');
  const query = Facility.findOne({ owner: owner._id });
  if (session) query.session(session);
  const facility = await query.lean();
  if (!facility) fail(403, 'Tài khoản chưa được cấp cơ sở quản lý.');
  return facility;
}
async function ownedBooking(id, owner, session) {
  objectId(id, 'Mã đơn');
  const facility = await ownerFacility(owner, session);
  const booking = await Booking.findById(id).session(session);
  if (!booking) fail(404, 'Không tìm thấy đơn đặt sân.');
  if (!sameId(booking.facility, facility._id)) fail(403, 'Bạn không quản lý đơn thuộc cơ sở này.');
  return booking;
}

export async function expireHolds() {
  return transaction(async session => ({ expired: await cleanupExpired(session, new Date()) }));
}

export async function getAvailability(courtId, requestedDate) {
  const now = new Date();
  const date = requestedDate === undefined ? vietnamDate(now) : bookingDate(requestedDate, now);
  const court = await activeCourt(courtId);
  const facility = await Facility.findById(court.facility).lean();
  if (!facility) fail(404, 'Cơ sở của sân không còn tồn tại.');
  const locks = await locksFor(court._id, date);
  return { court: { ...court, facility }, date, slots: makeSlots(court, date, locks, now), facilityReady: await facilityReady(facility) };
}

export async function createHold({ courtId, date: inputDate, times: inputTimes, guestName, guestPhone, user }) {
  const now = new Date();
  const date = bookingDate(inputDate, now);
  const times = selectedTimes(inputTimes);
  const guest = normalizedGuest(guestName, guestPhone, user);
  objectId(courtId, 'Mã sân');
  const token = user?._id ? '' : randomBytes(32).toString('hex');
  const id = new mongoose.Types.ObjectId();
  await transaction(async session => {
    const current = new Date();
    await cleanupExpired(session, current);
    const court = await activeCourt(courtId, session);
    const facility = await Facility.findById(court.facility).session(session).lean();
    if (!facility) fail(404, 'Cơ sở của sân không còn tồn tại.');
    if (!await facilityReady(facility, session)) {
      fail(409, 'Cơ sở chưa được cấp chủ sân hoặc số liên hệ. Vui lòng chọn cơ sở khác.');
    }
    const quote = checkedQuote(court, date, times, await locksFor(court._id, date, session), current);
    const slots = asSlots(quote, date);
    const expiry = holdExpiresAt(current, slots);
    if (Number(expiry) <= Date.now()) fail(400, 'Ô đầu tiên đã bắt đầu. Hãy chọn lại các ô còn trống.');
    await Booking.create([{
      _id: id, user: user?._id || null, facility: court.facility, court: court._id,
      publicCode: 'DS-' + randomBytes(6).toString('hex').toUpperCase(), ...guest,
      guestTokenHash: token ? tokenHash(token) : undefined,
      date, slots, totalPrice: quote.totalPriceVND, status: 'HOLD',
      paymentStatus: 'UNPAID', holdExpiresAt: expiry, legacy: false
    }], { session });
    await SlotLock.insertMany(slots.map(slot => ({ court: court._id, booking: id, slotStart: slot.startAt, expiresAt: expiry })), { session });
  });
  return { booking: await getBookingForViewer(id, { user, token }), token };
}

export async function getBookingForViewer(id, { user, token } = {}) {
  objectId(id, 'Mã đơn');
  let booking = await Booking.findById(id).select('+guestTokenHash').lean();
  if (!booking) fail(404, 'Không tìm thấy đơn đặt sân.');
  let allowed = user?.role === 'ADMIN' || sameId(booking.user, user?._id);
  if (!allowed && user?.role === 'OWNER' && user.ownerStatus === 'APPROVED') {
    allowed = !!await Facility.exists({ _id: booking.facility, owner: user._id });
  }
  if (!allowed && !booking.user) allowed = tokenMatches(token, booking.guestTokenHash);
  if (!allowed) fail(403, 'Bạn không có quyền xem đơn này. Khách vãng lai cần link phiếu riêng.');
  if (booking.status === 'HOLD' && (Number(effectiveHoldExpiresAt(booking)) !== Number(booking.holdExpiresAt)
      || Number(effectiveHoldExpiresAt(booking)) <= Date.now())) {
    await refreshHoldDeadline(id);
    booking = await Booking.findById(id).select('+guestTokenHash').lean();
  }
  const result = await Booking.populate(booking, [
    { path: 'court', populate: { path: 'facility' } }, { path: 'facility' }
  ]);
  delete result.guestTokenHash;
  return result;
}

export async function simulatePayment(id, { user, token } = {}) {
  if (process.env.DEMO_MODE !== 'true' || process.env.NODE_ENV === 'production') fail(403, 'Mô phỏng thanh toán chỉ mở trong chế độ demo.');
  await getBookingForViewer(id, { user, token });
  const confirmed = await transaction(async session => {
    const now = new Date();
    const booking = await Booking.findById(id).session(session);
    if (!booking) fail(404, 'Không tìm thấy đơn đặt sân.');
    if (booking.status === 'CONFIRMED' && booking.paymentStatus === 'DEMO_PAID') return true;
    if (booking.status === 'EXPIRED') return false;
    if (booking.status !== 'HOLD') fail(409, 'Đơn không còn ở trạng thái chờ thanh toán.');
    const deadline = effectiveHoldExpiresAt(booking);
    if (Number(deadline) <= Number(now)) {
      await expireBooking(booking, session);
      return false;
    }
    const locks = await SlotLock.find({ booking: booking._id }).session(session).lean();
    const confirmationTime = new Date();
    if (Number(deadline) <= Number(confirmationTime)) {
      await expireBooking(booking, session);
      return false;
    }
    if (locks.length !== booking.slots.length || locks.some(lock => !lock.expiresAt || Number(lock.expiresAt) <= Number(confirmationTime))
      || booking.slots.some(slot => !locks.some(lock => Number(lock.slotStart) === Number(slot.startAt) && sameId(lock.court, booking.court)))) {
      fail(409, 'Đơn không còn giữ đủ các ô đã chọn. Hãy chọn sân lại.');
    }
    await SlotLock.updateMany({ booking: booking._id }, { $set: { expiresAt: null } }, { session });
    if (Number(deadline) <= Date.now()) {
      await expireBooking(booking, session);
      return false;
    }
    booking.status = 'CONFIRMED';
    booking.paymentStatus = 'DEMO_PAID';
    booking.holdExpiresAt = undefined;
    await booking.save({ session });
    await Payment.updateOne({ booking: booking._id, type: 'INITIAL_DEMO' }, {
      $setOnInsert: { booking: booking._id, type: 'INITIAL_DEMO', method: 'DEMO', amountVND: booking.totalPrice, recordedBy: user?._id || null }
    }, { upsert: true, session, runValidators: true });
    return true;
  });
  // Commit expiry and release every slot before returning the failure response.
  if (!confirmed) fail(410, 'Đã hết hạn giữ sân: tối đa 10 phút, trước khi ô đầu tiên bắt đầu. Hãy chọn lại các ô còn trống.');
  return getBookingForViewer(id, { user, token });
}

export async function createChangeRequest(id, user, body = {}) {
  objectId(id, 'Mã đơn');
  if (!user?._id) fail(403, 'Đăng nhập để gửi yêu cầu hủy/đổi.');
  const type = text(body.type, 10);
  if (!['CANCEL', 'CHANGE'].includes(type)) fail(400, 'Chọn loại yêu cầu hủy hoặc đổi.');
  const reason = text(body.reason, 1000);
  if (!reason) fail(400, 'Nhập lý do để chủ sân xử lý.');
  return transaction(async session => {
    const booking = await Booking.findById(id).session(session);
    if (!booking) fail(404, 'Không tìm thấy đơn đặt sân.');
    if (!sameId(booking.user, user._id)) fail(403, 'Bạn chỉ được gửi yêu cầu cho đơn của mình.');
    canModify(booking, new Date());
    // Viết lên đơn để việc tạo yêu cầu đồng thời với hủy/đổi phải tranh chấp cùng document.
    await Booking.updateOne({ _id: booking._id }, { $inc: { __v: 1 } }, { session });
    const details = { booking: booking._id, user: user._id, type, reason, status: 'PENDING', source: 'CUSTOMER' };
    if (type === 'CHANGE') {
      details.requestedCourt = objectId(body.requestedCourt, 'Mã sân muốn đổi');
      details.requestedDate = bookingDate(body.requestedDate);
      details.requestedTimes = selectedTimes(body.requestedTimes ?? body['requestedTimes[]']);
      const court = await activeCourt(details.requestedCourt, session);
      if (!sameId(court.facility, booking.facility)) fail(400, 'Chỉ đổi sang sân trong cùng cơ sở.');
      checkedQuote(court, details.requestedDate, details.requestedTimes,
        await locksFor(court._id, details.requestedDate, session, booking._id), new Date());
    }
    const [request] = await BookingRequest.create([details], { session });
    return request.toObject();
  });
}

async function applyCancellation(booking, request, body, session, now) {
  canModify(booking, now);
  const maximum = booking.paymentStatus === 'UNPAID' ? 0 : booking.totalPrice;
  const refundAmount = refundValue(body.refundAmount, maximum);
  booking.status = 'CANCELLED';
  await booking.save({ session });
  await SlotLock.deleteMany({ booking: booking._id }, { session });
  request.status = 'APPROVED';
  request.refundAmount = refundAmount;
  request.refundStatus = refundAmount > 0 ? 'PENDING' : 'NONE';
  request.ownerNote = text(body.ownerNote, 1000);
  request.processedAt = now;
  await request.save({ session });
  return request.toObject();
}

export async function approveRequest(requestId, owner, body = {}) {
  objectId(requestId, 'Mã yêu cầu');
  return transaction(async session => {
    const now = new Date();
    await cleanupExpired(session, now);
    const request = await BookingRequest.findById(requestId).session(session);
    if (!request) fail(404, 'Không tìm thấy yêu cầu.');
    const booking = await ownedBooking(request.booking, owner, session);
    if (request.status === 'APPROVED') return request.toObject();
    if (request.status !== 'PENDING') fail(409, 'Yêu cầu đã được xử lý.');
    if (request.type === 'CANCEL') return applyCancellation(booking, request, body, session, now);
    canModify(booking, now);
    const court = await activeCourt(request.requestedCourt, session);
    if (!sameId(court.facility, booking.facility)) fail(400, 'Chỉ đổi sân trong cùng cơ sở.');
    const date = bookingDate(request.requestedDate, now);
    const times = selectedTimes(request.requestedTimes);
    const quote = checkedQuote(court, date, times, await locksFor(court._id, date, session, booking._id), now);
    const extraAmount = Math.max(0, quote.totalPriceVND - booking.totalPrice);
    if (extraAmount > 0 && !['yes', 'on', 'true', '1'].includes(body.extraPaymentConfirmed)) {
      fail(400, 'Cần xác nhận đã xử lý khoản chênh lệch với khách trước khi duyệt đổi.');
    }
    const maximumRefund = booking.paymentStatus === 'UNPAID' ? 0 : Math.max(0, booking.totalPrice - quote.totalPriceVND);
    const refundAmount = refundValue(body.refundAmount, maximumRefund);
    const slots = asSlots(quote, date);
    await SlotLock.deleteMany({ booking: booking._id }, { session });
    await SlotLock.insertMany(slots.map(slot => ({ court: court._id, booking: booking._id, slotStart: slot.startAt, expiresAt: null })), { session });
    booking.court = court._id;
    booking.date = date;
    booking.slots = slots;
    booking.totalPrice = quote.totalPriceVND;
    booking.startHour = undefined;
    await booking.save({ session });
    if (extraAmount > 0 && booking.paymentStatus === 'DEMO_PAID') {
      await Payment.create([{ booking: booking._id, amountVND: extraAmount, type: 'EXTRA_DEMO', method: 'DEMO', recordedBy: owner._id }], { session });
    }
    request.status = 'APPROVED';
    request.ownerNote = text(body.ownerNote, 1000);
    request.extraAmount = extraAmount;
    request.refundAmount = refundAmount;
    request.refundStatus = refundAmount > 0 ? 'PENDING' : 'NONE';
    request.processedAt = now;
    await request.save({ session });
    return request.toObject();
  });
}

export async function rejectRequest(requestId, owner, body = {}) {
  objectId(requestId, 'Mã yêu cầu');
  return transaction(async session => {
    const request = await BookingRequest.findById(requestId).session(session);
    if (!request) fail(404, 'Không tìm thấy yêu cầu.');
    await ownedBooking(request.booking, owner, session);
    if (request.status === 'REJECTED') return request.toObject();
    if (request.status !== 'PENDING') fail(409, 'Yêu cầu đã được xử lý.');
    request.status = 'REJECTED';
    request.ownerNote = text(body.ownerNote, 1000);
    request.processedAt = new Date();
    await request.save({ session });
    return request.toObject();
  });
}

export async function recordRefund(requestId, owner, body = {}) {
  objectId(requestId, 'Mã yêu cầu');
  return transaction(async session => {
    const request = await BookingRequest.findById(requestId).session(session);
    if (!request) fail(404, 'Không tìm thấy yêu cầu.');
    await ownedBooking(request.booking, owner, session);
    if (request.status !== 'APPROVED' || !request.refundAmount || request.refundStatus === 'NONE') fail(409, 'Yêu cầu không có khoản hoàn cần ghi nhận.');
    if (request.refundStatus === 'TRANSFERRED') return request.toObject();
    request.refundStatus = 'TRANSFERRED';
    request.refundRecordedAt = new Date();
    request.ownerNote = text(body.ownerNote, 1000, request.ownerNote || '');
    await request.save({ session });
    return request.toObject();
  });
}

export async function cancelByOwner(bookingId, owner, body = {}) {
  objectId(bookingId, 'Mã đơn');
  return transaction(async session => {
    const now = new Date();
    const booking = await ownedBooking(bookingId, owner, session);
    if (booking.status === 'CANCELLED') return { booking: booking._id, status: 'APPROVED' };
    let request = await BookingRequest.findOne({ booking: booking._id, status: 'PENDING' }).session(session);
    if (request?.type === 'CHANGE') fail(409, 'Đơn đang có yêu cầu đổi. Hãy xử lý yêu cầu đó trước.');
    if (!request) {
      [request] = await BookingRequest.create([{
        booking: booking._id, user: booking.user || null, type: 'CANCEL', source: 'OWNER_CALL',
        reason: text(body.ownerNote, 1000) || 'Chủ sân tiếp nhận yêu cầu qua điện thoại.', status: 'PENDING'
      }], { session });
    }
    return applyCancellation(booking, request, body, session, now);
  });
}
