import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { createBooking, showMyBookings } from '../controllers/booking.controller.js';

const router = express.Router();
router.post('/bookings', requireAuth, createBooking);
router.get('/my-bookings', requireAuth, showMyBookings);

export default router;
