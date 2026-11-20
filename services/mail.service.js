import tls from 'node:tls';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Strip CR/LF and control characters to prevent email header injection.
function sanitizeHeader(value, maxLength = 254) {
  return [...String(value ?? '')]
    .filter(ch => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('')
    .trim()
    .slice(0, maxLength);
}

function encodeMimeHeader(value) {
  const safe = sanitizeHeader(value, 200);
  return /^[\x20-\x7E]*$/.test(safe)
    ? safe
    : `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

function buildMimeMessage({ from, to, subject, text, html }) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const body = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(String(text || ''), 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(String(html || ''), 'utf8').toString('base64'),
    `--${boundary}--`,
    ''
  ].join('\r\n');
  return body.replace(/^\./gm, '..');
}

// Minimal TLS SMTP client for Gmail App Password (smtp.gmail.com:465) with zero external dependencies.
function sendViaGmailSmtp({ user, pass, to, subject, text, html, timeoutMs = 10000 }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
    socket.setEncoding('utf8');
    let buffer = '';
    let settled = false;
    let resolver = null;

    const done = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    };

    const timer = setTimeout(() => done(new Error('SMTP_TIMEOUT')), timeoutMs);

    const readReply = () => new Promise((res, rej) => {
      resolver = { res, rej };
      flush();
    });

    const flush = () => {
      if (!resolver) return;
      const lines = buffer.split('\r\n');
      if (lines.length < 2) return;
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (/^\d{3} /.test(line)) {
          const code = Number(line.slice(0, 3));
          const full = lines.slice(0, i + 1).join('\n');
          buffer = lines.slice(i + 1).join('\r\n');
          const current = resolver;
          resolver = null;
          current.res({ code, text: full });
          return;
        }
      }
    };

    socket.on('data', chunk => {
      buffer += chunk;
      flush();
    });
    socket.on('error', err => done(err));

    const sendCommand = async (cmd, expectedCodes) => {
      socket.write(`${cmd}\r\n`);
      const reply = await readReply();
      if (!expectedCodes.includes(reply.code)) {
        throw new Error(`SMTP_${reply.code}`);
      }
      return reply;
    };

    (async () => {
      try {
        const greeting = await readReply();
        if (greeting.code !== 220) throw new Error(`SMTP_${greeting.code}`);
        await sendCommand('EHLO localhost', [250]);
        await sendCommand('AUTH LOGIN', [334]);
        await sendCommand(Buffer.from(user, 'utf8').toString('base64'), [334]);
        await sendCommand(Buffer.from(pass, 'utf8').toString('base64'), [235]);
        await sendCommand(`MAIL FROM:<${user}>`, [250]);
        await sendCommand(`RCPT TO:<${to}>`, [250, 251]);
        await sendCommand('DATA', [354]);
        const mime = buildMimeMessage({ from: `SanXanh <${user}>`, to, subject, text, html });
        socket.write(`${mime}\r\n.\r\n`);
        const dataReply = await readReply();
        if (dataReply.code !== 250) throw new Error(`SMTP_${dataReply.code}`);
        await sendCommand('QUIT', [221]).catch(() => {});
        done(null, { delivered: true, preview: false, provider: 'gmail' });
      } catch (err) {
        done(err);
      }
    })();
  });
}

export function createMailService({
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.MAIL_FROM,
  gmailUser = process.env.GMAIL_USER,
  gmailAppPassword = process.env.GMAIL_APP_PASSWORD,
  fetchImpl = globalThis.fetch,
  smtpSender = sendViaGmailSmtp
} = {}) {
  const cleanGmailUser = sanitizeHeader(gmailUser, 254);
  const cleanGmailPass = typeof gmailAppPassword === 'string' ? gmailAppPassword.replace(/\s+/g, '') : '';
  const gmailConfigured = Boolean(
    cleanGmailUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanGmailUser) && cleanGmailPass.length >= 8
  );

  const cleanResendKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  const cleanFrom = sanitizeHeader(from, 254) || (cleanResendKey ? 'onboarding@resend.dev' : '');
  const resendConfigured = Boolean(cleanResendKey && cleanFrom);

  const configured = gmailConfigured || resendConfigured;

  async function sendMail({ to, subject, text, html }) {
    const safeTo = sanitizeHeader(to, 254);
    const safeSubject = sanitizeHeader(subject, 200);
    if (!safeTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTo)) {
      return { delivered: false, preview: false };
    }
    if (!configured) {
      if (process.env.NODE_ENV !== 'test') {
        console.info(`[MAIL PREVIEW] To: ${safeTo} | Subject: ${safeSubject}\n${text}`);
      }
      return { delivered: false, preview: true };
    }

    if (gmailConfigured) {
      try {
        return await smtpSender({
          user: cleanGmailUser,
          pass: cleanGmailPass,
          to: safeTo,
          subject: safeSubject,
          text,
          html
        });
      } catch (error) {
        console.error('Không thể gửi email qua Gmail SMTP:', error.message || error.name);
        return { delivered: false, preview: false, provider: 'gmail' };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanResendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: cleanFrom, to: [safeTo], subject: safeSubject, text, html }),
        signal: controller.signal
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.error(`Không thể gửi email qua Resend (${response.status}):`, detail.slice(0, 200));
        return { delivered: false, preview: false, status: response.status, provider: 'resend' };
      }
      return { delivered: true, preview: false, provider: 'resend' };
    } catch (error) {
      console.error('Lỗi khi gửi email qua Resend:', error.name);
      return { delivered: false, preview: false, provider: 'resend' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    isConfigured: () => configured,
    sendMail,
    sendEmailVerification({ to, fullName, verifyUrl, expiresMinutes = 30 }) {
      const name = fullName || 'bạn';
      const subject = 'Xác nhận địa chỉ email | SanXanh';
      const text = [
        `Xin chào ${name},`,
        '',
        'Cảm ơn bạn đã đăng ký tài khoản tại SanXanh.',
        `Mở đường dẫn sau trong vòng ${expiresMinutes} phút để xác nhận email của bạn:`,
        verifyUrl,
        '',
        'Nếu bạn không tạo tài khoản này, hãy bỏ qua email.'
      ].join('\n');
      const html = `
        <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại SanXanh.</p>
        <p><a href="${escapeHtml(verifyUrl)}">Xác nhận địa chỉ email</a> (có hiệu lực trong ${expiresMinutes} phút).</p>
        <p>Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.</p>
      `.trim();
      return sendMail({ to, subject, text, html });
    },
    sendPasswordReset({ to, fullName, resetUrl, expiresMinutes = 15 }) {
      const name = fullName || 'bạn';
      const subject = 'Đặt lại mật khẩu | SanXanh';
      const text = [
        `Xin chào ${name},`,
        '',
        'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.',
        `Mở đường dẫn sau trong vòng ${expiresMinutes} phút để đặt mật khẩu mới:`,
        resetUrl,
        '',
        'Nếu bạn không yêu cầu, hãy bỏ qua email này.'
      ].join('\n');
      const html = `
        <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
        <p><a href="${escapeHtml(resetUrl)}">Đặt lại mật khẩu mới</a> (có hiệu lực trong ${expiresMinutes} phút).</p>
        <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      `.trim();
      return sendMail({ to, subject, text, html });
    },
    sendLoginOtp({ to, fullName, code, expiresMinutes = 5 }) {
      const name = fullName || 'bạn';
      const subject = `Mã xác nhận đăng nhập: ${code} | SanXanh`;
      const text = [
        `Xin chào ${name},`,
        '',
        `Mã xác nhận đăng nhập của bạn là: ${code}`,
        `Mã có hiệu lực trong ${expiresMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.`,
        '',
        'Nếu không phải bạn đang đăng nhập, hãy đổi mật khẩu ngay.'
      ].join('\n');
      const html = `
        <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
        <p>Mã xác nhận đăng nhập của bạn là:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${escapeHtml(code)}</p>
        <p>Mã có hiệu lực trong ${expiresMinutes} phút. Không chia sẻ mã này cho bất kỳ ai.</p>
      `.trim();
      return sendMail({ to, subject, text, html });
    },
    sendLoginAlert({ to, fullName, timeText, ip, userAgent, forgotUrl }) {
      const name = fullName || 'bạn';
      const subject = 'Thông báo đăng nhập mới | SanXanh';
      const text = [
        `Xin chào ${name},`,
        '',
        'Tài khoản SanXanh của bạn vừa được đăng nhập:',
        `- Thời gian: ${timeText}`,
        `- Địa chỉ IP: ${ip || 'Không xác định'}`,
        `- Thiết bị: ${userAgent || 'Không xác định'}`,
        '',
        `Nếu không phải bạn, hãy đặt lại mật khẩu ngay tại: ${forgotUrl}`
      ].join('\n');
      const html = `
        <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
        <p>Tài khoản SanXanh của bạn vừa được đăng nhập:</p>
        <ul>
          <li><strong>Thời gian:</strong> ${escapeHtml(timeText)}</li>
          <li><strong>Địa chỉ IP:</strong> ${escapeHtml(ip || 'Không xác định')}</li>
          <li><strong>Thiết bị:</strong> ${escapeHtml(userAgent || 'Không xác định')}</li>
        </ul>
        <p>Nếu không phải bạn, hãy <a href="${escapeHtml(forgotUrl)}">đặt lại mật khẩu ngay</a>.</p>
      `.trim();
      return sendMail({ to, subject, text, html });
    }
  };
}
