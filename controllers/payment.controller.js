import QRCode from 'qrcode';
import { getBookingForViewer } from '../services/booking.service.js';

function access(req) {
  const token = req.body?.token ?? req.query.token;
  return { user: req.currentUser, token: typeof token === 'string' ? token : '' };
}

function failure(res, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  const publicCodes = new Set([
    'PAYMENT_NOT_CONFIGURED', 'PAYMENTS_DISABLED', 'PAYMENTS_LIVE_DISABLED', 'INVALID_PAYMENT_ADAPTER',
    'RECIPIENT_NOT_VERIFIED', 'PAYMENT_MIGRATION_REQUIRED', 'BOOKING_NOT_PAYABLE', 'BOOKING_EXPIRED',
    'INVALID_BOOKING_SNAPSHOT', 'BOOKING_LOCKS_MISSING', 'PAYMENT_CONFIGURATION_CHANGED',
    'PAYMENT_SNAPSHOT_CHANGED', 'PAYMENT_INTENT_NOT_FOUND'
  ]);
  return res.status(status).json({
    error: {
      code: publicCodes.has(error?.code) ? error.code : status >= 500 ? 'PAYMENT_UNAVAILABLE' : 'PAYMENT_REQUEST_REJECTED',
      message: status >= 500 ? 'Chưa thể tạo yêu cầu thanh toán. Vui lòng thử lại sau.' : error.message
    }
  });
}

export function createPaymentController(service) {
  return {
    async create(req, res) {
      try {
        const { intent, created } = await service.ensureIntent(req.params.id, access(req));
        const status = intent.status === 'PENDING' ? created ? 201 : 200
          : intent.status === 'FAILED' ? 502 : intent.status === 'EXPIRED' ? 410 : 202;
        return res.status(status).json({ intent });
      } catch (error) { return failure(res, error); }
    },
    async show(req, res) {
      try { return res.json({ intent: await service.getIntent(req.params.id, access(req)) }); }
      catch (error) { return failure(res, error); }
    },
    async checkoutStatus(req, res) {
      try {
        const viewer = access(req);
        let booking = await getBookingForViewer(req.params.id, viewer);
        let intent = null;
        let qrImage = null;
        if (booking.status === 'HOLD') {
          try { intent = await service.getIntent(req.params.id, viewer); }
          catch (error) {
            if (error.code !== 'PAYMENT_INTENT_NOT_FOUND') throw error;
          }
          if (intent?.status === 'PENDING' && intent.qrPayload) {
            try {
              qrImage = await QRCode.toDataURL(intent.qrPayload, {
                errorCorrectionLevel: 'M', margin: 4, width: 320
              });
            } catch { qrImage = null; }
          }
        }
        // Recheck after reading the intent and rendering QR, including a concurrent expiry/confirmation.
        booking = await getBookingForViewer(req.params.id, viewer);
        if (booking.status !== 'HOLD') {
          intent = null;
          qrImage = null;
        }
        if (intent && viewer.token && [intent.qrPayload, intent.checkoutUrl].some(value => value?.includes(viewer.token))) {
          intent = { ...intent, status: 'UNKNOWN', failureCode: 'INVALID_PROVIDER_RESPONSE' };
          delete intent.qrPayload;
          delete intent.checkoutUrl;
          qrImage = null;
        }
        const result = {
          booking: {
            id: String(booking._id), status: booking.status, paymentStatus: booking.paymentStatus,
            amountVND: booking.totalPrice, currency: 'VND'
          },
          intent, qrImage, serverNow: new Date().toISOString()
        };
        if (booking.status === 'HOLD') {
          result.holdUntil = new Date(Math.min(
            Number(new Date(booking.holdExpiresAt)),
            intent ? Number(new Date(intent.expiresAt)) : Infinity
          )).toISOString();
        }
        if (booking.status === 'CONFIRMED' && ['PAID', 'DEMO_PAID'].includes(booking.paymentStatus)) {
          const query = viewer.token ? '?token=' + encodeURIComponent(viewer.token) : '';
          result.receiptUrl = `/bookings/${booking._id}/receipt${query}`;
        }
        return res.json(result);
      } catch (error) { return failure(res, error); }
    }
  };
}
