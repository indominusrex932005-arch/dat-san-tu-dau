import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTestEnvironment, mongoose, Payment } from './helpers/database.js';
import { migratePaymentIntents } from '../scripts/chuan-bi-payment-intents.js';
import { PAYMENT_INTENT_INDEXES, assertPaymentIntentIndexes } from '../services/payment-intent-indexes.js';

function intent(overrides = {}) {
  return {
    booking: new mongoose.Types.ObjectId(), amountVND: 125000, type: 'INITIAL_INTENT', method: 'PROVIDER',
    currency: 'VND', provider: 'mock_gateway', environment: 'sandbox', merchantId: 'MERCHANT_TEST',
    recipient: { bindingId: 'binding-test-v1', recipientId: 'recipient-test', displayName: 'Người nhận thử' },
    reconciliationCode: 'TEST_' + new mongoose.Types.ObjectId().toHexString(),
    attemptedAt: new Date(), expiresAt: new Date(Date.now() + 600000), intentStatus: 'CREATING',
    ...overrides
  };
}

test('Import migration không tải dotenv hoặc chạy CLI; tham số lạ không được kết nối DB', () => {
  const migration = new URL('../scripts/chuan-bi-payment-intents.js', import.meta.url).href;
  const imported = spawnSync(process.execPath, ['--input-type=module', '-e',
    `process.env.DOTENV_CONFIG_PATH='missing-payment-migration-fixture'; await import(${JSON.stringify(migration)}); process.stdout.write(String(Object.hasOwn(process.env, 'MONGODB_URI')));`
  ], { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !['MONGODB_URI', 'DB_NAME', 'DOTENV_CONFIG_PATH'].includes(key))) });
  assert.equal(imported.status, 0);
  assert.equal(imported.stdout, 'false');
  assert.equal(imported.stderr, '');
  const invalid = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/chuan-bi-payment-intents.js', import.meta.url)), '--unknown'], {
    encoding: 'utf8', env: { ...process.env, MONGODB_URI: 'mongodb://127.0.0.1:1/', DB_NAME: 'never_connect', DOTENV_CONFIG_PATH: 'missing-payment-migration-fixture' }, timeout: 5000
  });
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.doesNotMatch(invalid.stderr, /127\.0\.0\.1|never_connect/);
});

