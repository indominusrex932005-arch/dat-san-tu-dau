import 'dotenv/config';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import createApp from './app.js';
import connectDatabase from './config/database.js';
import PlayGroup from './models/PlayGroup.js';
import ExtraService from './models/ExtraService.js';
import User from './models/User.js';
import Court from './models/Court.js';
import Booking from './models/Booking.js';
import Facility from './models/Facility.js';
import SlotLock from './models/SlotLock.js';
import Payment from './models/Payment.js';
import BookingRequest from './models/BookingRequest.js';
import { assertDatabaseCompatibility } from './services/database-compatibility.js';
import { expireHolds } from './services/booking.service.js';
import { getPaymentConfig } from './config/payment-mode.js';
import { createPaymentService } from './services/payment.service.js';
import { createPaymentWebhookHandler } from './services/payment-webhook.service.js';
import { createMomoSandboxAdapter, getMomoSandboxEnv } from './services/momo-sandbox.adapter.js';
import { createLocalQrSandboxAdapter } from './services/local-qr-sandbox.adapter.js';

try {
  // Fail before connecting, initializing indexes or cleaning up any booking.
  getPaymentConfig();
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự.');
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ.');

  await connectDatabase();
  await assertDatabaseCompatibility();
  await Promise.all([PlayGroup.init(), ExtraService.init(), User.init(), Facility.init(), Court.init(), Booking.init(), SlotLock.init(), Payment.init(), BookingRequest.init()]);
  await expireHolds();
  const store = MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: mongoose.connection.name,
    collectionName: 'sessions',
    ttl: 8 * 60 * 60
  });
  store.on('error', error => console.error('Lỗi session:', error.name));
  const appOptions = {};
  const momoEnv = getMomoSandboxEnv();
  if (getPaymentConfig().demoMode && momoEnv.enabled) {
    const momoAdapter = createMomoSandboxAdapter(momoEnv);
    appOptions.paymentService = createPaymentService({
      adapter: momoAdapter,
      getPaymentConfig,
      resolveRecipient: async booking => ({
        verified: true,
        merchantId: momoEnv.partnerCode,
        bindingId: `momo-sandbox-${momoEnv.partnerCode}`,
        recipientId: momoEnv.partnerCode,
        displayName: booking?.facility?.name || 'Cơ sở SanXanh (MoMo Sandbox)'
      })
    });
    appOptions.paymentWebhookHandler = createPaymentWebhookHandler({
      adapter: momoAdapter,
      getPaymentConfig
    });
    appOptions.paymentCheckoutEnabled = true;
    console.log('Đã kích hoạt MoMo Sandbox (PAYMENT_MODE=demo) tại POST /webhooks/payments.');
  } else if (getPaymentConfig().demoMode && (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')) {
    const localAdapter = createLocalQrSandboxAdapter();
    appOptions.paymentService = createPaymentService({
      adapter: localAdapter,
      getPaymentConfig,
      resolveRecipient: async booking => ({
        verified: true,
        merchantId: 'LOCAL_DEMO_SANDBOX',
        bindingId: 'local-demo-sandbox',
        recipientId: 'LOCAL_DEMO_SANDBOX',
        displayName: `${booking?.facility?.name || 'Cơ sở SanXanh'} (QR thử nghiệm)`
      })
    });
    appOptions.paymentWebhookHandler = createPaymentWebhookHandler({
      adapter: localAdapter,
      getPaymentConfig
    });
    appOptions.paymentCheckoutEnabled = true;
    console.log('Đã kích hoạt QR Sandbox cục bộ (PAYMENT_MODE=demo, development).');
  }
  const app = createApp(store, appOptions);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Server đang lắng nghe trên cổng ${port}.`));
  const expirationTimer = setInterval(() => {
    expireHolds().catch(error => console.error('Không thể dọn chỗ hết hạn:', error.name));
  }, 30000);
  expirationTimer.unref();
  let closing = false;
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      if (closing) return;
      closing = true;
      clearInterval(expirationTimer);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(0);
      });
    });
  }
} catch (error) {
  console.error('Không thể khởi động:', ['MIGRATION_REQUIRED', 'REPLICA_SET_REQUIRED', 'INVALID_PAYMENT_CONFIG'].includes(error.code) ? error.message : error.name);
  await mongoose.disconnect();
  process.exitCode = 1;
}
