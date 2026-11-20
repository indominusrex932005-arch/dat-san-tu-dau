import Facility from '../models/Facility.js';
import { searchCourts } from '../services/court-search.service.js';
import { getAvailability } from '../services/booking.service.js';

export async function showCourts(req, res, next) {
  try {
    const result = await searchCourts(req.query);
    res.render('courts', {
      title: 'Thuê sân riêng',
      suggestions: [],
      suggestionMessage: null,
      ...result
    });
  } catch (error) {
    if (error.name === 'RuleError') {
      const facilities = await Facility.find().sort({ name: 1 }).lean().catch(() => []);
      const filters = {
        facilityId: typeof req.query?.facilityId === 'string' ? req.query.facilityId.trim() : '',
        date: typeof req.query?.date === 'string' ? req.query.date.trim() : '',
        startTime: typeof req.query?.startTime === 'string' ? req.query.startTime.trim() : '',
        endTime: typeof req.query?.endTime === 'string' ? req.query.endTime.trim() : ''
      };
      return res.status(400).render('courts', {
        title: 'Thuê sân riêng',
        courts: [],
        facilities,
        filters,
        filterError: error.message,
        suggestions: [],
        suggestionMessage: null
      });
    }
    next(error);
  }
}

function queryTimes(value) {
  const times = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  return [...new Set(times.filter(time => typeof time === 'string' && /^(?:[01]\d|2[0-3]):[03]0$/.test(time)))].sort();
}

export async function showCourt(req, res) {
  const calendar = await getAvailability(req.params.id, req.query.date);
  const selectedTimes = queryTimes(req.query.times);
  res.render('court-detail', { title: `Đặt ${calendar.court.name}`, ...calendar, selectedTimes, errorMessage: null });
}

export async function showCourtAvailability(req, res) {
  try {
    const calendar = await getAvailability(req.params.id, req.query.date);
    return res.json({
      courtId: String(calendar.court._id),
      courtName: calendar.court.name,
      facilityName: calendar.court.facility?.name || 'Cơ sở thể thao',
      date: calendar.date,
      facilityReady: calendar.facilityReady,
      slots: calendar.slots.map(slot => ({
        time: slot.time,
        endTime: slot.endTime,
        status: slot.status,
        priceVND: slot.priceVND
      }))
    });
  } catch (error) {
    const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
    return res.status(status).json({ error: status >= 500 ? 'Không thể tải lịch sân.' : error.message });
  }
}
