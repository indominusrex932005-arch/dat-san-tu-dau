import Payment from '../models/Payment.js';
import { recordProviderReceipt } from './payment-settlement.service.js';
import { recordReceiptForReview } from './payment-reconciliation.service.js';

// Acknowledge a REVIEW only after both the durable receipt and its review projection
// exist. A retry replays settlement and repairs an interrupted projection without
// confirming the booking again or resetting staff history/refund totals.
export async function recordAndReconcileProviderReceipt(event) {
  const result = await recordProviderReceipt(event);
  const receipt = await Payment.findOne({
    type: 'PROVIDER_RECEIPT', provider: event.provider, environment: event.environment,
    merchantId: event.merchantId, providerTransactionId: event.transactionId
  }).read('primary').readConcern('majority').lean();
  if (!receipt) throw new Error('Biên nhận chưa sẵn sàng để bàn giao.');
  if (receipt.receiptStatus !== 'REVIEW') return result;

  // Only the association verified during settlement may grant an OWNER access.
  const intent = receipt.intent && await Payment.findById(receipt.intent).lean();
  const orderReferenceKind = intent && (receipt.providerPaymentId ? 'providerPaymentId'
    : receipt.externalId ? 'externalId' : undefined);
  await recordReceiptForReview({
    provider: receipt.provider, environment: receipt.environment, merchantId: receipt.merchantId,
    transactionId: receipt.providerTransactionId, recipientId: receipt.providerRecipientId,
    bindingId: intent?.recipient?.bindingId,
    reconciliationCode: receipt.reconciliationCode,
    orderReferenceKind, orderReference: orderReferenceKind ? receipt[orderReferenceKind] : undefined,
    receivedAmountMinor: receipt.receivedAmountMinor,
    amountVND: receipt.currency === 'VND' ? receipt.receivedAmountMinor : undefined,
    currency: receipt.currency, receivedAt: receipt.createdAt
  });
  return result;
}
