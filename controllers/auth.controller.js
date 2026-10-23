import bcrypt from 'bcryptjs';
import User from '../models/User.js';

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
  res.render('register', {
    title: accountType === 'OWNER' ? 'Đăng ký chủ sân' : 'Đăng ký tài khoản',
    ...formValues({}, accountType), errorMessage: null
  });
}

export function showLoginForm(req, res) {
  if (req.currentUser) return res.redirect(destination(req.currentUser));
  res.render('login', { title: 'Đăng nhập', errorMessage: null, email: '' });
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
  const showError = (status, errorMessage) => res.status(status).render('register', {
    title: accountType === 'OWNER' ? 'Đăng ký chủ sân' : 'Đăng ký tài khoản',
    ...values, errorMessage
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
  try {
    await User.create({
      fullName, email, passwordHash, phone,
      role: accountType,
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
  res.redirect(303, destination(user));
}

export async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
  res.clearCookie('dat_san_sid', { path: '/' });
  res.redirect(303, '/login');
}
