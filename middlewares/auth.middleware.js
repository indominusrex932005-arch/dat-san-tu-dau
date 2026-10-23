import mongoose from 'mongoose';
import User from '../models/User.js';

export async function attachCurrentUser(req, res, next) {
  let user = null;
  const userId = req.session.userId;

  if (typeof userId === 'string' && mongoose.isObjectIdOrHexString(userId)) {
    user = await User.findById(userId).select('fullName email').lean();
  }

  if (!user && userId) delete req.session.userId;
  req.currentUser = user;
  res.locals.currentUser = user;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.currentUser) return res.redirect(303, '/login');
  next();
}
