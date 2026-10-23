import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  createBooking, showCheckout, payDemo, showReceipt, showMyBookings, showRequestForm, sendRequest
} from '../controllers/booking.controller.js';

const router = express.Router();
router.post('/bookings', createBooking);
router.get('/bookings/:id/checkout', showCheckout);
router.post('/bookings/:id/demo-payment', payDemo);
router.get('/bookings/:id/receipt', showReceipt);
router.get('/bookings/:id/request', requireAuth, showRequestForm);
router.post('/bookings/:id/requests', requireAuth, sendRequest);
router.get('/my-bookings', requireAuth, showMyBookings);

export default router;
