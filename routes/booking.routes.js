import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  checkoutChoice, createBooking, showCheckout, payDemo, cancelHoldBooking, showReceipt, showMyBookings, showRequestForm, sendRequest
} from '../controllers/booking.controller.js';

export default function createBookingRoutes(limitBookings) {
  const router = express.Router();
  router.post('/bookings', limitBookings, createBooking);
  router.post('/bookings/:id/checkout-choice', checkoutChoice);
  router.get('/bookings/:id/checkout', showCheckout);
  router.post('/bookings/:id/demo-payment', payDemo);
  router.post('/bookings/:id/cancel-hold', cancelHoldBooking);
  router.get('/bookings/:id/receipt', showReceipt);
  router.get('/bookings/:id/request', requireAuth, showRequestForm);
  router.post('/bookings/:id/requests', requireAuth, sendRequest);
  router.get('/my-bookings', requireAuth, showMyBookings);
  return router;
}
