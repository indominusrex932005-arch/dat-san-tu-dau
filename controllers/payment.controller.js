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
    }
  };
}
