import express from 'express';
import { requireAdmin } from '../middlewares/auth.middleware.js';
import { showAdminDashboard, approveOwner, rejectOwner } from '../controllers/admin.controller.js';

const router = express.Router();
router.use(requireAdmin);
router.get('/', showAdminDashboard);
router.post('/owners/:id/approve', approveOwner);
router.post('/owners/:id/reject', rejectOwner);

export default router;
