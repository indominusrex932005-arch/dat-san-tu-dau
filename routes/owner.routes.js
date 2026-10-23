import express from 'express';
import { requireAuth, requireOwner } from '../middlewares/auth.middleware.js';
import {
  showOwnerDashboard, showNewCourtForm, showEditCourtForm, createCourt, updateCourt,
  approveBookingRequest, rejectBookingRequest, recordBookingRefund, cancelGuestBooking
} from '../controllers/owner.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/', showOwnerDashboard);
router.use(requireOwner);
router.get('/courts/new', showNewCourtForm);
router.get('/courts/:id/edit', showEditCourtForm);
router.post('/courts', createCourt);
router.post('/courts/:id', updateCourt);
router.post('/requests/:id/approve', approveBookingRequest);
router.post('/requests/:id/reject', rejectBookingRequest);
router.post('/requests/:id/refund', recordBookingRefund);
router.post('/bookings/:id/cancel', cancelGuestBooking);

export default router;
