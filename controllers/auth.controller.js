import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { claimGuestHold, getBookingForViewer } from '../services/booking.service.js';
import { createMailService } from '../services/mail.service.js';
import { prepareBotCheck, verifyBotCheck } from '../middlewares/anti-bot.middleware.js';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Pre-computed bcrypt (cost 12) hash so non-existent emails spend comparable time in bcrypt.compare.
const DUMMY_PASSWORD_HASH = '$2b$12$Rt4usad3DuWsPwsEOniAS.Ft0pbKIX2Kx1pdgbSh4TLCK/fbY1HUW';
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 30 * 60 * 1000;
const LOGIN_OTP_TTL_MS = 5 * 60 * 1000;
const LOGIN_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_LOGIN_OTP_ATTEMPTS = 5;

const defaultMailService = createMailService();

function getMailService(req) {
  return req.mailService || defaultMailService;
}

function loginEmailVerifyMode() {
  const raw = process.env.LOGIN_EMAIL_VERIFY;
  if (raw === 'off' || raw === 'notify' || raw === 'otp') return raw;
  return process.env.NODE_ENV === 'development' ? 'otp' : 'off';
}

// HMAC-SHA256 keyed with server SESSION_SECRET so short OTPs/tokens cannot be cracked offline from DB dumps.
function hashSecret(value) {
  const pepper = process.env.SESSION_SECRET || 'test-only-hmac-pepper';
  return createHmac('sha256', pepper).update(String(value)).digest('hex');
}

function hashesMatch(leftHex, rightHex) {
  if (typeof leftHex !== 'string' || typeof rightHex !== 'string'
      || !/^[a-f0-9]{64}$/.test(leftHex) || !/^[a-f0-9]{64}$/.test(rightHex)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(leftHex, 'hex'), Buffer.from(rightHex, 'hex'));
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function resolveBaseUrl(req) {
  const configured = typeof process.env.APP_BASE_URL === 'string'
    ? process.env.APP_BASE_URL.trim().replace(/\/+$/, '') : '';
  if (configured) return configured;
  const host = req.get?.('host') || 'localhost:3000';
  return `${req.protocol || 'http'}://${host}`;
}

function formatVietnamDateTime(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
    hourCycle: 'h23'
  }).format(date);
}

function destination(user) {
  if (user?.role === 'ADMIN') return '/admin';
  if (user?.role === 'OWNER') return '/owner';
  return '/courts';
}

function formValues(body, accountType) {
  const string = name => typeof body[name] === 'string' ? body[name].trim() : '';
  return {
    accountType,
    fullName: string('fullName'),
    email: string('email').toLowerCase(),
    phone: string('phone'),
    requestedFacilityName: string('requestedFacilityName'),
    requestedFacilityAddress: string('requestedFacilityAddress')
  };
}

function showRegistration(req, res, accountType) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  prepareBotCheck(req, res);
  res.render('register', {
    title: accountType === 'OWNER' ? 'Đăng ký chủ sân' : 'Đăng ký tài khoản',
    ...formValues({}, accountType), errorMessage: null
  });
}

export function showLoginForm(req, res) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  prepareBotCheck(req, res);
  let successMessage = null;
  if (req.session?.loginSuccessMessage) {
    successMessage = req.session.loginSuccessMessage;
    delete req.session.loginSuccessMessage;
  } else if (req.query?.reset === '1') {
    successMessage = 'Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.';
  } else if (req.query?.verified === '1') {
    successMessage = 'Địa chỉ email của bạn đã được xác nhận. Bạn có thể đăng nhập ngay.';
  }
  res.render('login', { title: 'Đăng nhập', errorMessage: null, successMessage, email: '' });
}

export function showRegisterForm(req, res) {
  return showRegistration(req, res, 'CUSTOMER');
}

export function showOwnerRegisterForm(req, res) {
  return showRegistration(req, res, 'OWNER');
}

