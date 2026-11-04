import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import { fileURLToPath } from 'node:url';

const filterError = 'Giờ kết thúc phải sau giờ bắt đầu.';
const template = fileURLToPath(new URL('../views/courts.ejs', import.meta.url));
const filters = { facilityId: 'facility-a', date: '2026-10-29', startTime: '18:00', endTime: '17:00' };

function render(locals = {}) {
  return ejs.renderFile(template, {
    title: 'Danh sách sân',
    courts: [],
    facilities: [{ _id: 'facility-a', name: 'Cơ sở A' }],
    currentUser: null,
    csrfToken: '',
    formatMoney: String,
    ...locals
  });
}

test('courts view shows one filter error and preserves the form without search results', async () => {
  const html = await render({ filters, filterError, suggestions: [], suggestionMessage: 'Thông báo gợi ý' });
  assert.equal(html.match(/class="courts-filter-error"/g)?.length, 1);
  assert.equal(html.match(/role="alert"/g)?.length, 1);
  assert.equal(html.match(/Giờ kết thúc phải sau giờ bắt đầu\./g)?.length, 1);
  assert.match(html, /<section class="courts-filter-section"[\s\S]*class="courts-filter-error"[\s\S]*<form action="\/courts"/);
  assert.match(html, /<select id="filter-facility"[^>]*autofocus aria-describedby="courts-filter-error"/);
  assert.match(html, /<option value="facility-a" selected>/);
  assert.match(html, /id="filter-date"[^>]*value="2026-10-29"/);
  assert.match(html, /id="filter-startTime"[^>]*value="18:00"/);
  assert.match(html, /id="filter-endTime"[^>]*value="17:00"/);
  assert.doesNotMatch(html, /class="(?:courts-empty|courts-count|courts-grid|court-suggestion-section)"/);
});

test('courts view with an invalid query and no retained filter values omits the empty state', async () => {
  const html = await render({ filters: {}, filterError: 'Tham số tìm kiếm không được lặp lại.' });
  assert.match(html, /Tham số tìm kiếm không được lặp lại\./);
  assert.doesNotMatch(html, /class="courts-empty"/);
});

test('courts view still shows the unfiltered empty state when there are no active courts', async () => {
  const html = await render();
  assert.match(html, /Chưa có sân đang hoạt động\./);
  assert.match(html, /class="courts-count"><strong>0<\/strong>/);
  assert.doesNotMatch(html, /role="alert"|Không tìm được sân phù hợp|\bautofocus\b/);
});

test('courts view lists courts when a valid search matches', async () => {
  const html = await render({
    courts: [{ _id: 'court-a', name: 'Sân A', basePriceVND: 50000 }],
    filters: { ...filters, endTime: '19:00' }
  });
  assert.match(html, /class="courts-count"><strong>1<\/strong>/);
  assert.match(html, /class="courts-card"/);
  assert.match(html, /href="\/courts\/court-a\?date=2026-10-29"/);
  assert.doesNotMatch(html, /role="alert"|class="(?:courts-empty|court-suggestion-section)"|\bautofocus\b/);
});
