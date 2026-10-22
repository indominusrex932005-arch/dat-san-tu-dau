import express from 'express';
import {
  showFacilities,
  showNewFacilityForm,
  createFacility,
  showEditFacilityForm,
  updateFacility
} from '../controllers/facility.controller.js';

const router = express.Router();

router.get('/', showFacilities);
router.get('/new', showNewFacilityForm);
router.post('/', createFacility);
router.get('/:id/edit', showEditFacilityForm);
router.post('/:id/edit', updateFacility);

export default router;