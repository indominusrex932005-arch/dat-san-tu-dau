import { randomBytes, timingSafeEqual } from 'node:crypto';

export function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (req.method !== 'POST') return next();

  const submitted = req.body?._csrf;
  const expected = req.session.csrfToken;
  const valid = typeof submitted === 'string'
    && /^[a-f0-9]{64}$/.test(submitted)
    && typeof expected === 'string'
    && /^[a-f0-9]{64}$/.test(expected)
    && timingSafeEqual(Buffer.from(submitted, 'hex'), Buffer.from(expected, 'hex'));

  if (!valid) {
    return res.status(403).render('error', {
      title: 'Yêu cầu không hợp lệ',
      message: 'Phiên gửi form đã thay đổi. Hãy mở lại trang và thử lại.',
      backUrl: '/courts'
    });
  }

  next();
}
