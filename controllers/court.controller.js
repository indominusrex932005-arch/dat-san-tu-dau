import Facility from '../models/Facility.js';
import { searchCourts } from '../services/court-search.service.js';
import { getAvailability } from '../services/booking.service.js';

export async function showCourts(req, res, next) {
  try {
    const result = await searchCourts(req.query);
    res.render('courts', {
      title: 'Danh sách sân',
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
        title: 'Danh sách sân',
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

export async function showCourt(req, res) {
  const calendar = await getAvailability(req.params.id, req.query.date);
  res.render('court-detail', { title: `Đặt ${calendar.court.name}`, ...calendar, errorMessage: null });
}
