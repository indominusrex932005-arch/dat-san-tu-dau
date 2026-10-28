import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';

const filterError = 'Giờ kết thúc phải sau giờ bắt đầu.';

test('courts view renders invalid filter feedback once inside the filter section', async () => {
  const html = await ejs.renderFile(fileURLToPath(new URL('../views/courts.ejs', import.meta.url)), {
    title: 'Danh sách sân',
    courts: [],
    facilities: [],
    filters: { facilityId: '', date: '2026-10-29', startTime: '18:00', endTime: '17:00' },
    filterError,
    currentUser: null,
    csrfToken: '',
    formatMoney: (value) => String(value)
  });

  assert.equal(html.match(/class="courts-filter-error"/g)?.length, 1);
  assert.equal(html.match(/role="alert"/g)?.length, 1);
  assert.equal(html.match(/Giờ kết thúc phải sau giờ bắt đầu\./g)?.length, 1);
  assert.match(html, /<section class="courts-filter-section"[\s\S]*class="courts-filter-error"[\s\S]*<form action="\/courts"/);
});
