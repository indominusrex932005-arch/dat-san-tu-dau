import express from 'express';
import {
  showLoginForm, showRegisterForm, showOwnerRegisterForm, register, registerOwner, login, logout
} from '../controllers/auth.controller.js';

const router = express.Router();
router.get('/register', showRegisterForm);
router.post('/register', register);
router.get('/register/owner', showOwnerRegisterForm);
router.post('/register/owner', registerOwner);
router.get('/login', showLoginForm);
router.post('/login', login);
router.post('/logout', logout);

export default router;
