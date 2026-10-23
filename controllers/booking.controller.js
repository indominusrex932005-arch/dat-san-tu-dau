import mongoose from 'mongoose';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import { validBookingDate, slotIsFuture } from '../utils/booking-time.js';

export async function createBooking(req, res) {
  const { courtId, date, startHour } = req.body ?? {};
  if (typeof courtId !== 'string' || !mongoose.isObjectIdOrHexString(courtId)
      || !validBookingDate(date)
      || typeof startHour !== 'string' || !/^\d{1,2}$/.test(startHour)) {
    return res.status(400).render('error', {
      title: 'Dữ liệu không hợp lệ', message: 'Kiểm tra lại sân, ngày và giờ đặt.', backUrl: '/courts'
    });
  }

  const hour = Number(startHour);
  const court = await Court.findOne({ _id: courtId, active: true });
  if (!court) {
    return res.status(404).render('error', {
      title: 'Không tìm thấy sân', message: 'Sân không tồn tại hoặc đã ngừng nhận đặt.', backUrl: '/courts'
    });
  }
  if (!slotIsFuture(date, hour)) {
    return res.status(400).render('error', {
      title: 'Giờ không hợp lệ', message: 'Chọn một khung giờ còn ở tương lai, từ 06:00 đến 22:00.',
      backUrl: `/courts/${courtId}?date=${date}`
    });
  }

  try {
    await Booking.create({
      user: req.currentUser._id, court: court._id, date, startHour: hour,
      totalPrice: court.pricePerHour
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).render('error', {
        title: 'Khung giờ đã được đặt',
        message: 'Đã có người đặt sân trong khung giờ này. Vui lòng chọn giờ khác.',
        backUrl: `/courts/${courtId}?date=${date}`
      });
    }
    throw error;
  }

  res.redirect(303, '/my-bookings');
}

export async function showMyBookings(req, res) {
  const bookings = await Booking.find({ user: req.currentUser._id })
    .populate({ path: 'court', populate: { path: 'facility', select: 'name address' } })
    .sort({ date: -1, startHour: -1 }).lean();
  res.render('my-bookings', { title: 'Lịch sử đặt sân', bookings });
}
