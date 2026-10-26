import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const script = await readFile(new URL('../public/js/booking.js', import.meta.url), 'utf8');
const origin = 'http://127.0.0.1:3000';
const calendarUrl = `${origin}/courts/012345678901234567890123?date=2030-06-01`;

// Only the DOM surface exercised by the booking form is implemented here.
// Server HTML/escaping and real browser navigation have separate coverage.
class Element {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.value = '';
    this.disabled = false;
    this.text = '';
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  prepend(child) { this.children.unshift(child); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  focus() { this.focused = true; }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  async emit(type) {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    await Promise.all((this.listeners.get(type) || []).map(handler => handler(event)));
    return event;
  }
}

function pageFixture({ recovery = false, error = false, times, guestName = 'Khách kiểm thử', guestPhone = '0900000000' } = {}) {
  const summary = new Element();
  const total = new Element();
  const chips = new Element();
  const submit = new Element();
  const datePicker = Object.assign(new Element(), { value: '2030-06-01' });
  const date = Object.assign(new Element(), { value: '2030-06-01' });
  const inputs = (times || [{ value: '12:00', price: 50000, checked: true }]).map(slot => Object.assign(new Element(), {
    value: slot.value, checked: slot.checked ?? false, disabled: slot.disabled ?? false,
    dataset: { price: String(slot.price), end: slot.end || '12:30' }
  }));
  const form = error ? null : new Element();
  const errorNode = recovery || error ? new Element() : null;
  if (errorNode) errorNode.textContent = error ? 'Server từ chối yêu cầu.' : 'Chưa giữ được sân. Lịch đã cập nhật.';
  const main = new Element();
  const nodes = new Map([
    ['#slot-booking-form', form], ['#selection-summary', summary], ['#selection-total', total],
    ['#selected-slots', chips], ['#hold-slots', submit], ['#date', datePicker]
  ]);
  const page = { form, summary, total, chips, submit, datePicker, inputs, main, errorNode, nodes, title: error ? 'Lỗi máy chủ' : 'Đặt sân' };
  main.page = page;
  main.querySelector = selector => selector === '#booking-form-error, [role="alert"]' ? errorNode : null;
  page.querySelector = selector => selector === 'main' ? main
    : selector === '#slot-booking-form[data-booking-form-error="true"]' && recovery ? form : null;
  if (form) {
    form.action = `${origin}/bookings`;
    form.dataset = { recoveryUrl: calendarUrl, bookingFormError: String(recovery) };
    form.values = { _csrf: 'test-csrf', courtId: '012345678901234567890123', date: date.value, guestName, guestPhone };
    form.isConnected = true;
    form.closest = selector => selector === 'main' ? main : null;
    form.querySelectorAll = selector => selector === 'input[name="times"]:checked:not(:disabled)'
      ? inputs.filter(input => input.checked && !input.disabled) : [];
    form.querySelector = selector => selector === 'input[name="date"]' ? date
      : selector === '.booking-submit-notice' ? form.children.find(child => child.className?.includes('booking-submit-notice')) || null
        : form.querySelectorAll(selector)[0] || null;
  }
  return page;
}

function browserHarness({ initial = pageFixture(), fetch, parsedPage } = {}) {
  const calls = [];
  const navigation = [];
  const history = [];
  const pageshow = new Element();
  const document = {
    current: initial, title: initial.title,
    querySelector(selector) { return this.current.nodes.get(selector) || null; },
    querySelectorAll() { return []; },
    createElement() { return new Element(); },
    createTextNode(value) { const node = new Element(); node.textContent = value; return node; }
  };
  function mount(page) {
    page.main.replaceWith = replacement => {
      if (document.current.form) document.current.form.isConnected = false;
      document.current = replacement.page;
      mount(document.current);
    };
  }
  mount(initial);
  class FormData {
    constructor(form) {
      this.entries = [...Object.entries(form.values), ...form.querySelectorAll('input[name="times"]:checked:not(:disabled)').map(input => ['times', input.value])];
    }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  class DOMParser {
    parseFromString() {
      if (!parsedPage) throw new Error('Response could not be parsed.');
      return parsedPage;
    }
  }
  const window = {
    location: { href: calendarUrl, origin, assign(url) { navigation.push(url); } },
    history: { replaceState(_state, _title, url) { history.push(url); window.location.href = url; } },
    fetch(...args) { calls.push(args); return fetch(...args); }, DOMParser,
    addEventListener(type, handler) { pageshow.addEventListener(type, handler); },
    setInterval() { throw new Error('No checkout timer should be started by this page.'); }
  };
  vm.runInNewContext(script, { document, window, URL, URLSearchParams, FormData, DOMParser, Intl }, { filename: 'public/js/booking.js' });
  return { document, calls, navigation, history, pageshow };
}

function response(status, overrides = {}) {
  return {
    status, ok: status >= 200 && status < 300, redirected: false, url: `${origin}/bookings`,
    headers: new Map([['content-type', 'text/html; charset=utf-8']]),
    async text() { return 'Synthetic server response; DOM supplied by parser fixture.'; }, ...overrides
  };
}

test('Một POST đang chờ không bị gửi lần hai; request giữ CSRF và các ô đã chọn', async () => {
  let resolve;
  const waiting = new Promise(done => { resolve = done; });
  const page = pageFixture();
  const browser = browserHarness({ initial: page, fetch: () => waiting });
  const first = page.form.emit('submit');
  await page.form.emit('submit');
  assert.equal(browser.calls.length, 1);
  assert.equal(page.submit.disabled, true);
  assert.equal(browser.calls[0][1].method, 'POST');
  assert.equal(browser.calls[0][1].body.get('_csrf'), 'test-csrf');
  assert.deepEqual(browser.calls[0][1].body.getAll('times'), ['12:00']);
  resolve(response(200, { redirected: true, url: `${origin}/bookings/booking-id/checkout` }));
  await first;
  assert.equal(browser.calls.length, 1);
});

test('Mất kết nối giữ dữ liệu và báo kết quả chưa xác nhận, không tự POST lại', async () => {
  const page = pageFixture({ guestName: 'Tên đã nhập', guestPhone: '0912345678' });
  const browser = browserHarness({ initial: page, fetch: async () => { throw new Error('Network lost after sending.'); } });
  await page.form.emit('submit');
  const notice = page.form.querySelector('.booking-submit-notice');
  assert.equal(browser.document.current, page);
  assert.equal(page.form.values.guestName, 'Tên đã nhập');
  assert.equal(page.form.values.guestPhone, '0912345678');
  assert.equal(page.inputs[0].checked, true);
  assert.match(notice.textContent, /Chưa xác nhận/);
  assert.match(notice.textContent, /có thể đã được xử lý/);
  assert.equal(notice.children.at(-1).href, calendarUrl);
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.navigation.length, 0);
  assert.equal(page.submit.disabled, false);
});

test('Phản hồi không phân tích được không làm mất form hoặc tự gửi lại', async () => {
  const page = pageFixture();
  const browser = browserHarness({ initial: page, fetch: async () => response(409) });
  await page.form.emit('submit');
  assert.equal(browser.document.current, page);
  assert.equal(page.inputs[0].checked, true);
  assert.ok(page.form.querySelector('.booking-submit-notice'));
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.history.length, 0);
});

