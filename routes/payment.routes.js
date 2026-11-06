import express from 'express';
import { createPaymentController } from '../controllers/payment.controller.js';

export function createPaymentRoutes(service, { checkoutEnabled = false } = {}) {
  const router = express.Router();
  const controller = createPaymentController(service);
  router.post('/bookings/:id/payment-intents', controller.create);
  router.get('/bookings/:id/payment-intent', controller.show);
  if (checkoutEnabled) router.get('/bookings/:id/payment-status', controller.checkoutStatus);
  return router;
}
