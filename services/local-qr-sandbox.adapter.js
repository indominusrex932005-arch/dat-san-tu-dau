import { createHmac, timingSafeEqual } from 'node:crypto';
import { buildVietQrPayload } from '../utils/vietqr.js';

function sign(secret, rawBody) {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function validHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string'
      || !/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left.toLowerCase(), 'hex'), Buffer.from(right.toLowerCase(), 'hex'));
}

// Local-only sandbox adapter for development demos (PAYMENT_MODE=demo).
// Uses synthetic demo account numbers — never points to a real bank account.
export function createLocalQrSandboxAdapter({
  merchantId = 'LOCAL_DEMO_SANDBOX',
  webhookSecret = process.env.SESSION_SECRET || 'local-sandbox-webhook-secret-0123456789'
} = {}) {
  return {
    provider: 'local_qr',
    environment: 'sandbox',
    checkoutOrigins: ['https://sandbox.local.invalid'],

    async createIntent(request) {
      const qrPayload = buildVietQrPayload({
        bankBin: '970422',
        accountNumber: '0000000000',
        amountVND: request.amountVND,
        description: `DEMO ${request.reconciliationCode}`
      });
      return {
        status: 'PENDING',
        amountVND: request.amountVND,
        currency: 'VND',
        reconciliationCode: request.reconciliationCode,
        providerPaymentId: `local-${request.reconciliationCode}`,
        externalId: request.reconciliationCode,
        qrPayload
      };
    },

    async lookupIntent(request) {
      return {
        status: 'PENDING',
        amountVND: request.amountVND,
        currency: 'VND',
        reconciliationCode: request.reconciliationCode,
        providerPaymentId: `local-${request.reconciliationCode}`,
        externalId: request.reconciliationCode
      };
    },

    async verifyWebhook({ rawBody, headers }) {
      if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return null;
      const providedSig = headers?.['x-sandbox-signature'];
      const expectedSig = sign(webhookSecret, rawBody);
      if (!validHexEqual(providedSig, expectedSig)) return null;

      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return null;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      if (payload.status !== 'SUCCEEDED') return { status: 'IGNORED' };
      const amount = Number(payload.amountVND);
      if (!Number.isSafeInteger(amount) || amount <= 0 || !payload.reconciliationCode || !payload.transactionId) {
        return null;
      }
      return {
        status: 'SUCCEEDED',
        merchantId,
        recipientId: merchantId,
        transactionId: String(payload.transactionId),
        receivedAmountMinor: amount,
        currency: 'VND',
        reconciliationCode: String(payload.reconciliationCode),
        providerPaymentId: `local-${payload.reconciliationCode}`,
        externalId: String(payload.reconciliationCode)
      };
    }
  };
}
