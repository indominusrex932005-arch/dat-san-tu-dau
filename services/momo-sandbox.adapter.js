import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://test-payment.momo.vn';

function signHmacSha256(secretKey, rawSignature) {
  return createHmac('sha256', secretKey).update(rawSignature).digest('hex');
}

function constantTimeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string'
      || !/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(left.toLowerCase(), 'hex'), Buffer.from(right.toLowerCase(), 'hex'));
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function buildMomoCreateSignature({
  accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType
}, secretKey) {
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`
  ].join('&');
  return signHmacSha256(secretKey, rawSignature);
}

export function buildMomoIpnSignature({
  accessKey, amount, extraData, message, orderId, orderInfo, orderType,
  partnerCode, payType, requestId, responseTime, resultCode, transId
}, secretKey) {
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`
  ].join('&');
  return signHmacSha256(secretKey, rawSignature);
}

export function buildMomoRefundSignature({
  accessKey, amount, description, orderId, partnerCode, requestId, transId
}, secretKey) {
  const rawSignature = [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `description=${description}`,
    `orderId=${orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${requestId}`,
    `transId=${transId}`
  ].join('&');
  return signHmacSha256(secretKey, rawSignature);
}

export function getMomoSandboxEnv(env = process.env) {
  const partnerCode = typeof env.MOMO_PARTNER_CODE === 'string' ? env.MOMO_PARTNER_CODE.trim() : '';
  const accessKey = typeof env.MOMO_ACCESS_KEY === 'string' ? env.MOMO_ACCESS_KEY.trim() : '';
  const secretKey = typeof env.MOMO_SECRET_KEY === 'string' ? env.MOMO_SECRET_KEY.trim() : '';
  const ipnUrl = typeof env.MOMO_IPN_URL === 'string' ? env.MOMO_IPN_URL.trim() : '';
  const redirectUrl = typeof env.MOMO_REDIRECT_URL === 'string' ? env.MOMO_REDIRECT_URL.trim() : '';
  const enabled = Boolean(partnerCode && accessKey && secretKey && ipnUrl && redirectUrl);
  return { enabled, partnerCode, accessKey, secretKey, ipnUrl, redirectUrl };
}

