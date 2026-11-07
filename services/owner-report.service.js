import Facility from '../models/Facility.js';
import Payment from '../models/Payment.js';
import BookingRequest from '../models/BookingRequest.js';
import { validateDate, vietnamDate, slotInstant } from '../domain/booking-rules.js';

const day = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } };
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function reportRange(query = {}, now = new Date()) {
  const today = vietnamDate(now);
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;
  validateDate(from);
  validateDate(to);
  const start = slotInstant(from, '00:00');
  const end = new Date(Number(slotInstant(to, '00:00')) + 86400000);
  if (end <= start || Number(end) - Number(start) > 366 * 86400000) {
    fail(400, 'Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
  }
  return { from, to, start, end };
}

// Only the demo ledger is reported. Intent reservations and sandbox receipts are
// deliberately excluded: they are not receipts of real money or demo button payments.
export async function ownerDemoReport(owner, query = {}, now = new Date()) {
  if (owner?.role !== 'OWNER' || owner.ownerStatus !== 'APPROVED') fail(403, 'Chỉ chủ sân đã duyệt được xem báo cáo.');
  const range = reportRange(query, now);
  const facility = await Facility.findOne({ owner: owner._id }).lean();
  if (!facility) fail(403, 'Tài khoản chưa được cấp cơ sở.');
  const scopedBooking = [
    { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'bookingDoc' } },
    { $unwind: '$bookingDoc' },
    { $match: { 'bookingDoc.facility': facility._id } }
  ];
  // A booking with an INITIAL_DEMO is demonstrably part of this demo ledger.
  const demoRefunds = [
    ...scopedBooking,
    { $lookup: { from: 'payments', let: { bookingId: '$booking' }, pipeline: [
      { $match: { $expr: { $and: [ { $eq: ['$booking', '$$bookingId'] }, { $eq: ['$type', 'INITIAL_DEMO'] }, { $eq: ['$method', 'DEMO'] } ] } } },
      { $limit: 1 }, { $project: { _id: 1 } }
    ], as: 'demoPayment' } },
    { $match: { 'demoPayment.0': { $exists: true } } }
  ];
  const [income, refunds, pending] = await Promise.all([
    Payment.aggregate([
      { $match: { type: { $in: ['INITIAL_DEMO', 'EXTRA_DEMO'] }, method: 'DEMO', createdAt: { $gte: range.start, $lt: range.end } } },
      ...scopedBooking,
      { $group: { _id: day, amount: { $sum: '$amountVND' }, count: { $sum: 1 } } }
    ]),
    BookingRequest.aggregate([
      { $match: { status: 'APPROVED', refundStatus: 'TRANSFERRED', refundRecordedAt: { $gte: range.start, $lt: range.end } } },
      ...demoRefunds,
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$refundRecordedAt', timezone: 'Asia/Ho_Chi_Minh' } }, amount: { $sum: '$refundAmount' }, count: { $sum: 1 } } }
    ]),
    BookingRequest.aggregate([
      { $match: { status: 'APPROVED', refundStatus: 'PENDING', processedAt: { $gte: range.start, $lt: range.end } } },
      ...demoRefunds,
      { $group: { _id: null, amount: { $sum: '$refundAmount' }, count: { $sum: 1 } } }
    ])
  ]);
  const rows = new Map();
  for (const [items, key] of [[income, 'income'], [refunds, 'refund']]) {
    for (const item of items) {
      if (!rows.has(item._id)) rows.set(item._id, { date: item._id, income: 0, refund: 0, incomeCount: 0, refundCount: 0 });
      rows.get(item._id)[key] = item.amount;
      rows.get(item._id)[`${key}Count`] = item.count;
    }
  }
  const days = [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
  const total = days.reduce((sum, item) => ({ income: sum.income + item.income, refund: sum.refund + item.refund }), { income: 0, refund: 0 });
  return { facility, from: range.from, to: range.to, days, total, pending: pending[0] || { amount: 0, count: 0 } };
}
