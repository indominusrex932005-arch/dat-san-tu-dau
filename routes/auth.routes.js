import express from 'express';
import {
  showLoginForm, showRegisterForm, showOwnerRegisterForm, register, registerOwner, login, logout
} from '../controllers/auth.controller.js';

export default function createAuthRoutes(limits) {
  const router = express.Router();
  router.get('/register', showRegisterForm);
  router.post('/register', limits.register, register);
  router.get('/register/owner', showOwnerRegisterForm);
  router.post('/register/owner', limits.registerOwner, registerOwner);
  router.get('/login', showLoginForm);
  router.post('/login', limits.login, login);
  router.post('/logout', logout);
  return router;
}
