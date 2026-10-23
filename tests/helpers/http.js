export class TestBrowser {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
    this.csrfToken = null;
  }

  async request(path, options = {}) {
    const headers = { ...options.headers };
    if (this.cookies.size) {
      headers.Cookie = [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
    }
    const response = await fetch(this.base + path, { ...options, headers, redirect: 'manual' });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0];
      const split = pair.indexOf('=');
      const name = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (!value || /max-age=0|expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const html = await response.text();
    const token = html.match(/name=["']_csrf["'][^>]*value=["']([a-f0-9]{64})["']/);
    if (token) this.csrfToken = token[1];
    return { status: response.status, html, location: response.headers.get('location'), headers: response.headers };
  }

  get(path) { return this.request(path); }

  post(path, fields = {}, { csrf = true } = {}) {
    const body = new URLSearchParams();
    if (csrf && this.csrfToken) body.set('_csrf', this.csrfToken);
    for (const [key, value] of Object.entries(fields)) {
      if (Array.isArray(value)) for (const item of value) body.append(key, String(item));
      else if (value !== undefined && value !== null) body.set(key, String(value));
    }
    return this.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
  }

  async login(email, password) {
    await this.get('/login');
    const result = await this.post('/login', { email, password });
    if (result.status !== 303) throw new Error(`Login failed (${result.status}) for local test fixture.`);
    await this.get(result.location);
    return result;
  }

  async hold(fields) {
    if (!this.csrfToken) await this.get('/login');
    return this.post('/bookings', fields);
  }
}

export function bookingFromLocation(location) {
  const url = new URL(location, 'http://localhost');
  const match = url.pathname.match(/^\/bookings\/([a-f\d]{24})\/checkout$/);
  if (!match) throw new Error(`Expected checkout redirect, got ${url.pathname}.`);
  return { id: match[1], token: url.searchParams.get('token') || '', checkout: url.pathname + url.search };
}
