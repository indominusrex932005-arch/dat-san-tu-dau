import { getOwnerCalendar } from '../services/owner-calendar.service.js';

export async function showOwnerCalendar(req, res, next) {
  try {
    const calendar = await getOwnerCalendar(req.currentUser, req.query);
    res.render('owner-calendar', { title: 'Lịch điều hành sân', ...calendar });
  } catch (error) {
    next(error);
  }
}
