import express from 'express';
import { showFacilities } from '../controllers/facility.controller.js';

const router = express.Router();

router.get('/', showFacilities);

export default router;