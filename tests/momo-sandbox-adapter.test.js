import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMomoSandboxAdapter,
  buildMomoCreateSignature,
  buildMomoIpnSignature,
  buildMomoRefundSignature
} from '../services/momo-sandbox.adapter.js';
import { buildVietQrPayload, crc16CcittFalse } from '../utils/vietqr.js';
import { createLocalQrSandboxAdapter } from '../services/local-qr-sandbox.adapter.js';
import { createHmac } from 'node:crypto';

const config = {
  partnerCode: 'MOMO_SANDBOX_TEST',
  accessKey: 'access_key_sandbox',
  secretKey: 'secret_key_sandbox_0123456789abcdef',
  ipnUrl: 'https://example.com/webhooks/payments',
  redirectUrl: 'https://example.com/my-bookings'
};

test('MoMo Sandbox adapter ký HMAC-SHA256 khi tạo intent và trả payUrl/qrCodeUrl', async () => {
  let capturedBody = null;
  const adapter = createMomoSandboxAdapter({
    ...config,
    fetchImpl: async (url, opts) => {
      assert.equal(url, 'https://test-payment.momo.vn/v2/gateway/api/create');
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          resultCode: 0,
          orderId: capturedBody.orderId,
          requestId: capturedBody.requestId,
          payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?t=abc',
          qrCodeUrl: 'momo://app?action=payWithApp&orderId=DS-TEST-01'
        })
      };
    }
  });

  const result = await adapter.createIntent({
    bookingId: '507f1f77bcf86cd799439011',
    reconciliationCode: 'DS-TEST-01',
    amountVND: 150000,
    currency: 'VND'
  });

  assert.equal(result.status, 'PENDING');
  assert.equal(result.amountVND, 150000);
  assert.equal(result.reconciliationCode, 'DS-TEST-01');
  assert.equal(result.checkoutUrl, 'https://test-payment.momo.vn/v2/gateway/pay?t=abc');
  assert.equal(result.qrPayload, 'momo://app?action=payWithApp&orderId=DS-TEST-01');

  const expectedSig = buildMomoCreateSignature({
    accessKey: config.accessKey,
    amount: '150000',
    extraData: '',
    ipnUrl: config.ipnUrl,
    orderId: 'DS-TEST-01',
    orderInfo: 'Thanh toan dat san DS-TEST-01',
    partnerCode: config.partnerCode,
    redirectUrl: config.redirectUrl,
    requestId: 'DS-TEST-01',
    requestType: 'captureWallet'
  }, config.secretKey);
  assert.equal(capturedBody.signature, expectedSig);
});

test('MoMo IPN webhook xác minh chữ ký HMAC-SHA256, chặn giả mạo số tiền và bỏ qua đơn lỗi', async () => {
  const adapter = createMomoSandboxAdapter(config);
  const ipnBase = {
    partnerCode: config.partnerCode,
    orderId: 'DS-TEST-02',
    requestId: 'DS-TEST-02',
    amount: 200000,
    orderInfo: 'Thanh toan dat san DS-TEST-02',
    orderType: 'momo_wallet',
    transId: 4012345678,
    resultCode: 0,
    message: 'Successful.',
    payType: 'qr',
    responseTime: 1730000000000,
    extraData: ''
  };
  const signature = buildMomoIpnSignature({ ...ipnBase, accessKey: config.accessKey }, config.secretKey);

  // 1. Chữ ký hợp lệ + resultCode = 0 -> SUCCEEDED
  const ok = await adapter.verifyWebhook({
    rawBody: Buffer.from(JSON.stringify({ ...ipnBase, signature }), 'utf8')
  });
  assert.deepEqual(ok, {
    status: 'SUCCEEDED',
    merchantId: config.partnerCode,
    recipientId: config.partnerCode,
    transactionId: '4012345678',
    receivedAmountMinor: 200000,
    currency: 'VND',
    reconciliationCode: 'DS-TEST-02',
    providerPaymentId: 'DS-TEST-02',
    externalId: 'DS-TEST-02'
  });

  // 2. Kẻ tấn công sửa amount nhưng giữ chữ ký cũ -> bị từ chối (null -> 401)
  const tampered = await adapter.verifyWebhook({
    rawBody: Buffer.from(JSON.stringify({ ...ipnBase, amount: 1000, signature }), 'utf8')
  });
  assert.equal(tampered, null);

  // 3. Giao dịch thất bại có chữ ký hợp lệ (resultCode = 1006) -> IGNORED
  const failedBody = { ...ipnBase, resultCode: 1006, message: 'User cancelled' };
  const failedSig = buildMomoIpnSignature({ ...failedBody, accessKey: config.accessKey }, config.secretKey);
  const ignored = await adapter.verifyWebhook({
    rawBody: Buffer.from(JSON.stringify({ ...failedBody, signature: failedSig }), 'utf8')
  });
  assert.deepEqual(ignored, { status: 'IGNORED' });
});

