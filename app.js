import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'node:url';
import homeRoutes from './routes/home.routes.js';
import facilityRoutes from './routes/facility.routes.js';
import createAuthRoutes from './routes/auth.routes.js';
import courtRoutes from './routes/court.routes.js';
import createBookingRoutes from './routes/booking.routes.js';
import ownerRoutes from './routes/owner.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { attachCurrentUser } from './middlewares/auth.middleware.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { createPostRateLimits } from './middlewares/post-rate-limit.js';
import { trustedProxyAddresses } from './config/trust-proxy.js';
import { formatMoney, formatDate } from './utils/booking-time.js';
import { createPaymentService } from './services/payment.service.js';
import { createPaymentRoutes } from './routes/payment.routes.js';
import { getPaymentConfig } from './config/payment-mode.js';
import { health } from './controllers/health.controller.js';
import { createPaymentWebhookRoutes } from './routes/payment-webhook.routes.js';
import { coverImage } from './utils/images.js';
import { cloudImageStorage } from './services/image-storage.js';
import createOwnerImageRoutes from './routes/owner-images.routes.js';

export default function createApp(sessionStore, {
  paymentService = createPaymentService({ getPaymentConfig }), paymentWebhookHandler,
  paymentCheckoutEnabled = false, imageStorage = cloudImageStorage
} = {}) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('Hãy thêm SESSION_SECRET dài ít nhất 32 ký tự vào .env.');
  }
  if (!sessionStore) throw new Error('Cần cung cấp nơi lưu session.');
  getPaymentConfig();

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
  app.locals.formatMoney = formatMoney;
  app.locals.formatDate = formatDate;
  app.locals.coverImage = coverImage;
  app.locals.imageUploadsReady = imageStorage.ready();
  app.locals.formatTime = value => new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date(value));
  app.locals.statusLabel = value => ({
    HOLD: 'Đang giữ chỗ', CONFIRMED: 'Đã xác nhận', EXPIRED: 'Đã hết hạn',
    CANCELLED: 'Đã hủy', LEGACY_RESERVED: 'Đơn cũ đang giữ lịch',
    PENDING: 'Chờ xử lý', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối'
  })[value] || value;
  app.locals.paymentLabel = value => ({
    UNPAID: 'Chưa ghi nhận thanh toán', DEMO_PAID: 'Thanh toán mô phỏng', PAID: 'Đã ghi nhận thanh toán'
  })[value] || value;
  for (const [name, key] of [['paymentMode', 'mode'], ['demoMode', 'demoMode'], ['publicDemo', 'publicDemo']]) {
    Object.defineProperty(app.locals, name, { enumerable: true, get: () => getPaymentConfig()[key] });
  }
  if (paymentCheckoutEnabled && !app.locals.demoMode) {
    throw new Error('Giao diện payment intent hiện cần môi trường demo thử nghiệm.');
  }
  app.locals.providerCheckoutEnabled = paymentCheckoutEnabled;
  app.disable('x-powered-by');
  app.set('trust proxy', trustedProxyAddresses(process.env.TRUST_PROXY_IPS));
  const limits = createPostRateLimits();

  app.use((req, res, next) => {
    res.locals.currentUser = null;
    res.locals.csrfToken = '';
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Readiness must not create a session or read a user's identity.
  app.get('/health', health);
  if (paymentWebhookHandler) app.use(createPaymentWebhookRoutes(paymentWebhookHandler));
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
  app.use('/', createPaymentRoutes(paymentService, { checkoutEnabled: paymentCheckoutEnabled }));
  app.use('/', homeRoutes);
  app.use('/facilities', facilityRoutes);
  app.use('/', createAuthRoutes(limits));
  app.use('/courts', courtRoutes);
  app.use('/', createBookingRoutes(limits.bookings));
  app.use('/owner', ownerRoutes);
  app.use('/owner', createOwnerImageRoutes(imageStorage, limits.images));
  app.use('/admin', adminRoutes);

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
      message: status >= 500 ? 'Có lỗi máy chủ. Vui lòng thử lại.' : error.message || 'Dữ liệu gửi lên không hợp lệ.',
      backUrl: '/courts'
    });
  });
  return app;
}