// MoMo Payment Gateway API v2 adapter (sandbox/demo only — never enables PAYMENT_MODE=live).
export function createMomoSandboxAdapter({
  partnerCode,
  accessKey,
  secretKey,
  ipnUrl,
  redirectUrl,
  recipientId = partnerCode,
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  if (!partnerCode || !accessKey || !secretKey) {
    throw new Error('Thiếu cấu hình MoMo Sandbox (MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY).');
  }
  if (!validHttpsUrl(baseUrl) || !validHttpsUrl(ipnUrl) || !validHttpsUrl(redirectUrl)) {
    throw new Error('MOMO_IPN_URL, MOMO_REDIRECT_URL và baseUrl phải là URL HTTPS hợp lệ.');
  }
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const origin = new URL(normalizedBase).origin;

  return {
    provider: 'momo',
    environment: 'sandbox',
    checkoutOrigins: [origin, 'https://payment.momo.vn'],

    async createIntent(request, { signal } = {}) {
      const orderId = request.reconciliationCode;
      const requestId = request.reconciliationCode;
      const amount = String(request.amountVND);
      const orderInfo = `Thanh toan dat san ${orderId}`;
      const extraData = '';
      const requestType = 'captureWallet';

      const signature = buildMomoCreateSignature({
        accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType
      }, secretKey);

      const response = await fetchImpl(`${normalizedBase}/v2/gateway/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode,
          partnerName: 'San The Thao',
          storeId: 'SanTheThaoSandbox',
          requestId,
          amount: Number(amount),
          orderId,
          orderInfo,
          redirectUrl,
          ipnUrl,
          lang: 'vi',
          requestType,
          autoCapture: true,
          extraData,
          signature
        }),
        signal
      });

      if (!response.ok) return { status: 'UNKNOWN' };
      const data = await response.json();
      if (Number(data?.resultCode) !== 0) return { status: 'FAILED' };

      const checkoutUrl = typeof data.payUrl === 'string' && data.payUrl.trim() ? data.payUrl.trim() : undefined;
      const qrPayload = typeof data.qrCodeUrl === 'string' && data.qrCodeUrl.trim()
        ? data.qrCodeUrl.trim()
        : checkoutUrl;

      return {
        status: 'PENDING',
        amountVND: request.amountVND,
        currency: 'VND',
        reconciliationCode: orderId,
        providerPaymentId: String(data.requestId || requestId),
        externalId: String(data.orderId || orderId),
        ...(checkoutUrl ? { checkoutUrl } : {}),
        ...(qrPayload ? { qrPayload } : {})
      };
    },

    async lookupIntent(request, { signal } = {}) {
      const orderId = request.reconciliationCode;
      const requestId = request.reconciliationCode;
      const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
      const signature = signHmacSha256(secretKey, rawSignature);

      const response = await fetchImpl(`${normalizedBase}/v2/gateway/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerCode, requestId, orderId, lang: 'vi', signature }),
        signal
      });
      if (!response.ok) return { status: 'UNKNOWN' };
      const data = await response.json();
      const code = Number(data?.resultCode);
      if (code === 1000 || code === 7000 || code === 7002) {
        return {
          status: 'PENDING',
          amountVND: request.amountVND,
          currency: 'VND',
          reconciliationCode: orderId,
          providerPaymentId: String(data.requestId || requestId),
          externalId: String(data.orderId || orderId)
        };
      }
      if (code === 1005 || code === 1006 || code === 1003) return { status: 'FAILED' };
      return { status: 'UNKNOWN' };
    },

    // MoMo Refund API v2 (sandbox): yêu cầu orderId hoàn mới duy nhất (idempotency) + transId giao dịch gốc.
    async refundPayment({ refundOrderId, transId, amountVND, description = '' }, { signal } = {}) {
      if (!refundOrderId || !transId || !Number.isSafeInteger(amountVND) || amountVND <= 0) {
        throw new Error('Thông tin yêu cầu hoàn tiền MoMo không hợp lệ.');
      }
      const orderId = String(refundOrderId).trim();
      const requestId = orderId;
      const amount = String(amountVND);
      const safeDesc = String(description || `Hoan tien ${orderId}`).slice(0, 200);
      const signature = buildMomoRefundSignature({
        accessKey,
        amount,
        description: safeDesc,
        orderId,
        partnerCode,
        requestId,
        transId: String(transId)
      }, secretKey);

      const response = await fetchImpl(`${normalizedBase}/v2/gateway/api/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerCode,
          orderId,
          requestId,
          amount: amountVND,
          transId: Number(transId),
          lang: 'vi',
          description: safeDesc,
          signature
        }),
        signal
      });
      if (!response.ok) return { status: 'UNKNOWN' };
      const data = await response.json();
      if (Number(data?.resultCode) === 0) {
        return { status: 'REFUNDED', refundTransId: String(data.transId || ''), amountVND };
      }
      return { status: 'FAILED', resultCode: Number(data?.resultCode) };
    },

    async verifyWebhook({ rawBody }) {
      if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) return null;
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return null;
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
      if (payload.partnerCode !== partnerCode) return null;

      const requiredKeys = [
        'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType',
        'partnerCode', 'payType', 'requestId', 'responseTime', 'resultCode', 'transId', 'signature'
      ];
      for (const key of requiredKeys) {
        if (payload[key] === undefined || payload[key] === null) return null;
      }

      const expectedSignature = buildMomoIpnSignature({
        accessKey,
        amount: payload.amount,
        extraData: payload.extraData,
        message: payload.message,
        orderId: payload.orderId,
        orderInfo: payload.orderInfo,
        orderType: payload.orderType,
        partnerCode: payload.partnerCode,
        payType: payload.payType,
        requestId: payload.requestId,
        responseTime: payload.responseTime,
        resultCode: payload.resultCode,
        transId: payload.transId
      }, secretKey);

      if (!constantTimeHexEqual(String(payload.signature), expectedSignature)) {
        return null;
      }

      if (Number(payload.resultCode) !== 0) {
        return { status: 'IGNORED' };
      }

      const amount = Number(payload.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) return null;

      return {
        status: 'SUCCEEDED',
        merchantId: partnerCode,
        recipientId: String(recipientId),
        transactionId: String(payload.transId),
        receivedAmountMinor: amount,
        currency: 'VND',
        reconciliationCode: String(payload.orderId),
        providerPaymentId: String(payload.requestId),
        externalId: String(payload.orderId)
      };
    }
  };
}
