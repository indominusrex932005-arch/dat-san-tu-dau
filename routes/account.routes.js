import express from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { showAccount, updateProfile, updatePassword } from '../controllers/account.controller.js';

const router = express.Router();

router.get('/account', requireAuth, showAccount);
router.post('/account/profile', requireAuth, updateProfile);
router.post('/account/password', requireAuth, updatePassword);

export default router;
