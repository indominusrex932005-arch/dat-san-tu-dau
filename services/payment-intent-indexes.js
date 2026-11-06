import mongoose from 'mongoose';

export const PAYMENT_INTENT_INDEXES = Object.freeze([
  { key: { booking: 1 }, name: 'payment_intent_booking_unique', unique: true, partialFilterExpression: { type: 'INITIAL_INTENT' } },
  { key: { reconciliationCode: 1 }, name: 'payment_intent_reconciliation_unique', unique: true, partialFilterExpression: { type: 'INITIAL_INTENT', reconciliationCode: { $type: 'string' } } },
  { key: { provider: 1, environment: 1, merchantId: 1, providerPaymentId: 1 }, name: 'payment_intent_provider_payment_unique', unique: true, partialFilterExpression: { type: 'INITIAL_INTENT', providerPaymentId: { $type: 'string' } } },
  { key: { provider: 1, environment: 1, merchantId: 1, externalId: 1 }, name: 'payment_intent_external_unique', unique: true, partialFilterExpression: { type: 'INITIAL_INTENT', externalId: { $type: 'string' } } }
]);

const canonical = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export function matchesPaymentIntentIndex(index, expected) {
  return index.name === expected.name && JSON.stringify(index.key) === JSON.stringify(expected.key)
    && index.unique === true && index.sparse !== true && index.hidden !== true
    && index.expireAfterSeconds === undefined && index.collation === undefined
    && JSON.stringify(canonical(index.partialFilterExpression)) === JSON.stringify(canonical(expected.partialFilterExpression));
}

export async function listPaymentIndexes(db) {
  try { return await db.collection('payments').listIndexes().toArray(); }
  catch (error) { if (error.code === 26) return []; throw error; }
}

export async function assertPaymentIntentIndexes(db = mongoose.connection.db) {
  const fail = () => Object.assign(new Error('Cần dừng writer, sao lưu và chạy migration payment intent trước khi dùng chức năng này.'), {
    status: 503, code: 'PAYMENT_MIGRATION_REQUIRED'
  });
  if (!db) throw fail();
  let indexes;
  try { indexes = await listPaymentIndexes(db); }
  catch { throw fail(); }
  if (PAYMENT_INTENT_INDEXES.some(expected => !indexes.some(index => matchesPaymentIntentIndex(index, expected)))) throw fail();
}
