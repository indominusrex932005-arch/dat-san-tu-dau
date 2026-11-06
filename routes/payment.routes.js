import express from 'express';
import { createPaymentController } from '../controllers/payment.controller.js';

export function createPaymentRoutes(service) {
  const router = express.Router();
  const controller = createPaymentController(service);
  router.post('/bookings/:id/payment-intents', controller.create);
  router.get('/bookings/:id/payment-intent', controller.show);
  return router;
}
