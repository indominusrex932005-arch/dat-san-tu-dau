import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleError } from '../domain/booking-rules.js';
import { searchCourts } from '../services/court-search.service.js';

test('searchCourts validate query đầu vào', async (t) => {
  await t.test('Từ chối facilityId không phải ObjectId hợp lệ', async () => {
    await assert.rejects(
      () => searchCourts({ facilityId: 'invalid-id' }),
      (err) => err instanceof RuleError && err.message.includes('Cơ sở không hợp lệ')
    );
  });

  await t.test('Từ chối khi chỉ có startTime mà không có endTime', async () => {
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: '08:00' }),
      (err) => err instanceof RuleError && err.message.includes('đầy đủ cả giờ bắt đầu và giờ kết thúc')
    );
  });

  await t.test('Từ chối khi chỉ có endTime mà không có startTime', async () => {
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', endTime: '10:00' }),
      (err) => err instanceof RuleError && err.message.includes('đầy đủ cả giờ bắt đầu và giờ kết thúc')
    );
  });

  await t.test('Từ chối khoảng giờ khi thiếu ngày', async () => {
    await assert.rejects(
      () => searchCourts({ startTime: '08:00', endTime: '10:00' }),
      (err) => err instanceof RuleError && err.message.includes('chọn ngày khi tìm theo khoảng giờ')
    );
  });

  await t.test('Từ chối giờ không đúng định dạng HH:00 hoặc HH:30', async () => {
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: '08:15', endTime: '09:00' }),
      (err) => err instanceof RuleError && err.message.includes('HH:00 hoặc HH:30')
    );
  });

  await t.test('Từ chối khi giờ kết thúc trước hoặc bằng giờ bắt đầu', async () => {
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: '10:00', endTime: '09:00' }),
      (err) => err instanceof RuleError && err.message.includes('Giờ kết thúc phải sau giờ bắt đầu')
    );
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: '10:00', endTime: '10:00' }),
      (err) => err instanceof RuleError && err.message.includes('Giờ kết thúc phải sau giờ bắt đầu')
    );
  });

  await t.test('Từ chối ngày trong quá khứ', async () => {
    const fixedNow = new Date('2026-10-23T12:00:00+07:00');
    await assert.rejects(
      () => searchCourts({ date: '2026-10-20' }, fixedNow),
      (err) => err instanceof RuleError && err.message.includes('quá khứ')
    );
  });

  await t.test('Từ chối khi tham số tìm kiếm bị lặp lại', async () => {
    await assert.rejects(
      () => searchCourts({ date: ['', '2026-10-27'] }),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );
    await assert.rejects(
      () => searchCourts({ facilityId: ['id1', 'id2'] }),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: ['08:00', '09:00'], endTime: '10:00' }),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );
    await assert.rejects(
      () => searchCourts({ date: '2026-12-01', startTime: '08:00', endTime: ['10:00', '11:00'] }),
      (err) => err instanceof RuleError && err.message.includes('lặp lại')
    );
  });
});
