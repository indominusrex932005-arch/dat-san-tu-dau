import express from 'express';

function requireJson(req, res, next) {
  const contentType = req.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return res.status(415).json({ error: { code: 'PAYMENT_WEBHOOK_UNSUPPORTED_MEDIA_TYPE' } });
  }
  next();
}

function parserFailure(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.status === 413) return res.status(413).json({ error: { code: 'PAYMENT_WEBHOOK_BODY_TOO_LARGE' } });
  if (error.status === 415) return res.status(415).json({ error: { code: 'PAYMENT_WEBHOOK_UNSUPPORTED_MEDIA_TYPE' } });
  return res.status(400).json({ error: { code: 'PAYMENT_WEBHOOK_INVALID_BODY' } });
}

export function createPaymentWebhookRoutes(handler) {
  const router = express.Router({ caseSensitive: true, strict: true });
  const readBody = express.raw({ type: 'application/json', limit: '32kb', inflate: false });
  router.post('/webhooks/payments', requireJson, readBody, handler, parserFailure);
  return router;
}