async function registerAccount(req, res, accountType) {
  if (req.currentUser) return res.redirect(303, destination(req.currentUser));
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body : {};
  const values = formValues(body, accountType);
  const { fullName, email } = values;
  const { password, confirmPassword } = body;
  const showError = (status, errorMessage) => {
    prepareBotCheck(req, res, { forceNew: true });
    return res.status(status).render('register', {
      title: accountType === 'OWNER' ? 'Đăng ký chủ sân' : 'Đăng ký tài khoản',
      ...values, errorMessage
    });
  };

  const botCheck = await verifyBotCheck(req);
  if (!botCheck.ok) return showError(400, botCheck.message);

  if (!fullName || fullName.length > 100) {
    return showError(400, 'Họ tên phải có từ 1 đến 100 ký tự.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showError(400, 'Vui lòng nhập email hợp lệ, không quá 254 ký tự.');
  }
  if (typeof password !== 'string' || password.length < 8
      || Buffer.byteLength(password, 'utf8') > 72) {
    return showError(400, 'Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte.');
  }
  if (typeof confirmPassword !== 'string' || confirmPassword !== password) {
    return showError(400, 'Mật khẩu nhập lại chưa khớp.');
  }

  const phone = values.phone.replace(/[\s.-]/g, '').replace(/^\+84/, '0');
  if ((accountType === 'OWNER' || phone) && !/^0\d{9}$/.test(phone)) {
    return showError(400, 'Số điện thoại cần có 10 chữ số Việt Nam, bắt đầu bằng 0 hoặc +84.');
  }
  if (body.phone !== undefined && typeof body.phone !== 'string') {
    return showError(400, 'Số điện thoại phải là chuỗi.');
  }
  if (accountType === 'OWNER') {
    if (values.requestedFacilityName.length < 2 || values.requestedFacilityName.length > 150) {
      return showError(400, 'Tên cơ sở đề nghị cần từ 2 đến 150 ký tự.');
    }
    if (values.requestedFacilityAddress.length < 3 || values.requestedFacilityAddress.length > 500) {
      return showError(400, 'Địa chỉ cơ sở đề nghị cần từ 3 đến 500 ký tự.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const requireEmailVerify = process.env.EMAIL_VERIFICATION_REQUIRED === 'true';
  const rawVerifyToken = randomBytes(32).toString('hex');
  try {
    await User.create({
      fullName, email, passwordHash, phone,
      role: accountType,
      emailVerified: !requireEmailVerify,
      emailVerifyTokenHash: hashSecret(rawVerifyToken),
      emailVerifyExpiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      ...(accountType === 'OWNER' ? {
        ownerStatus: 'PENDING',
        requestedFacilityName: values.requestedFacilityName,
        requestedFacilityAddress: values.requestedFacilityAddress
      } : {})
    });
  } catch (error) {
    if (error.code === 11000) {
      return showError(409, 'Email này đã có tài khoản. Bạn có thể chuyển sang đăng nhập.');
    }
    throw error;
  }
  if (process.env.NODE_ENV !== 'test' || requireEmailVerify) {
    const verifyUrl = `${resolveBaseUrl(req)}/verify-email?token=${rawVerifyToken}`;
    await getMailService(req).sendEmailVerification({
      to: email,
      fullName,
      verifyUrl,
      expiresMinutes: Math.round(EMAIL_VERIFY_TTL_MS / 60000)
    }).catch(() => {});
  }
  if (req.session) {
    req.session.loginSuccessMessage = accountType === 'OWNER'
      ? 'Đã gửi đăng ký chủ sân thành công! Vui lòng đăng nhập để theo dõi trạng thái duyệt từ quản trị viên.'
      : 'Tạo tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.';
  }
  res.redirect(303, '/login');
}

export async function register(req, res) {
  return registerAccount(req, res, 'CUSTOMER');
}

export async function registerOwner(req, res) {
  return registerAccount(req, res, 'OWNER');
}

export async function login(req, res) {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const { checkoutId, checkoutToken } = body;
  let checkoutUrl;
  if (checkoutId !== undefined) {
    const booking = await getBookingForViewer(checkoutId, { token: checkoutToken });
    checkoutUrl = `/bookings/${booking._id}/checkout?token=${encodeURIComponent(checkoutToken)}`;
    if (booking.status !== 'HOLD') return res.redirect(303, checkoutUrl);
    Object.assign(res.locals, { checkoutId, checkoutToken, checkoutDeadline: booking.holdExpiresAt });
  }

  const renderLoginError = (status, errorMessage) => {
    prepareBotCheck(req, res, { forceNew: true });
    return res.status(status).render('login', {
      title: 'Đăng nhập', email, errorMessage, successMessage: null
    });
  };

  const botCheck = await verifyBotCheck(req);
  if (!botCheck.ok) return renderLoginError(400, botCheck.message);

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return renderLoginError(400, 'Vui lòng nhập email hợp lệ và mật khẩu không quá 72 byte.');
  }

  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +loginLockedUntil');
  const now = Date.now();
  if (user?.loginLockedUntil && user.loginLockedUntil.getTime() > now) {
    const retrySeconds = Math.max(1, Math.ceil((user.loginLockedUntil.getTime() - now) / 1000));
    const retryMinutes = Math.ceil(retrySeconds / 60);
    res.set('Retry-After', String(retrySeconds));
    return renderLoginError(
      429,
      `Tài khoản tạm thời bị khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau khoảng ${retryMinutes} phút.`
    );
  }

  const hashMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
  const passwordMatches = Boolean(user && hashMatches);

  if (!passwordMatches) {
    if (user) {
      const expiredLock = Boolean(user.loginLockedUntil && user.loginLockedUntil.getTime() <= now);
      const nextAttempts = (expiredLock ? 0 : (user.failedLoginAttempts || 0)) + 1;
      const locked = nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginAttempts: locked ? 0 : nextAttempts,
            loginLockedUntil: locked ? new Date(now + LOGIN_LOCKOUT_MS) : null
          }
        }
      );
      if (locked) {
        const retrySeconds = Math.ceil(LOGIN_LOCKOUT_MS / 1000);
        res.set('Retry-After', String(retrySeconds));
        return renderLoginError(
          429,
          'Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau.'
        );
      }
    }
    return renderLoginError(401, 'Email hoặc mật khẩu không đúng.');
  }

  if (user.failedLoginAttempts > 0 || user.loginLockedUntil) {
    await User.updateOne(
      { _id: user._id },
      { $set: { failedLoginAttempts: 0, loginLockedUntil: null } }
    );
  }

  const verifyMode = loginEmailVerifyMode();
  const mailService = getMailService(req);

  if (verifyMode === 'otp') {
    const code = String(randomInt(100000, 1000000));
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          loginOtpHash: hashSecret(code),
          loginOtpExpiresAt: new Date(now + LOGIN_OTP_TTL_MS),
          loginOtpAttempts: 0
        }
      }
    );
    const delivery = await mailService.sendLoginOtp({
      to: user.email,
      fullName: user.fullName,
      code,
      expiresMinutes: Math.round(LOGIN_OTP_TTL_MS / 60000)
    });
    await new Promise((resolve, reject) => {
      req.session.regenerate(error => error ? reject(error) : resolve());
    });
    req.session.pendingLogin = {
      userId: user._id.toString(),
      email: user.email,
      lastOtpSentAt: now,
      ...(process.env.NODE_ENV === 'development' && !delivery?.delivered ? { devOtpCode: code } : {}),
      ...(checkoutUrl ? { checkoutId, checkoutToken, checkoutUrl } : {})
    };
    await new Promise((resolve, reject) => {
      req.session.save(error => error ? reject(error) : resolve());
    });
    return res.redirect(303, '/login/verify');
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.userId = user._id.toString();
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });

  if (verifyMode === 'notify') {
    await mailService.sendLoginAlert({
      to: user.email,
      fullName: user.fullName,
      timeText: formatVietnamDateTime(new Date(now)),
      ip: req.ip || '',
      userAgent: req.get?.('user-agent') || '',
      forgotUrl: `${resolveBaseUrl(req)}/forgot-password`
    }).catch(() => {});
  }

  if (checkoutUrl) {
    const claimed = await claimGuestHold(checkoutId, checkoutToken, user);
    return res.redirect(303, claimed ? `/bookings/${checkoutId}/checkout` : checkoutUrl);
  }
  res.redirect(303, destination(user));
}