for (const status of [400, 409]) {
  test(`${status}: dùng lịch/giá mới, khởi tạo form phục hồi và giữ history tại GET lịch`, async () => {
    const initial = pageFixture();
    const recovered = pageFixture({ recovery: true, guestName: 'Giữ tên', times: [
      { value: '12:00', price: 99000, checked: true, disabled: true },
      { value: '13:00', price: 75000, checked: true, end: '13:30' }
    ] });
    const browser = browserHarness({ initial, fetch: async () => response(status), parsedPage: recovered });
    await initial.form.emit('submit');
    assert.equal(browser.document.current, recovered);
    assert.equal(initial.form.isConnected, false);
    assert.deepEqual(browser.history, [calendarUrl]);
    assert.equal(recovered.summary.textContent, '1 ô · 30 phút');
    assert.equal(recovered.total.textContent, new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(75000));
    assert.equal(recovered.chips.textContent, '13:00–13:30');
    assert.equal(recovered.errorNode.focused, true);
    assert.equal(recovered.submit.disabled, false);
    assert.equal(recovered.form.listeners.get('submit').length, 1);
    recovered.inputs[1].checked = false;
    await recovered.form.emit('change');
    assert.equal(recovered.submit.disabled, true);
    assert.equal(recovered.total.textContent, '—');
    assert.equal(browser.calls.length, 1);
  });
}

test('403/500 hiển thị lỗi server, không biến lỗi thành lịch trống hoặc form phục hồi', async () => {
  for (const status of [403, 500]) {
    const initial = pageFixture();
    const errorPage = pageFixture({ error: true });
    const browser = browserHarness({ initial, fetch: async () => response(status), parsedPage: errorPage });
    await initial.form.emit('submit');
    assert.equal(browser.document.current, errorPage);
    assert.equal(browser.document.querySelector('#slot-booking-form'), null);
    assert.equal(errorPage.errorNode.focused, true);
    assert.equal(browser.document.title, 'Lỗi máy chủ');
    assert.equal(browser.history.length, 0);
    assert.equal(browser.calls.length, 1);
  }
});

test('303 đã theo redirect chuyển tới checkout và không gửi thêm POST', async () => {
  const page = pageFixture();
  const checkout = `${origin}/bookings/new-booking/checkout?token=synthetic-test-token`;
  const browser = browserHarness({ initial: page, fetch: async () => response(200, { redirected: true, url: checkout }) });
  await page.form.emit('submit');
  assert.deepEqual(browser.navigation, [checkout]);
  assert.equal(browser.calls.length, 1);
  assert.equal(browser.history.length, 0);
});

test('pageshow cập nhật checkbox được khôi phục, không nhân đôi handler hoặc POST', async () => {
  const page = pageFixture();
  const browser = browserHarness({ initial: page, fetch: async () => response(200, { redirected: true, url: `${origin}/bookings/new-booking/checkout` }) });
  page.inputs[0].checked = false;
  await browser.pageshow.emit('pageshow');
  await browser.pageshow.emit('pageshow');
  assert.equal(page.summary.textContent, 'Chưa chọn ô giờ.');
  assert.equal(page.submit.disabled, true);
  assert.equal(page.form.listeners.get('submit').length, 1);
  assert.equal(page.form.listeners.get('change').length, 1);
  assert.equal(page.datePicker.listeners.get('change').length, 1);
  assert.equal(browser.pageshow.listeners.get('pageshow').length, 1);
  assert.equal(browser.calls.length, 0);
  page.inputs[0].checked = true;
  await browser.pageshow.emit('pageshow');
  assert.equal(page.submit.disabled, false);
  await page.form.emit('submit');
  assert.equal(browser.calls.length, 1);
});
