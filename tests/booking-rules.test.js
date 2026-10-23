import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSlots, quoteSelection, holdExpiresAt, slotInstant, validateDate } from '../domain/booking-rules.js';

const court = { openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '21:00', basePriceVND: 50000, peakPriceVND: 75000 };
const date = '2030-05-10';
const now = new Date('2030-05-10T05:00:00+07:00');

test('Lịch chia 30 phút và chỉ áp giá cao điểm trong khoảng đã cấu hình', () => {
  const slots = makeSlots(court, date, [], now);
  assert.equal(slots.length, 32);
  assert.equal(slots[0].time, '06:00');
  assert.equal(slots.at(-1).endTime, '22:00');
  assert.equal(slots.find(slot => slot.time === '16:30').priceVND, 50000);
  assert.equal(slots.find(slot => slot.time === '17:00').priceVND, 75000);
  assert.equal(slots.find(slot => slot.time === '20:30').priceVND, 75000);
  assert.equal(slots.find(slot => slot.time === '21:00').priceVND, 50000);
});

test('Ô rời nhau chỉ tính những ô đã chọn và sắp xếp theo giờ', () => {
  const quote = quoteSelection(court, date, ['19:00', '06:30', '16:30'], [], now);
  assert.deepEqual(quote.slots.map(slot => slot.time), ['06:30', '16:30', '19:00']);
  assert.equal(quote.totalMinutes, 90);
  assert.equal(quote.totalPriceVND, 175000);
  assert.equal(quote.slots.length, 3);
});

test('Không chọn trùng ô, ô ngoài giờ hoặc đầu vào không phải mảng giờ', () => {
  for (const times of [[], ['06:00', '06:00'], ['05:30'], ['22:00'], ['17:15'], [17], '17:00']) {
    assert.throws(() => quoteSelection(court, date, times, [], now));
  }
});

test('Không chọn ô đã bắt đầu theo thời điểm Việt Nam', () => {
  const slots = makeSlots(court, date, [], new Date('2030-05-10T16:15:00+07:00'));
  assert.equal(slots.find(slot => slot.time === '16:00').status, 'UNAVAILABLE');
  assert.equal(slots.find(slot => slot.time === '16:30').status, 'AVAILABLE');
});

test('Phân biệt lock còn hạn, booked và lock hết hạn ngay khi đọc', () => {
  const locks = [
    { slotStart: slotInstant(date, '06:00'), expiresAt: new Date(now.getTime() + 60000) },
    { slotStart: slotInstant(date, '06:30'), expiresAt: null },
    { slotStart: slotInstant(date, '07:00'), expiresAt: new Date(now.getTime() - 1) }
  ];
  const slots = makeSlots(court, date, locks, now);
  assert.equal(slots.find(slot => slot.time === '06:00').status, 'LOCKED');
  assert.equal(slots.find(slot => slot.time === '06:30').status, 'BOOKED');
  assert.equal(slots.find(slot => slot.time === '07:00').status, 'AVAILABLE');
  assert.throws(() => quoteSelection(court, date, ['06:00'], locks, now));
  assert.throws(() => quoteSelection(court, date, ['06:30'], locks, now));
});

test('Giữ chỗ đúng 10 phút tính từ thời điểm server', () => {
  assert.equal(holdExpiresAt(now).getTime() - now.getTime(), 10 * 60000);
});

test('Ngày không tồn tại và sai kiểu bị từ chối', () => {
  for (const value of ['2030-02-30', '2030-13-01', '10/05/2030', '', ['2030-05-10'], null]) {
    assert.throws(() => validateDate(value));
  }
  assert.equal(validateDate('2032-02-29'), '2032-02-29');
});

test('Giá sân cũ được đọc tương thích theo nửa giờ, không sửa đơn cũ', () => {
  const slots = makeSlots({ pricePerHour: 100000 }, date, [], now);
  assert.equal(slots[0].priceVND, 50000);
  assert.equal(slots.find(slot => slot.time === '19:00').priceVND, 50000);
});
