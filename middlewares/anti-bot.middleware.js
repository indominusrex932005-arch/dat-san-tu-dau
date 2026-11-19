import { randomInt } from 'node:crypto';

const CAPTCHA_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CAPTCHA_LENGTH = 6;
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

export function getAntiBotConfig(env = process.env) {
  const turnstileSiteKey = typeof env.TURNSTILE_SITE_KEY === 'string' ? env.TURNSTILE_SITE_KEY.trim() : '';
  const turnstileSecretKey = typeof env.TURNSTILE_SECRET_KEY === 'string' ? env.TURNSTILE_SECRET_KEY.trim() : '';
  const turnstileEnabled = Boolean(turnstileSiteKey && turnstileSecretKey);
  const rawChallenge = env.AUTH_BOT_CHALLENGE;
  const isDev = env.NODE_ENV === 'development';
  const captchaEnabled = rawChallenge === 'true'
    ? true
    : rawChallenge === 'false'
      ? false
      : (!turnstileEnabled && isDev);
  return {
    turnstileSiteKey,
    turnstileSecretKey,
    turnstileEnabled,
    captchaEnabled,
    mathChallengeEnabled: captchaEnabled
  };
}

function generateCaptchaCode() {
  let code = '';
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    code += CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)];
  }
  return code;
}

export function renderCaptchaSvg(code) {
  const colors = ['#173f35', '#215445', '#2e6b54', '#1b4a3d', '#3a5a40'];
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const x1 = randomInt(0, 180);
    const y1 = randomInt(0, 54);
    const x2 = randomInt(0, 180);
    const y2 = randomInt(0, 54);
    lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9db5a6" stroke-width="1.2" opacity="0.7"/>`);
  }
  const dots = [];
  for (let i = 0; i < 24; i++) {
    const cx = randomInt(6, 174);
    const cy = randomInt(6, 48);
    dots.push(`<circle cx="${cx}" cy="${cy}" r="1.2" fill="#7c9a87" opacity="0.65"/>`);
  }
  const chars = [...String(code)].map((ch, idx) => {
    const x = 18 + idx * 25 + randomInt(-2, 3);
    const y = 36 + randomInt(-4, 5);
    const rotate = randomInt(-18, 19);
    const color = colors[randomInt(0, colors.length)];
    return `<text x="${x}" y="${y}" fill="${color}" font-family="Georgia, 'Times New Roman', monospace" font-size="25" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${ch}</text>`;
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="54" viewBox="0 0 180 54" role="img" aria-label="Mã CAPTCHA">',
    '<rect width="180" height="54" rx="7" fill="#eef4ef"/>',
    ...lines,
    ...dots,
    ...chars,
    '</svg>'
  ].join('');
}

export function prepareBotCheck(req, res, { forceNew = false, env = process.env } = {}) {
  const config = getAntiBotConfig(env);
  res.locals.turnstileSiteKey = config.turnstileEnabled ? config.turnstileSiteKey : '';
  if (config.captchaEnabled && req.session) {
    const existing = req.session.botChallenge;
    const expired = !existing?.answer || !existing?.expiresAt || existing.expiresAt <= Date.now();
    if (forceNew || expired) {
      const code = generateCaptchaCode();
      req.session.botChallenge = { answer: code, expiresAt: Date.now() + CAPTCHA_TTL_MS };
    }
    res.locals.captchaEnabled = true;
    res.locals.captchaStamp = Date.now();
  } else {
    res.locals.captchaEnabled = false;
    res.locals.captchaStamp = '';
  }
}

export function serveCaptchaImage(req, res) {
  const config = getAntiBotConfig();
  if (!config.captchaEnabled || !req.session) return res.sendStatus(404);
  const forceNew = req.query?.refresh === '1';
  const existing = req.session.botChallenge;
  const expired = !existing?.answer || !existing?.expiresAt || existing.expiresAt <= Date.now();
  if (forceNew || expired) {
    const code = generateCaptchaCode();
    req.session.botChallenge = { answer: code, expiresAt: Date.now() + CAPTCHA_TTL_MS };
  }
  const svg = renderCaptchaSvg(req.session.botChallenge.answer);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.send(svg);
}

export async function verifyBotCheck(req, { fetchImpl = globalThis.fetch, env = process.env } = {}) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (body.website !== undefined) {
    if (typeof body.website !== 'string' || body.website.trim() !== '') {
      return { ok: false, reason: 'HONEYPOT', message: 'Yêu cầu không hợp lệ. Vui lòng thử lại.' };
    }
  }

  const config = getAntiBotConfig(env);

  if (config.turnstileEnabled) {
    const token = typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'].trim() : '';
    if (!token || token.length > 2048) {
      return {
        ok: false,
        reason: 'TURNSTILE_MISSING',
        message: 'Vui lòng hoàn thành bước xác minh CAPTCHA.'
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const params = new URLSearchParams({
        secret: config.turnstileSecretKey,
        response: token
      });
      if (req.ip) params.set('remoteip', req.ip);
      const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: controller.signal
      });
      if (!response.ok) {
        return {
          ok: false,
          reason: 'TURNSTILE_ERROR',
          message: 'Không thể xác minh CAPTCHA lúc này. Vui lòng thử lại.'
        };
      }
      const data = await response.json();
      if (!data?.success) {
        return {
          ok: false,
          reason: 'TURNSTILE_FAILED',
          message: 'Xác minh CAPTCHA chưa thành công. Vui lòng thử lại.'
        };
      }
    } catch {
      return {
        ok: false,
        reason: 'TURNSTILE_ERROR',
        message: 'Không thể xác minh CAPTCHA lúc này. Vui lòng thử lại.'
      };
    } finally {
      clearTimeout(timer);
    }
  }

  if (config.captchaEnabled) {
    const challenge = req.session?.botChallenge;
    if (req.session) delete req.session.botChallenge;
    const expected = typeof challenge?.answer === 'string' ? challenge.answer.toUpperCase() : '';
    const notExpired = Boolean(challenge?.expiresAt && challenge.expiresAt > Date.now());
    const submitted = typeof body.botAnswer === 'string' ? body.botAnswer.trim().toUpperCase() : '';
    if (!expected || !notExpired || submitted !== expected) {
      return {
        ok: false,
        reason: 'CHALLENGE_FAILED',
        message: 'Mã CAPTCHA chưa đúng hoặc đã hết hạn. Vui lòng nhập lại mã mới.'
      };
    }
  }

  return { ok: true };
}
