import express from 'express';
import { showCourts, showCourt } from '../controllers/court.controller.js';

const router = express.Router();
router.get('/', showCourts);
router.get('/:id', showCourt);

export default router;