test('Payment intent migration chỉ tạo index rõ ràng, giữ nguyên mọi dữ liệu cũ', { timeout: 60000 }, async t => {
  const environment = await createTestEnvironment();
  t.after(() => environment.close());
  const db = mongoose.connection.db;
  const payments = db.collection('payments');
  const legacyBooking = new mongoose.Types.ObjectId();
  await payments.insertMany([
    { booking: legacyBooking, amountVND: 0, type: 'INITIAL_DEMO', method: 'DEMO', sentinel: 'legacy-no-rewrite' },
    { booking: legacyBooking, amountVND: 50000, type: 'EXTRA_DEMO', method: 'DEMO', sentinel: 'legacy-extra-1' },
    { booking: legacyBooking, amountVND: 75000, type: 'EXTRA_DEMO', method: 'DEMO', sentinel: 'legacy-extra-2' }
  ]);
  const legacyBefore = await payments.find({}).sort({ _id: 1 }).toArray();
  const indexesBefore = await payments.listIndexes().toArray();

  await t.test('Schema giữ demo cũ và chỉ yêu cầu snapshot đầy đủ cho intent', async () => {
    await new Payment({ booking: legacyBooking, amountVND: 0, type: 'EXTRA_DEMO' }).validate();
    await new Payment(intent()).validate();
    for (const overrides of [
      { amountVND: 0 }, { amountVND: 1.5 }, { method: 'DEMO' }, { currency: 'USD' },
      { environment: 'production' }, { recipient: undefined }, { provider: 'invalid provider' },
      { attemptedAt: undefined }, { intentStatus: 'PAID' }, { failureCode: 'unsafe error value' }
    ]) await assert.rejects(new Payment(intent(overrides)).validate(), { name: 'ValidationError' });
    assert.equal(Payment.schema.indexes().length, 1);
    assert.ok(indexesBefore.every(index => !index.name.startsWith('payment_intent_')));
  });

  await t.test('Dry-run và guard không ghi document hoặc tự tạo index', async () => {
    await assert.rejects(migratePaymentIntents(db, { apply: 'false' }), /boolean/);
    await assert.rejects(assertPaymentIntentIndexes(db), error => error.status === 503 && error.code === 'PAYMENT_MIGRATION_REQUIRED');
    const result = await migratePaymentIntents(db);
    assert.equal(result.dryRun, true);
    assert.equal(result.applied, false);
    assert.deepEqual(result.errors, []);
    assert.equal(result.paymentsScanned, 3);
    assert.equal(result.intentsScanned, 0);
    assert.equal(result.indexesToCreate.length, 4);
    assert.deepEqual(await payments.find({}).sort({ _id: 1 }).toArray(), legacyBefore);
    assert.deepEqual(await payments.listIndexes().toArray(), indexesBefore);
  });

  await t.test('Dry-run trên DB chưa có payments không tạo collection', async () => {
    const empty = mongoose.connection.getClient().db(environment.dbName + '_empty');
    const result = await migratePaymentIntents(empty);
    assert.equal(result.paymentsScanned, 0);
    assert.deepEqual(result.errors, []);
    await assert.rejects(assertPaymentIntentIndexes(empty), error => error.code === 'PAYMENT_MIGRATION_REQUIRED');
    assert.deepEqual(await empty.listCollections({}, { nameOnly: true }).toArray(), []);
  });

  await t.test('Collation không đơn giản chặn apply trước khi tạo index', async () => {
    const collated = mongoose.connection.getClient().db(environment.dbName + '_collated');
    try {
      const collection = await collated.createCollection('payments', { collation: { locale: 'en', strength: 2 } });
      await collection.insertOne({ booking: legacyBooking, amountVND: 0, type: 'INITIAL_DEMO', method: 'DEMO', sentinel: 'keep-collation' });
      const documents = await collection.find({}).toArray();
      const indexes = await collection.listIndexes().toArray();
      for (const apply of [false, true]) {
        const result = await migratePaymentIntents(collated, { apply });
        assert.equal(result.applied, false);
        assert.ok(result.errors.some(message => message.includes('collation')));
      }
      assert.deepEqual(await collection.find({}).toArray(), documents);
      assert.deepEqual(await collection.listIndexes().toArray(), indexes);
      await assert.rejects(assertPaymentIntentIndexes(collated), error => error.code === 'PAYMENT_MIGRATION_REQUIRED');
    } finally { await collated.dropDatabase(); }
  });

  await t.test('Intent sai hoặc trùng chặn apply, report không chứa định danh', async () => {
    const shared = intent({ merchantId: 'PRIVATE_FIXTURE_MERCHANT', providerPaymentId: 'PRIVATE_FIXTURE_PROVIDER_ID', externalId: 'PRIVATE_FIXTURE_EXTERNAL_ID' });
    await payments.insertMany([shared, { ...shared, _id: new mongoose.Types.ObjectId(), amountVND: '125000' }]);
    const result = await migratePaymentIntents(db, { apply: true });
    assert.equal(result.applied, false);
    assert.equal(result.invalidIntents, 1);
    assert.equal(result.duplicateGroups, 4);
    assert.ok(result.errors.length >= 2);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FIXTURE|TEST_[a-f0-9]|125000/);
    assert.deepEqual(await payments.listIndexes().toArray(), indexesBefore);
    await payments.deleteMany({ type: 'INITIAL_INTENT' });
  });

  await t.test('Index xung đột chặn apply, không tự drop hoặc đổi index', async () => {
    await payments.createIndex({ booking: 1 }, { name: 'payment_intent_booking_unique', partialFilterExpression: { type: 'INITIAL_INTENT' } });
    const conflictBefore = await payments.listIndexes().toArray();
    const result = await migratePaymentIntents(db, { apply: true });
    assert.equal(result.applied, false);
    assert.ok(result.errors.some(message => message.includes('xung đột')));
    await assert.rejects(assertPaymentIntentIndexes(db), error => error.code === 'PAYMENT_MIGRATION_REQUIRED');
    assert.deepEqual(await payments.listIndexes().toArray(), conflictBefore);
    await payments.dropIndex('payment_intent_booking_unique');
    await payments.createIndex({ booking: 1 }, { name: 'payment_intent_booking_unique', unique: true, partialFilterExpression: { type: 'INITIAL_INTENT', intentStatus: 'CREATING' } });
    await assert.rejects(assertPaymentIntentIndexes(db), error => error.code === 'PAYMENT_MIGRATION_REQUIRED');
    assert.equal((await migratePaymentIntents(db, { apply: true })).applied, false);
    await payments.dropIndex('payment_intent_booking_unique');
  });

  await t.test('Apply hai lần chỉ bổ sung bốn index và giữ nguyên legacy', async () => {
    const first = await migratePaymentIntents(db, { apply: true });
    assert.equal(first.applied, true);
    assert.deepEqual(first.errors, []);
    await assertPaymentIntentIndexes(db);
    const appliedIndexes = await payments.listIndexes().toArray();
    assert.equal(appliedIndexes.length, indexesBefore.length + 4);
    assert.deepEqual(await payments.find({}).sort({ _id: 1 }).toArray(), legacyBefore);
    const second = await migratePaymentIntents(db, { apply: true });
    assert.equal(second.applied, true);
    assert.deepEqual(second.indexesToCreate, []);
    assert.deepEqual(await payments.listIndexes().toArray(), appliedIndexes);
    assert.deepEqual(await payments.find({}).sort({ _id: 1 }).toArray(), legacyBefore);
  });

  await t.test('Unique khóa booking/mã/provider/external, tách scope và bỏ qua demo', async () => {
    const first = await Payment.create(intent({ providerPaymentId: 'provider-test-1', externalId: 'external-test-1' }));
    for (const overrides of [
      { booking: first.booking }, { reconciliationCode: first.reconciliationCode },
      { providerPaymentId: 'provider-test-1' }, { externalId: 'external-test-1' }
    ]) await assert.rejects(Payment.create(intent(overrides)), error => error.code === 11000);
    await Payment.create(intent({ merchantId: 'MERCHANT_OTHER', providerPaymentId: 'provider-test-1', externalId: 'external-test-1' }));
    await Payment.create(intent());
    await Payment.create(intent());
    await Payment.create({ booking: first.booking, amountVND: 0, type: 'INITIAL_DEMO' });
    assert.equal(await payments.countDocuments({ type: 'INITIAL_INTENT' }), 4);
    assert.equal((await payments.findOne({ _id: first._id })).intentStatus, 'CREATING');
    assert.equal(PAYMENT_INTENT_INDEXES.length, 4);
  });
});
