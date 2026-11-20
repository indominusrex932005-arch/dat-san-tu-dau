import Court from '../models/Court.js';
import { vietnamDate } from '../domain/booking-rules.js';
import { getAvailability } from '../services/booking.service.js';
import { facilityCatalog } from '../services/facility-catalog.service.js';

export async function showHome(req, res) {
  const facilities = await facilityCatalog();
  const today = vietnamDate(new Date());
  const rawCourts = await Court.find({ active: true })
    .populate('facility', 'name owner phone')
    .sort({ name: 1 })
    .lean();
  const validCourts = rawCourts.filter(court => court.facility);
  const quickCourts = validCourts.map(court => ({
    _id: String(court._id),
    name: court.name,
    facilityName: court.facility.name,
    ready: Boolean(court.facility.owner && court.facility.phone)
  }));
  const defaultCourt = quickCourts.find(court => court.ready) || quickCourts[0] || null;
  let initialCalendar = null;
  if (defaultCourt) {
    try {
      initialCalendar = await getAvailability(defaultCourt._id, today);
    } catch {
      initialCalendar = null;
    }
  }
  res.render('home', {
    title: 'SanXanh — Đặt sân thể thao trực tuyến',
    facilities,
    quickCourts,
    initialCalendar,
    today,
    serverNow: new Date().toISOString()
  });
}
