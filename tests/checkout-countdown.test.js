import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/js/booking.js', import.meta.url), 'utf8');
const serverTime = Date.parse('2026-10-24T05:00:00.000Z');

function openCheckout({ serverNow = new Date(serverTime).toISOString(), clientNow = Date.parse('2040-01-01T00:00:00.000Z'),
  elapsed = 5000, responseStart = 1000, navigationAvailable = true } = {}) {
  let monotonicNow = elapsed;
  let clientWallClock = clientNow;
  let tick;
  const attributes = {};
  const timer = {
    dataset: { holdUntil: new Date(serverTime + 120000).toISOString(), serverNow },
    setAttribute(name, value) { attributes[name] = value; }
  };
  const paymentButton = { disabled: false };
  class ClientDate extends Date {
    static now() { return clientWallClock; }
  }
  const performance = { now: () => monotonicNow };
  if (navigationAvailable) performance.getEntriesByType = () => [{ responseStart }];
  runInNewContext(source, {
    document: {
      querySelector: () => null,
      querySelectorAll(selector) {
        if (selector === '[data-hold-until]') return [timer];
        if (selector === '[data-demo-payment]') return [paymentButton];
        return [];
      }
    },
    window: { setInterval(callback) { tick = callback; } },
    performance, Date: ClientDate, Intl
  });
  return {
    timer, paymentButton, attributes,
    advance(milliseconds) { monotonicNow += milliseconds; tick(); },
    changeClientClock(milliseconds) { clientWallClock += milliseconds; tick(); }
  };
}

test('Checkout trừ thời gian tải HTML/script khỏi thời gian giữ còn lại', () => {
  const page = openCheckout();
  assert.equal(page.timer.textContent, '01:56 còn lại');
  assert.equal(page.paymentButton.disabled, false);
});

test('Đồng hồ máy khách sai năm hoặc đổi trong lúc xem không thay hạn server', () => {
  const page = openCheckout();
  page.changeClientClock(365 * 86400000);
  assert.equal(page.timer.textContent, '01:56 còn lại');
  page.advance(30000);
  assert.equal(page.timer.textContent, '01:26 còn lại');
  page.changeClientClock(-2 * 365 * 86400000);
  assert.equal(page.timer.textContent, '01:26 còn lại');
});

test('Đúng hạn checkout khóa thanh toán và yêu cầu tải lại trạng thái đơn', () => {
  const page = openCheckout();
  page.advance(115999);
  assert.equal(page.paymentButton.disabled, false);
  page.advance(1);
  assert.equal(page.paymentButton.disabled, true);
  assert.equal(page.timer.dataset.expired, 'true');
  assert.equal(page.attributes.role, 'status');
  assert.equal(page.attributes['aria-live'], 'polite');
  assert.match(page.timer.textContent, /Tải lại để cập nhật trạng thái đơn/);
});

test('Template cũ thiếu giờ server vẫn đếm mà không trừ thời gian tải hai lần', () => {
  const page = openCheckout({ serverNow: '', clientNow: serverTime + 4000 });
  assert.equal(page.timer.textContent, '01:56 còn lại');
  page.advance(1000);
  assert.equal(page.timer.textContent, '01:55 còn lại');
});

test('Trình duyệt thiếu navigation timing vẫn đếm từ giờ server', () => {
  const page = openCheckout({ navigationAvailable: false });
  assert.equal(page.timer.textContent, '02:00 còn lại');
  page.advance(1000);
  assert.equal(page.timer.textContent, '01:59 còn lại');
});

test('Navigation timing chưa có thời điểm nhận phản hồi không làm lệch đồng hồ', () => {
  const page = openCheckout({ responseStart: 0 });
  assert.equal(page.timer.textContent, '02:00 còn lại');
  page.advance(1000);
  assert.equal(page.timer.textContent, '01:59 còn lại');
});

test('Navigation timing nằm sau lúc script chạy không kéo dài thời gian giữ', () => {
  const page = openCheckout({ responseStart: 6000 });
  assert.equal(page.timer.textContent, '02:00 còn lại');
  page.advance(1000);
  assert.equal(page.timer.textContent, '01:59 còn lại');
});

test('Hạn đã qua trong lúc tải trang khóa thanh toán ngay khi script chạy', () => {
  const page = openCheckout({ elapsed: 122000 });
  assert.equal(page.paymentButton.disabled, true);
  assert.equal(page.timer.dataset.expired, 'true');
  assert.match(page.timer.textContent, /Tải lại để cập nhật trạng thái đơn/);
});
