import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import { PAYMENT_INTENT_INDEXES, listPaymentIndexes, matchesPaymentIntentIndex } from '../services/payment-intent-indexes.js';

const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const validDate = value => value instanceof Date && Number.isFinite(value.getTime());
const validId = value => value instanceof mongoose.Types.ObjectId;

async function validIntent(document) {
  if (!validId(document.booking) || !Number.isSafeInteger(document.amountVND) || document.amountVND <= 0
    || document.method !== 'PROVIDER' || !validDate(document.expiresAt) || !validDate(document.attemptedAt)
    || (document.recordedBy !== undefined && document.recordedBy !== null && !validId(document.recordedBy))
    || ['nextCheckAt', 'lookupLeaseUntil'].some(key => document[key] !== undefined && !validDate(document[key]))
    || ['currency', 'provider', 'environment', 'merchantId', 'reconciliationCode', 'intentStatus'].some(key => typeof document[key] !== 'string')
    || ['providerPaymentId', 'externalId', 'checkoutUrl', 'qrPayload', 'failureCode'].some(key => document[key] !== undefined && typeof document[key] !== 'string')
    || !document.recipient || ['bindingId', 'recipientId', 'displayName'].some(key => typeof document.recipient[key] !== 'string')) return false;
  // Validate against the new schema without saving or normalizing the stored document.
  try { await new Payment(document).validate(); return true; }
  catch { return false; }
}

/** Read-only unless apply is explicit. Stop all writers and back up the intended DB first. */
export async function migratePaymentIntents(db, { apply = false } = {}) {
  if (typeof apply !== 'boolean') throw new Error('Migration chỉ chấp nhận apply kiểu boolean tường minh.');
  const collection = db.collection('payments');
  const [documents, indexes, metadata] = await Promise.all([
    collection.find({ type: 'INITIAL_INTENT' }).toArray(), listPaymentIndexes(db),
    db.listCollections({ name: 'payments' }, { nameOnly: false }).toArray()
  ]);
  let invalidIntents = 0;
  for (const document of documents) if (!await validIntent(document)) invalidIntents++;
  let duplicateGroups = 0;
  for (const definition of PAYMENT_INTENT_INDEXES) {
    const groups = await collection.aggregate([
      { $match: definition.partialFilterExpression },
      { $group: { _id: Object.fromEntries(Object.keys(definition.key).map(key => [key, '$' + key])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'groups' }
    ]).toArray();
    duplicateGroups += groups[0]?.groups || 0;
  }
  const errors = [];
  if (metadata[0]?.options?.collation && metadata[0].options.collation.locale !== 'simple') {
    errors.push('Collection payments có collation không được hỗ trợ; cần đối chiếu riêng, không tự tạo hoặc sửa index.');
  }
  if (invalidIntents) errors.push('Có payment intent không hợp lệ; cần đối chiếu riêng, không tự sửa hoặc xóa.');
  if (duplicateGroups) errors.push('Có khóa payment intent trùng; cần đối chiếu riêng trước khi tạo unique index.');
  for (const expected of PAYMENT_INTENT_INDEXES) {
    if (indexes.some(index => (index.name === expected.name || sameKey(index.key, expected.key))
      && !matchesPaymentIntentIndex(index, expected))) {
      errors.push('Index payment intent hiện có xung đột cấu hình; migration không tự drop hoặc thay index.');
      break;
    }
  }
  const missing = PAYMENT_INTENT_INDEXES.filter(expected => !indexes.some(index => matchesPaymentIntentIndex(index, expected)));
  const report = {
    dryRun: !apply, applied: false,
    paymentsScanned: await collection.countDocuments(), intentsScanned: documents.length,
    invalidIntents, duplicateGroups, indexesToCreate: missing.map(index => index.name), errors
  };
  if (!apply || errors.length) return report;
  // Only index metadata changes. No document, legacy index or booking is rewritten.
  for (const { key, ...options } of missing) await collection.createIndex(key, options);
  report.applied = true;
  return report;
}

async function run() {
  let connection;
  try {
    const flags = process.argv.slice(2);
    if (flags.some(flag => flag !== '--apply') || flags.length > 1) throw new Error('INVALID_FLAGS');
    // Importing the migration must never load a developer's private environment.
    await import('dotenv/config');
    if (!process.env.MONGODB_URI || typeof process.env.DB_NAME !== 'string' || !process.env.DB_NAME.trim()) {
      throw new Error('MISSING_DATABASE_CONFIG');
    }
    connection = await mongoose.createConnection(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME, serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false
    }).asPromise();
    const report = await migratePaymentIntents(connection.db, { apply: flags.includes('--apply') });
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) process.exitCode = 1;
    else if (report.dryRun) console.log('Dry-run: chưa ghi dữ liệu hoặc index. Sao lưu, dừng writer và xác nhận DB riêng trước --apply.');
  } catch {
    console.error('Không thể chuẩn bị payment intent. Kiểm tra tham số, MONGODB_URI/DB_NAME, kết nối và dữ liệu; không tự sửa DB.');
    process.exitCode = 1;
  } finally {
    if (connection) await connection.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
