import Facility from '../models/Facility.js';
import { searchCourts } from '../services/court-search.service.js';
import { getAvailability } from '../services/booking.service.js';

/** Lấy giá trị string đầu tiên từ req.query (tránh array khi key lặp). */
function qs(raw) {
  if (Array.isArray(raw)) return typeof raw[0] === 'string' ? raw[0].trim() : '';
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function showCourts(req, res, next) {
  const query = {
    facilityId: qs(req.query?.facilityId),
    date:       qs(req.query?.date),
    startTime:  qs(req.query?.startTime),
    endTime:    qs(req.query?.endTime)
  };

  try {
    const result = await searchCourts(query);
    res.render('courts', {
      title: 'Danh sách sân',
      ...result
    });
  } catch (error) {
    if (error.name === 'RuleError') {
      const facilities = await Facility.find().sort({ name: 1 }).lean().catch(() => []);
      return res.status(400).render('courts', {
        title: 'Danh sách sân',
        courts: [],
        facilities,
        filters: query,
        filterError: error.message
      });
    }
    next(error);
  }
}

export async function showCourt(req, res) {
  const calendar = await getAvailability(req.params.id, req.query.date);
  res.render('court-detail', { title: `Đặt ${calendar.court.name}`, ...calendar, errorMessage: null });
}
