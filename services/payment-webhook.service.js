import { recordAndReconcileProviderReceipt as recordProviderReceipt } from './payment-receipt-handoff.service.js';

const acceptedStatuses = new Set(['APPLIED', 'REVIEW', 'DUPLICATE']);

function validText(value, max) {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    && value === value.trim()
    && [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127);
}

function normalizeReceipt(event, namespace) {
  if (!event || event.status !== 'SUCCEEDED') return null;
  const { merchantId, transactionId, receivedAmountMinor, currency, reconciliationCode } = event;
  if (!validText(merchantId, 128) || !validText(transactionId, 200)
      || !Number.isSafeInteger(receivedAmountMinor) || receivedAmountMinor <= 0
      || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) return null;

  const receipt = { ...namespace, status: 'SUCCEEDED', merchantId, transactionId, receivedAmountMinor, currency };
  if (reconciliationCode !== undefined) {
    if (typeof reconciliationCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(reconciliationCode)) return null;
    receipt.reconciliationCode = reconciliationCode;
  }
  for (const [key, max] of [['recipientId', 128], ['providerPaymentId', 200], ['externalId', 200]]) {
    const value = event[key];
    if (value === undefined) continue;
    if (!validText(value, max)) return null;
    receipt[key] = value;
  }
  return receipt;
}

async function verify(adapter, rawBody, headers, receivedAt, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => adapter.verifyWebhook({ rawBody, headers, receivedAt, signal: controller.signal })),
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Payment webhook verification timed out.'));
          controller.abort();
        }, timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(res) {
  return res.status(503).json({ error: { code: 'PAYMENT_WEBHOOK_UNAVAILABLE' } });
}

// Bootstrap supplies the protocol-specific verifier and a merchant identity it can authenticate.
// No verifier is installed by the default server.
export function createPaymentWebhookHandler({ adapter, getPaymentConfig, timeoutMs = 5000, recordReceipt = recordProviderReceipt } = {}) {
  const { provider, environment } = adapter ?? {};
  if (typeof provider !== 'string' || !/^[a-z][a-z0-9_-]{0,49}$/.test(provider)
      || environment !== 'sandbox' || typeof adapter.verifyWebhook !== 'function'
      || typeof getPaymentConfig !== 'function' || typeof recordReceipt !== 'function'
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new Error('Cấu hình webhook thanh toán thử không hợp lệ.');
  }

  return async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: { code: 'PAYMENT_WEBHOOK_INVALID_BODY' } });
    }
    const receivedAt = new Date();
    let event;
    try {
      if ((await getPaymentConfig())?.mode !== 'demo') return unavailable(res);
      event = await verify(adapter, req.body, req.headers, receivedAt, timeoutMs);
    } catch {
      return unavailable(res);
    }
    if (event === null) return res.status(401).json({ error: { code: 'PAYMENT_WEBHOOK_UNVERIFIED' } });
    if (event?.status === 'IGNORED') return res.json({ status: 'IGNORED' });
    const receipt = normalizeReceipt(event, { provider, environment });
    if (!receipt) return res.status(400).json({ error: { code: 'PAYMENT_WEBHOOK_INVALID_EVENT' } });

    try {
      const result = await recordReceipt(receipt);
      if (!acceptedStatuses.has(result?.status)) return unavailable(res);
      return res.json({ status: result.status });
    } catch (error) {
      if (error?.status === 409) return res.status(409).json({ error: { code: 'PAYMENT_WEBHOOK_CONFLICT' } });
      return unavailable(res);
    }
  };
}
