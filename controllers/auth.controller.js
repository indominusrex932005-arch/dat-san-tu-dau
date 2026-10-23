import bcrypt from 'bcryptjs';
import User from '../models/User.js';

export function showLoginForm(req, res) {
  if (req.currentUser) return res.redirect('/courts');
  res.render('login', { title: 'Đăng nhập', errorMessage: null, email: '' });
}

export function showRegisterForm(req, res) {
  if (req.currentUser) return res.redirect('/courts');
  res.render('register', {
    title: 'Đăng ký tài khoản', errorMessage: null, fullName: '', email: ''
  });
}

export async function register(req, res) {
  if (req.currentUser) return res.redirect(303, '/courts');
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body : {};
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const { password, confirmPassword } = body;
  const showError = (status, errorMessage) => res.status(status).render('register', {
    title: 'Đăng ký tài khoản', fullName, email, errorMessage
  });

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

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await User.create({ fullName, email, passwordHash });
  } catch (error) {
    if (error.code === 11000) {
      return showError(409, 'Email này đã có tài khoản. Bạn có thể chuyển sang đăng nhập.');
    }
    throw error;
  }
  res.redirect(303, '/login');
}

export async function login(req, res) {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;

  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).render('login', {
      title: 'Đăng nhập', email,
      errorMessage: 'Vui lòng nhập email hợp lệ và mật khẩu không quá 72 byte.'
    });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user && await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).render('login', {
      title: 'Đăng nhập', email,
      errorMessage: 'Email hoặc mật khẩu không đúng.'
    });
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.userId = user._id.toString();
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
  res.redirect(303, '/courts');
}

export async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
  res.clearCookie('dat_san_sid', { path: '/' });
  res.redirect(303, '/login');
}
