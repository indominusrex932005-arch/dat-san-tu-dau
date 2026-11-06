import express from 'express';
import { listReceipts, showReceiptReview, recordReview } from '../controllers/payment-reconciliation.controller.js';

const router = express.Router();
router.use((req, res, next) => {
  if (req.app.locals.demoMode) return next();
  return next('router');
});
router.get('/', listReceipts);
router.get('/:id', showReceiptReview);
router.post('/:id', recordReview);

export default router;
