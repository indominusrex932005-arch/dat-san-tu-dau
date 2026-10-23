import mongoose from 'mongoose';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import { getVietnamDate, validBookingDate, slotIsFuture } from '../utils/booking-time.js';

export async function showCourts(req, res) {
  const courts = await Court.find({ active: true }).populate('facility').sort({ name: 1 }).lean();
  res.render('courts', { title: 'Danh sách sân', courts });
}

export async function showCourt(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res.status(400).render('error', {
      title: 'Đường dẫn không hợp lệ', message: 'Mã sân không hợp lệ.', backUrl: '/courts'
    });
  }

  const date = req.query.date === undefined ? getVietnamDate() : req.query.date;
  if (!validBookingDate(date)) {
    return res.status(400).render('error', {
      title: 'Ngày không hợp lệ', message: 'Chọn ngày có thật và không ở quá khứ.', backUrl: '/courts'
    });
  }

  const court = await Court.findOne({ _id: req.params.id, active: true }).populate('facility').lean();
  if (!court) {
    return res.status(404).render('error', {
      title: 'Không tìm thấy sân', message: 'Sân không tồn tại hoặc đã ngừng nhận đặt.', backUrl: '/courts'
    });
  }

  const bookings = await Booking.find({ court: court._id, date }).select('startHour -_id').lean();
  const bookedHours = new Set(bookings.map(booking => booking.startHour));
  const availableHours = Array.from({ length: 16 }, (_, index) => index + 6)
    .filter(hour => !bookedHours.has(hour) && slotIsFuture(date, hour));

  res.render('court-detail', {
    title: `Đặt ${court.name}`, court, date, availableHours, errorMessage: null
  });
}
