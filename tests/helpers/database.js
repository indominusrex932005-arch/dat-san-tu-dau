import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { once } from 'node:events';
import createApp from '../../app.js';
import User from '../../models/User.js';
import Facility from '../../models/Facility.js';
import Court from '../../models/Court.js';
import Booking from '../../models/Booking.js';
import SlotLock from '../../models/SlotLock.js';
import Payment from '../../models/Payment.js';
import BookingRequest from '../../models/BookingRequest.js';

export { mongoose, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest };

export async function createTestEnvironment() {
  const uri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27029/?replicaSet=rs0&directConnection=true';
  // The integration suite must never fall back to a developer's Atlas database.
  if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+(?:\/|\?|$)/.test(uri)) {
    throw new Error('TEST_MONGODB_URI must point to a local disposable MongoDB replica set.');
  }
  const dbName = `booking_test_${Date.now()}_${process.pid}`;
  process.env.NODE_ENV = 'test';
  process.env.DEMO_MODE = 'true';
  process.env.SESSION_SECRET = 'local-integration-tests-only-secret-2026-0123456789';
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error('Integration tests require a MongoDB replica set for real transactions.');
  }
  await Promise.all([User, Facility, Court, Booking, SlotLock, Payment, BookingRequest].map(model => model.init()));
  const store = MongoStore.create({ client: mongoose.connection.getClient(), dbName, collectionName: 'sessions' });
  let server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, dbName, uri,
    async close() {
      if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server = null;
      await mongoose.connection.dropDatabase();
      await store.close();
      await mongoose.disconnect();
    }
  };
}