test('VietQR EMVCo sinh payload hợp lệ có mã BIN, số tiền VND, nội dung và CRC-16 đúng chuẩn', () => {
  const payload = buildVietQrPayload({
    bankBin: '970422',
    accountNumber: '0123456789',
    amountVND: 120000,
    description: 'Dat san DS-1001'
  });

  assert.ok(payload.startsWith('000201010212'));
  assert.ok(payload.includes('A000000727'));
  assert.ok(payload.includes('QRIBFTTA'));
  assert.ok(payload.includes('5303704'));
  assert.ok(payload.includes('5406120000'));
  assert.ok(payload.includes('Dat san DS-1001'));

  const withoutCrc = payload.slice(0, -4);
  const crc = payload.slice(-4);
  assert.equal(crc, crc16CcittFalse(withoutCrc));
});

test('Local QR Sandbox adapter sinh VietQR động và xác minh chữ ký webhook HMAC-SHA256', async () => {
  const secret = 'local-test-webhook-secret-0123456789';
  const adapter = createLocalQrSandboxAdapter({ webhookSecret: secret });

  const intent = await adapter.createIntent({
    reconciliationCode: 'DS-LOCAL-01',
    amountVND: 90000
  });
  assert.equal(intent.status, 'PENDING');
  assert.equal(intent.amountVND, 90000);
  assert.ok(intent.qrPayload.includes('DEMO DS-LOCAL-01'));

  const rawBody = Buffer.from(JSON.stringify({
    status: 'SUCCEEDED',
    reconciliationCode: 'DS-LOCAL-01',
    amountVND: 90000,
    transactionId: 'TXN-LOCAL-999'
  }), 'utf8');
  const sig = createHmac('sha256', secret).update(rawBody).digest('hex');

  const ok = await adapter.verifyWebhook({ rawBody, headers: { 'x-sandbox-signature': sig } });
  assert.equal(ok.status, 'SUCCEEDED');
  assert.equal(ok.transactionId, 'TXN-LOCAL-999');
  assert.equal(ok.receivedAmountMinor, 90000);

  const bad = await adapter.verifyWebhook({ rawBody, headers: { 'x-sandbox-signature': '0'.repeat(64) } });
  assert.equal(bad, null);
});

test('MoMo Sandbox refundPayment ký HMAC-SHA256 đúng chuẩn với orderId hoàn duy nhất', async () => {
  let captured = null;
  const adapter = createMomoSandboxAdapter({
    ...config,
    fetchImpl: async (url, opts) => {
      assert.equal(url, 'https://test-payment.momo.vn/v2/gateway/api/refund');
      captured = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ resultCode: 0, transId: 5012345678 })
      };
    }
  });

  const res = await adapter.refundPayment({
    refundOrderId: 'RF-DS-01',
    transId: '4012345678',
    amountVND: 150000,
    description: 'Hoan tien huy san'
  });
  assert.deepEqual(res, { status: 'REFUNDED', refundTransId: '5012345678', amountVND: 150000 });
  const expectedSig = buildMomoRefundSignature({
    accessKey: config.accessKey,
    amount: '150000',
    description: 'Hoan tien huy san',
    orderId: 'RF-DS-01',
    partnerCode: config.partnerCode,
    requestId: 'RF-DS-01',
    transId: '4012345678'
  }, config.secretKey);
  assert.equal(captured.signature, expectedSig);
});
