import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import BookingRequest from '../models/BookingRequest.js';
import { createHold, getAvailability, getBookingForViewer, simulatePayment, createChangeRequest, expireHolds } from '../services/booking.service.js';

function tokenFrom(req) {
  const token = req.body?.token ?? req.query.token;
  return typeof token === 'string' ? token : '';
}
function tokenQuery(token) { return token ? '?token=' + encodeURIComponent(token) : ''; }
function submittedText(value, fallback = '') {
  return typeof value === 'string' ? value : value === undefined ? fallback : '';
}
function requestedTimes(value) {
  const times = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return [...new Set(times.filter(time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[03]0$/.test(time)))].sort();
}

export async function createBooking(req, res) {
  const body = req.body ?? {};
  let result;
  try {
    result = await createHold({
      courtId: body.courtId, date: body.date, times: body.times ?? body['times[]'],
      guestName: body.guestName, guestPhone: body.guestPhone, user: req.currentUser
    });
  } catch (error) {
    if (![400, 409].includes(error.status) || typeof body.courtId !== 'string' || typeof body.date !== 'string') throw error;
    // Read the calendar again after the failed transaction; never restore a stale availability or price.
    // Invalid IDs/dates, disappeared courts and database failures keep their own error handling.
    const calendar = await getAvailability(body.courtId, body.date);
    const requested = requestedTimes(body.times ?? body['times[]']);
    const selectedTimes = calendar.facilityReady
      ? calendar.slots.filter(slot => slot.status === 'AVAILABLE' && requested.includes(slot.time)).map(slot => slot.time) : [];
    const unavailableSelections = requested.filter(time => !selectedTimes.includes(time)).map(time => {
      const slot = calendar.slots.find(slot => slot.time === time);
      return { time, endTime: slot?.endTime, status: slot?.status === 'LOCKED' || slot?.status === 'BOOKED' ? slot.status : 'UNAVAILABLE' };
    });
    const recoveryUrl = `/courts/${calendar.court._id}?date=${calendar.date}`;
    return res.status(error.status).set('Content-Location', recoveryUrl).render('court-detail', {
      title: `Đặt ${calendar.court.name}`, ...calendar, errorMessage: error.message,
      bookingFormError: true, recoveryUrl, selectedTimes, unavailableSelections,
      formValues: {
        guestName: submittedText(body.guestName, req.currentUser?.fullName || ''),
        guestPhone: submittedText(body.guestPhone, req.currentUser?.phone || '')
      }
    });
  }
  res.redirect(303, `/bookings/${result.booking._id}/checkout${tokenQuery(result.token)}`);
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
