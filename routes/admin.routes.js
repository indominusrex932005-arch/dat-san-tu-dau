import express from 'express';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import {
  showAdminDashboard,
  approveOwner,
  rejectOwner,
  reopenOwner,
  unlockUser,
  verifyUserEmail
} from '../controllers/admin.controller.js';
import paymentReconciliationRoutes from './payment-reconciliation.routes.js';

const router = express.Router();
router.use(requireAdmin);
router.use('/payment-reconciliation', paymentReconciliationRoutes);
router.get('/', showAdminDashboard);
router.get('/owners', (req, res, next) => {
  req.adminDefaultTab = 'owners';
  return showAdminDashboard(req, res, next);
});
router.post('/owners/:id/approve', approveOwner);
router.post('/owners/:id/reject', rejectOwner);
router.post('/owners/:id/reopen', reopenOwner);
router.post('/users/:id/unlock', unlockUser);
router.post('/users/:id/verify-email', verifyUserEmail);

export default router;
