import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import { createHold, getBookingForViewer, simulatePayment, createChangeRequest, expireHolds } from '../services/booking.service.js';

function tokenFrom(req) {
  const token = req.body?.token ?? req.query.token;
  return typeof token === 'string' ? token : '';
}
function tokenQuery(token) { return token ? '?token=' + encodeURIComponent(token) : ''; }

export async function createBooking(req, res) {
  const body = req.body ?? {};
  const { booking, token } = await createHold({
    courtId: body.courtId, date: body.date, times: body.times ?? body['times[]'],
    guestName: body.guestName, guestPhone: body.guestPhone, user: req.currentUser
  });
  res.redirect(303, `/bookings/${booking._id}/checkout${tokenQuery(token)}`);
}

export async function showCheckout(req, res) {
  const token = tokenFrom(req);
  const booking = await getBookingForViewer(req.params.id, { user: req.currentUser, token });
  if (booking.status === 'CONFIRMED') return res.redirect(303, `/bookings/${booking._id}/receipt${tokenQuery(token)}`);
  res.status(booking.status === 'EXPIRED' ? 410 : 200).render('booking-checkout', {
    title: 'Kiểm tra và thanh toán', booking, token, errorMessage: null
  });
}

export async function payDemo(req, res) {
  const token = tokenFrom(req);
  const booking = await simulatePayment(req.params.id, { user: req.currentUser, token });
  res.redirect(303, `/bookings/${booking._id}/receipt${tokenQuery(token)}`);
}

export async function showReceipt(req, res) {
  const token = tokenFrom(req);
  const booking = await getBookingForViewer(req.params.id, { user: req.currentUser, token });
  if (booking.status === 'HOLD') return res.redirect(303, `/bookings/${booking._id}/checkout${tokenQuery(token)}`);
  res.render('booking-receipt', { title: 'Phiếu đặt sân', booking, token, errorMessage: null });
}

export async function showMyBookings(req, res) {
  await expireHolds();
  const bookings = await Booking.find({ user: req.currentUser._id })
    .populate({ path: 'court', populate: { path: 'facility' } }).populate('facility')
    .sort({ createdAt: -1 }).lean();
  const requests = await BookingRequest.find({ booking: { $in: bookings.map(booking => booking._id) } }).sort({ createdAt: -1 }).lean();
  for (const booking of bookings) booking.requests = requests.filter(request => String(request.booking) === String(booking._id));
  res.render('my-bookings', { title: 'Lịch sử đặt sân', bookings });
}

export async function showRequestForm(req, res) {
  const booking = await getBookingForViewer(req.params.id, { user: req.currentUser });
  if (!booking.user || String(booking.user) !== String(req.currentUser._id)) {
    throw Object.assign(new Error('Bạn chỉ được gửi yêu cầu cho đơn của mình.'), { status: 403 });
  }
  const courts = await Court.find({ facility: booking.facility?._id, active: true }).sort({ name: 1 }).lean();
  res.render('booking-request', { title: 'Yêu cầu hủy hoặc đổi sân', booking, courts, token: '', errorMessage: null });
}

export async function sendRequest(req, res) {
  await createChangeRequest(req.params.id, req.currentUser, req.body ?? {});
  res.redirect(303, '/my-bookings');
}
