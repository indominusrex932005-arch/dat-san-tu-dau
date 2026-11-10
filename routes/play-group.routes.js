import express from 'express';
import { requireAuth, requireOwner } from '../middlewares/auth.middleware.js';
import { listGroups, newGroup, saveGroup, showGroup, updateGroup, extraPage, saveExtra, toggleExtra } from '../controllers/play-group.controller.js';
export default function groupRoutes(limiter) {
  const router = express.Router();
  router.get('/groups', listGroups);
  router.get('/groups/new', requireAuth, newGroup);
  router.post('/groups', requireAuth, limiter, saveGroup);
  router.get('/groups/:id', showGroup);
  router.post('/groups/:id/:action', requireAuth, limiter, updateGroup);
  router.get('/owner/extras', requireAuth, requireOwner, extraPage);
  router.post('/owner/extras', requireAuth, requireOwner, saveExtra);
  router.post('/owner/extras/:id/toggle', requireAuth, requireOwner, toggleExtra);
  router.use((error, req, res, next) => {
    if (![400, 403, 404, 409].includes(error.status)) return next(error);
    res.status(error.status).render('error', { title: 'Mình kiểm tra lại một chút nhé', message: error.message, backUrl: '/groups' });
  });
  return router;
}
