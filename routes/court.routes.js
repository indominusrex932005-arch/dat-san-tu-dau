import express from 'express';
import { showCourts, showCourt, showCourtAvailability } from '../controllers/court.controller.js';

const router = express.Router();
router.get('/', showCourts);
router.get('/:id/availability', showCourtAvailability);
router.get('/:id', showCourt);

export default router;
