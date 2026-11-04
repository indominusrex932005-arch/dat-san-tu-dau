import test from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import path from 'node:path';

test('Trang danh sách hiển thị thông báo hết phương án khi gợi ý rỗng', async () => {
  const message = 'Không tìm thấy phương án thay thế phù hợp cùng thời lượng trong ngày.';
  const html = await ejs.renderFile(path.resolve('views/courts.ejs'), {
    title: 'Danh sách sân', courts: [], facilities: [], currentUser: null,
    filters: { date: '2026-11-02', startTime: '18:00', endTime: '19:00', facilityId: '' },
    filterError: null, suggestions: [], suggestionMessage: message
  });
  assert.ok(html.includes(message));
  assert.match(html, /Không tìm được sân phù hợp bộ lọc\./);
  assert.doesNotMatch(html, /role="alert"|Chưa có sân đang hoạt động/);
  assert.ok(!html.includes('class="court-suggestion-card"'));
});
