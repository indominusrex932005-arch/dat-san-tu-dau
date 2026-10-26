import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';
import { formatDate, formatMoney } from '../utils/booking-time.js';

test('Court Suggestions View (Issue #65)', async (suite) => {
  const viewsDir = path.resolve('views');
  const courtsEjs = await readFile(path.join(viewsDir, 'courts.ejs'), 'utf8');
  const suggestionsPartialEjs = await readFile(path.join(viewsDir, 'partials', 'court-suggestions.ejs'), 'utf8');

  const baseLocals = {
    title: 'Danh sách sân',
    courts: [],
    facilities: [
      { _id: '654321654321654321654321', name: 'Cơ sở Quận 1' }
    ],
    filters: {
      facilityId: '654321654321654321654321',
      date: '2026-11-05',
      startTime: '18:00',
      endTime: '19:00'
    },
    filterError: null,
    formatDate,
    formatMoney,
    currentUser: null
  };

  const sampleSuggestions = [
    {
      courtId: '111111111111111111111111',
      courtName: 'Sân 1 - Q1',
      facilityName: 'Cơ sở Quận 1',
      date: '2026-11-05',
      startTime: '19:00',
      endTime: '20:00',
      totalMinutes: 60,
      totalPriceVND: 160000,
      startOffsetMinutes: 60,
      reason: 'Cùng cơ sở, muộn hơn 60 phút'
    },
    {
      courtId: '222222222222222222222222',
      courtName: 'Sân 2 - Q1 & Tên Rất Dài '.repeat(3),
      facilityName: 'Cơ sở Quận 1',
      date: '2026-11-05',
      startTime: '17:00',
      endTime: '18:00',
      totalMinutes: 60,
      totalPriceVND: 140000,
      startOffsetMinutes: -60,
      reason: 'Cùng cơ sở, sớm hơn 60 phút'
    },
    {
      courtId: '333333333333333333333333',
      courtName: 'Sân 3 - Q1',
      facilityName: 'Cơ sở Quận 1',
      date: '2026-11-05',
      startTime: '20:00',
      endTime: '21:00',
      totalMinutes: 60,
      totalPriceVND: 160000,
      startOffsetMinutes: 120,
      reason: 'Cùng cơ sở, muộn hơn 120 phút'
    }
  ];

  await suite.test('CSS court-suggestions.css được liên kết trong views/courts.ejs', () => {
    assert.match(courtsEjs, /<link rel="stylesheet" href="\/assets\/css\/court-suggestions\.css">/);
  });

  await suite.test('Render đúng 3 thẻ gợi ý với thông tin đầy đủ, giá server và link Xem lịch', () => {
    const html = ejs.render(suggestionsPartialEjs, {
      suggestions: sampleSuggestions,
      suggestionMessage: 'Khung giờ bạn tìm hiện đã kín. Dưới đây là các gợi ý thay thế gần nhất cùng thời lượng:',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    // Header và thông điệp
    assert.match(html, /class="court-suggestion-title"/);
    assert.match(html, /Phương án thay thế gần nhất/);
    assert.match(html, /Khung giờ bạn tìm hiện đã kín/);
    assert.match(html, /Lịch sân có thể thay đổi theo thời gian thực/);

    // 3 thẻ
    const cardMatches = html.match(/class="court-suggestion-card"/g);
    assert.equal(cardMatches?.length, 3);

    // Thẻ 1
    assert.match(html, /Sân 1 - Q1/);
    assert.match(html, /Cùng cơ sở, muộn hơn 60 phút/);
    assert.match(html, /19:00 – 20:00/);
    assert.match(html, /60 phút/);
    assert.match(html, /160\.000/); // formatMoney(160000)
    assert.match(html, /Tổng giá phương án/);
    // Không ghi nhãn "mỗi giờ" cho tổng giá
    assert.doesNotMatch(html, /giá mỗi giờ/i);

    // Link Xem lịch
    assert.match(html, /href="\/courts\/111111111111111111111111\?date=2026-11-05"/);
    assert.match(html, /<span>Xem lịch<\/span>/);
    // Không dùng chữ gây hiểu lầm là đã đặt thành công
    assert.doesNotMatch(html, /đã đặt thành công/i);
  });

  await suite.test('Tối đa chỉ render 3 thẻ ngay cả khi backend truyền nhiều hơn 3', () => {
    const extraSuggestions = [
      ...sampleSuggestions,
      {
        courtId: '444444444444444444444444',
        courtName: 'Sân 4 thừa',
        facilityName: 'Cơ sở Quận 1',
        date: '2026-11-05',
        startTime: '21:00',
        endTime: '22:00',
        totalMinutes: 60,
        totalPriceVND: 160000,
        startOffsetMinutes: 180,
        reason: 'Cùng cơ sở, muộn hơn 180 phút'
      }
    ];

    const html = ejs.render(suggestionsPartialEjs, {
      suggestions: extraSuggestions,
      suggestionMessage: 'Gợi ý',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    const cardMatches = html.match(/class="court-suggestion-card"/g);
    assert.equal(cardMatches?.length, 3);
    assert.doesNotMatch(html, /Sân 4 thừa/);
  });

  await suite.test('Khi 0 gợi ý: hiển thị thông báo mời đổi ngày/khoảng giờ, không vỡ layout', () => {
    const emptyMessage = 'Không tìm thấy phương án thay thế phù hợp cùng thời lượng trong ngày. Bạn vui lòng đổi ngày hoặc chọn khoảng giờ khác.';
    const html = ejs.render(suggestionsPartialEjs, {
      suggestions: [],
      suggestionMessage: emptyMessage,
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    assert.match(html, /class="court-suggestion-message"/);
    assert.match(html, /Không tìm thấy phương án thay thế/);
    // Không có card nào
    assert.doesNotMatch(html, /class="court-suggestion-card"/);
  });

  await suite.test('Tích hợp trong views/courts.ejs: chỉ hiện gợi ý khi không có kết quả chính và có đủ ngày/khoảng giờ', () => {
    // 1. Trường hợp có kết quả chính (courts.length > 0) -> không hiện gợi ý
    const htmlWithCourts = ejs.render(courtsEjs, {
      ...baseLocals,
      courts: [
        {
          _id: '111111111111111111111111',
          name: 'Sân 1',
          openTime: '06:00',
          closeTime: '22:00',
          facility: { name: 'Cơ sở 1', owner: { ownerStatus: 'APPROVED' }, phone: '0901234567' }
        }
      ],
      suggestions: sampleSuggestions,
      suggestionMessage: 'Có gợi ý'
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.doesNotMatch(htmlWithCourts, /court-suggestion-section/);

    // 2. Trường hợp courts.length === 0 và có filter ngày + khoảng giờ -> có hiện gợi ý
    const htmlEmptyWithFilter = ejs.render(courtsEjs, {
      ...baseLocals,
      courts: [],
      suggestions: sampleSuggestions,
      suggestionMessage: 'Khung giờ kín'
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.match(htmlEmptyWithFilter, /court-suggestion-section/);
    assert.match(htmlEmptyWithFilter, /court-suggestion-card/);

    // 3. Trường hợp có filterError -> không hiện gợi ý
    const htmlWithError = ejs.render(courtsEjs, {
      ...baseLocals,
      courts: [],
      filterError: 'Giờ kết thúc phải sau giờ bắt đầu.',
      suggestions: sampleSuggestions,
      suggestionMessage: 'Khung giờ kín'
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.doesNotMatch(htmlWithError, /court-suggestion-section/);

    // 4. Trường hợp thiếu startTime / endTime -> không hiện gợi ý
    const htmlMissingTime = ejs.render(courtsEjs, {
      ...baseLocals,
      courts: [],
      filters: {
        facilityId: '',
        date: '2026-11-05',
        startTime: '',
        endTime: ''
      },
      suggestions: [],
      suggestionMessage: null
    }, { filename: path.join(viewsDir, 'courts.ejs') });

    assert.doesNotMatch(htmlMissingTime, /court-suggestion-section/);
  });

  await suite.test('Tên cơ sở và sân dài hoặc ký tự đặc biệt được escape an toàn', () => {
    const xssSuggestions = [
      {
        courtId: '111111111111111111111111',
        courtName: 'Sân <script>alert("XSS")</script>',
        facilityName: 'Cơ sở & <img src=x onerror=alert(1)>',
        date: '2026-11-05',
        startTime: '19:00',
        endTime: '20:00',
        totalMinutes: 60,
        totalPriceVND: 160000,
        startOffsetMinutes: 60,
        reason: 'Cùng cơ sở, muộn hơn 60 phút'
      }
    ];

    const html = ejs.render(suggestionsPartialEjs, {
      suggestions: xssSuggestions,
      suggestionMessage: 'Gợi ý',
      formatDate,
      formatMoney
    }, { filename: path.join(viewsDir, 'partials', 'court-suggestions.ejs') });

    // Không chứa tag thực thi thô
    assert.doesNotMatch(html, /<script>alert\("XSS"\)<\/script>/);
    assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
    // Được escape
    assert.match(html, /&lt;script&gt;alert\(&#34;XSS&#34;\)&lt;\/script&gt;/);
  });
});
