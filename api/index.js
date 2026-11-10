import 'dotenv/config';
import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import createApp from '../app.js';
import connectDatabase from '../config/database.js';
import { getPaymentConfig } from '../config/payment-mode.js';
import { assertDatabaseCompatibility } from '../services/database-compatibility.js';
import { expireHolds } from '../services/booking.service.js';
import { createServerlessHandler } from '../services/serverless-handler.js';
import PlayGroup from '../models/PlayGroup.js';
import ExtraService from '../models/ExtraService.js';
import User from '../models/User.js';
import Court from '../models/Court.js';
import Booking from '../models/Booking.js';
import Facility from '../models/Facility.js';
import SlotLock from '../models/SlotLock.js';
import Payment from '../models/Payment.js';
import BookingRequest from '../models/BookingRequest.js';

async function initialize() {
  getPaymentConfig();
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự.');
  }
  let store;
  try {
    await connectDatabase({ maxPoolSize: 5, minPoolSize: 0 });
    await assertDatabaseCompatibility();
    await Promise.all([PlayGroup, ExtraService, User, Facility, Court, Booking, SlotLock, Payment, BookingRequest].map(model => model.init()));
    store = MongoStore.create({
      client: mongoose.connection.getClient(), dbName: mongoose.connection.name,
      collectionName: 'sessions', ttl: 8 * 60 * 60, autoRemove: 'native'
    });
    store.on('error', error => console.error('Lỗi session:', error.name));
    // Only the Vercel-managed function uses its normalized X-Forwarded-Proto.
    // No client form/header can enable this on the ordinary Node/Render server.
    return createApp(store, { sessionProxy: process.env.VERCEL === '1' ? true : undefined });
  } catch (error) {
    if (store) await store.close().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    throw error;
  }
}

// Express parses the original form/multipart stream. Never run server.js here.
export const config = { maxDuration: 60 };
export default createServerlessHandler({ initialize, expireHolds });
