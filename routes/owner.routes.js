import express from 'express';
import { requireAuth, requireOwner } from '../middlewares/auth.middleware.js';
import { showOwnerCalendar } from '../controllers/owner-calendar.controller.js';
import { showOwnerReport } from '../controllers/owner-report.controller.js';
import paymentReconciliationRoutes from './payment-reconciliation.routes.js';
import {
  showOwnerDashboard, showNewCourtForm, showEditCourtForm, createCourt, updateCourt,
  approveBookingRequest, rejectBookingRequest, recordBookingRefund, cancelGuestBooking,
  showEditFacilityForm, updateFacility, recordBookingCheckIn
} from '../controllers/owner.controller.js';

const router = express.Router();
router.use(requireAuth);
router.get('/', showOwnerDashboard);
router.use(requireOwner);
router.use('/payment-reconciliation', paymentReconciliationRoutes);
router.get('/calendar', showOwnerCalendar);
router.get('/reports', showOwnerReport);
router.get('/facilities/:id/edit', showEditFacilityForm);
router.post('/facilities/:id', updateFacility);
router.get('/courts/new', showNewCourtForm);
router.get('/courts/:id/edit', showEditCourtForm);
router.post('/courts', createCourt);
router.post('/courts/:id', updateCourt);
router.post('/requests/:id/approve', approveBookingRequest);
router.post('/requests/:id/reject', rejectBookingRequest);
router.post('/requests/:id/refund', recordBookingRefund);
router.post('/bookings/:id/cancel', cancelGuestBooking);
router.post('/bookings/:id/check-in', recordBookingCheckIn);

export default router;