export function showLoginVerifyForm(req, res) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  const pending = req.session?.pendingLogin;
  if (!pending?.userId) return res.redirect(303, '/login');
  const infoMessage = req.query?.resent === '1'
    ? 'Đã gửi lại mã xác nhận mới tới email của bạn.'
    : null;
  res.render('login-verify', {
    title: 'Xác nhận đăng nhập',
    maskedEmail: maskEmail(pending.email),
    errorMessage: null,
    infoMessage,
    devOtpCode: process.env.NODE_ENV === 'development' ? (pending.devOtpCode || null) : null
  });
}

export async function verifyLoginOtp(req, res) {
  const pending = req.session?.pendingLogin;
  if (!pending?.userId) return res.redirect(303, '/login');

  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const showError = (status, errorMessage) => res.status(status).render('login-verify', {
    title: 'Xác nhận đăng nhập',
    maskedEmail: maskEmail(pending.email),
    errorMessage,
    infoMessage: null,
    devOtpCode: process.env.NODE_ENV === 'development' ? (pending.devOtpCode || null) : null
  });

  if (!/^\d{6}$/.test(code)) {
    return showError(400, 'Vui lòng nhập đủ 6 chữ số mã xác nhận.');
  }

  const user = await User.findById(pending.userId)
    .select('+loginOtpHash +loginOtpExpiresAt +loginOtpAttempts');
  const now = Date.now();
  if (!user || !user.loginOtpHash || !user.loginOtpExpiresAt || user.loginOtpExpiresAt.getTime() <= now) {
    return showError(400, 'Mã xác nhận đã hết hạn. Hãy bấm gửi lại mã mới.');
  }

  if (!hashesMatch(hashSecret(code), user.loginOtpHash)) {
    const attempts = (user.loginOtpAttempts || 0) + 1;
    if (attempts >= MAX_LOGIN_OTP_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        { $set: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 } }
      );
      delete req.session.pendingLogin;
      return res.status(401).render('login', {
        title: 'Đăng nhập',
        email: pending.email || '',
        errorMessage: 'Bạn đã nhập sai mã xác nhận quá nhiều lần. Vui lòng đăng nhập lại.',
        successMessage: null
      });
    }
    await User.updateOne({ _id: user._id }, { $set: { loginOtpAttempts: attempts } });
    return showError(401, 'Mã xác nhận chưa đúng. Vui lòng kiểm tra lại email.');
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { loginOtpHash: null, loginOtpExpiresAt: null, loginOtpAttempts: 0 } }
  );

  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.userId = user._id.toString();
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });

  if (pending.checkoutUrl) {
    const claimed = await claimGuestHold(pending.checkoutId, pending.checkoutToken, user);
    return res.redirect(303, claimed ? `/bookings/${pending.checkoutId}/checkout` : pending.checkoutUrl);
  }
  res.redirect(303, destination(user));
}

