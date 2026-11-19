import express from 'express';
import { serveCaptchaImage } from '../middlewares/anti-bot.middleware.js';
import {
  showLoginForm,
  showRegisterForm,
  showOwnerRegisterForm,
  register,
  registerOwner,
  login,
  showLoginVerifyForm,
  verifyLoginOtp,
  resendLoginOtp,
  showForgotPasswordForm,
  requestPasswordReset,
  showResetPasswordForm,
  resetPassword,
  verifyEmail,
  logout
} from '../controllers/auth.controller.js';

export default function createAuthRoutes(limits, { mailService } = {}) {
  const router = express.Router();
  if (mailService) {
    router.use((req, _res, next) => {
      req.mailService = mailService;
      next();
    });
  }
  router.get('/captcha.svg', serveCaptchaImage);
  router.get('/register', showRegisterForm);
  router.post('/register', limits.register, register);
  router.get('/register/owner', showOwnerRegisterForm);
  router.post('/register/owner', limits.registerOwner, registerOwner);
  router.get('/login', showLoginForm);
  router.post('/login', limits.login, login);
  router.get('/login/verify', showLoginVerifyForm);
  router.post('/login/verify', limits.loginVerify, verifyLoginOtp);
  router.post('/login/verify/resend', limits.loginVerify, resendLoginOtp);
  router.get('/forgot-password', showForgotPasswordForm);
  router.post('/forgot-password', limits.forgotPassword, requestPasswordReset);
  router.get('/reset-password', showResetPasswordForm);
  router.post('/reset-password', limits.resetPassword, resetPassword);
  router.get('/verify-email', verifyEmail);
  router.post('/logout', logout);
  return router;
}
