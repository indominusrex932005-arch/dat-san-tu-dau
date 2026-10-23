import Court from '../models/Court.js';
import { getAvailability } from '../services/booking.service.js';

export async function showCourts(req, res) {
  const courts = await Court.find({ active: true }).populate({
    path: 'facility', populate: { path: 'owner', select: 'role ownerStatus' }
  }).sort({ name: 1 }).lean();
  res.render('courts', { title: 'Danh sách sân', courts });
}

export async function showCourt(req, res) {
  const calendar = await getAvailability(req.params.id, req.query.date);
  res.render('court-detail', { title: `Đặt ${calendar.court.name}`, ...calendar, errorMessage: null });
}