export async function resendLoginOtp(req, res) {
  const pending = req.session?.pendingLogin;
  if (!pending?.userId) return res.redirect(303, '/login');

  const now = Date.now();
  const elapsed = now - Number(pending.lastOtpSentAt || 0);
  if (elapsed < LOGIN_OTP_RESEND_COOLDOWN_MS) {
    const waitSeconds = Math.max(1, Math.ceil((LOGIN_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000));
    return res.set('Retry-After', String(waitSeconds)).status(429).render('login-verify', {
      title: 'Xác nhận đăng nhập',
      maskedEmail: maskEmail(pending.email),
      errorMessage: `Vui lòng đợi ${waitSeconds} giây trước khi yêu cầu gửi lại mã mới.`,
      infoMessage: null,
      devOtpCode: process.env.NODE_ENV === 'development' ? (pending.devOtpCode || null) : null
    });
  }

  const user = await User.findById(pending.userId);
  if (!user) {
    delete req.session.pendingLogin;
    return res.redirect(303, '/login');
  }

  const code = String(randomInt(100000, 1000000));
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        loginOtpHash: hashSecret(code),
        loginOtpExpiresAt: new Date(now + LOGIN_OTP_TTL_MS),
        loginOtpAttempts: 0
      }
    }
  );
  const mailService = getMailService(req);
  const delivery = await mailService.sendLoginOtp({
    to: user.email,
    fullName: user.fullName,
    code,
    expiresMinutes: Math.round(LOGIN_OTP_TTL_MS / 60000)
  });
  pending.lastOtpSentAt = now;
  if (process.env.NODE_ENV === 'development' && !delivery?.delivered) {
    pending.devOtpCode = code;
  } else {
    delete pending.devOtpCode;
  }
  res.redirect(303, '/login/verify?resent=1');
}

