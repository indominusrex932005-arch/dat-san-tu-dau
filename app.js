import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import homeRoutes from './routes/home.routes.js';
import facilityRoutes from './routes/facility.routes.js';
import authRoutes from './routes/auth.routes.js';
import courtRoutes from './routes/court.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import { attachCurrentUser } from './middlewares/auth.middleware.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { formatMoney, formatDate } from './utils/booking-time.js';

export default function createApp(sessionStore) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('Hãy thêm SESSION_SECRET dài ít nhất 32 ký tự vào .env.');
  }
  if (!sessionStore) throw new Error('Cần cung cấp nơi lưu session.');

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.locals.formatMoney = formatMoney;
  app.locals.formatDate = formatDate;
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.locals.currentUser = null;
    res.locals.csrfToken = '';
    next();
  });
  app.use('/assets', express.static(fileURLToPath(new URL('./public', import.meta.url))));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(session({
    name: 'dat_san_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));
  app.use(attachCurrentUser);
  app.use(csrfProtection);
  app.use('/', homeRoutes);
  app.use('/facilities', facilityRoutes);
  app.use('/', authRoutes);
  app.use('/courts', courtRoutes);
  app.use('/', bookingRoutes);

  app.use((req, res) => {
    res.status(404).render('error', {
      title: 'Không tìm thấy trang',
      message: 'Đường dẫn này không tồn tại.',
      backUrl: '/courts'
    });
  });
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Lỗi xử lý yêu cầu:', error.name);
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status : 500;
    res.status(status).render('error', {
      title: 'Không thể xử lý yêu cầu',
      message: status >= 500 ? 'Có lỗi máy chủ. Vui lòng thử lại.' : 'Dữ liệu gửi lên không hợp lệ.',
      backUrl: '/courts'
    });
  });
  return app;
}