export async function verifyEmail(req, res) {
  const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).render('error', {
      title: 'Liên kết xác nhận không hợp lệ',
      message: 'Đường dẫn xác nhận email không hợp lệ hoặc đã hết hạn.',
      backUrl: '/login'
    });
  }

  const user = await User.findOne({
    emailVerifyTokenHash: hashSecret(token),
    emailVerifyExpiresAt: { $gt: new Date() }
  }).select('_id');

  if (!user) {
    return res.status(400).render('error', {
      title: 'Liên kết xác nhận không hợp lệ',
      message: 'Đường dẫn xác nhận email không hợp lệ hoặc đã hết hạn.',
      backUrl: '/login'
    });
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        emailVerified: true,
        emailVerifyTokenHash: null,
        emailVerifyExpiresAt: null
      }
    }
  );
  res.redirect(303, '/login?verified=1');
}

export function showForgotPasswordForm(req, res) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  prepareBotCheck(req, res);
  res.render('forgot-password', {
    title: 'Quên mật khẩu',
    email: '',
    errorMessage: null,
    successMessage: null,
    devResetUrl: null
  });
}

export async function requestPasswordReset(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const showError = (status, errorMessage) => {
    prepareBotCheck(req, res, { forceNew: true });
    return res.status(status).render('forgot-password', {
      title: 'Quên mật khẩu',
      email,
      errorMessage,
      successMessage: null,
      devResetUrl: null
    });
  };

  const botCheck = await verifyBotCheck(req);
  if (!botCheck.ok) return showError(400, botCheck.message);

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showError(400, 'Vui lòng nhập địa chỉ email hợp lệ.');
  }

  const mailService = getMailService(req);
  let devResetUrl = null;
  const user = await User.findOne({ email });
  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: hashSecret(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS)
        }
      }
    );
    const resetUrl = `${resolveBaseUrl(req)}/reset-password?token=${rawToken}`;
    const delivery = await mailService.sendPasswordReset({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
      expiresMinutes: Math.round(PASSWORD_RESET_TTL_MS / 60000)
    });
    if (process.env.NODE_ENV === 'development' && !delivery?.delivered) {
      devResetUrl = resetUrl;
    }
  }

  prepareBotCheck(req, res, { forceNew: true });
  return res.render('forgot-password', {
    title: 'Quên mật khẩu',
    email: '',
    errorMessage: null,
    successMessage: 'Nếu email này đã được đăng ký, chúng tôi đã gửi liên kết đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (kể cả mục Spam).',
    devResetUrl
  });
}

export async function showResetPasswordForm(req, res) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).render('reset-password', {
      title: 'Đặt lại mật khẩu',
      token: '',
      tokenValid: false,
      errorMessage: 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại.'
    });
  }

  const user = await User.findOne({
    passwordResetTokenHash: hashSecret(token),
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('_id').lean();

  if (!user) {
    return res.status(400).render('reset-password', {
      title: 'Đặt lại mật khẩu',
      token: '',
      tokenValid: false,
      errorMessage: 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại.'
    });
  }

  res.render('reset-password', {
    title: 'Đặt lại mật khẩu',
    token,
    tokenValid: true,
    errorMessage: null
  });
}

export async function resetPassword(req, res) {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const password = req.body?.password;
  const confirmPassword = req.body?.confirmPassword;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).render('reset-password', {
      title: 'Đặt lại mật khẩu',
      token: '',
      tokenValid: false,
      errorMessage: 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
    });
  }

  const showError = (status, errorMessage, tokenValid = true) => res.status(status).render('reset-password', {
    title: 'Đặt lại mật khẩu',
    token: tokenValid ? token : '',
    tokenValid,
    errorMessage
  });

  if (typeof password !== 'string' || password.length < 8
      || Buffer.byteLength(password, 'utf8') > 72) {
    return showError(400, 'Mật khẩu mới cần ít nhất 8 ký tự và không quá 72 byte.');
  }
  if (typeof confirmPassword !== 'string' || confirmPassword !== password) {
    return showError(400, 'Mật khẩu nhập lại chưa khớp.');
  }

  const user = await User.findOne({
    passwordResetTokenHash: hashSecret(token),
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('_id');

  if (!user) {
    return showError(400, 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại.', false);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        loginLockedUntil: null
      }
    }
  );
  res.redirect(303, '/login?reset=1');
}

export async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
  res.clearCookie('dat_san_sid', { path: '/' });
  res.redirect(303, '/login');
}
