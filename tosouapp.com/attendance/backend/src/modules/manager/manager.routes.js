const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const controller = require('./manager.controller');
router.get('/report', authenticate, authorize('manager','admin'), controller.groupReport);
router.post('/shifts',
  rateLimitNamed('manager_shifts', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('manager','admin'), controller.assignShift);
router.get('/users', authenticate, authorize('manager','admin'), controller.listMyDepartment);
router.patch('/users/:id',
  rateLimitNamed('manager_users_update', { windowMs: 60_000, max: 30 }),
  authenticate, authorize('manager','admin'), controller.updateEmployeeInfo);
router.get('/departments', authenticate, authorize('manager','admin'), controller.listDepartments);
router.get('/salary/preview', authenticate, authorize('manager','admin'), controller.salaryPreviewDepartment);
router.post('/users/:id/resign',
  rateLimitNamed('manager_users_resign', { windowMs: 60_000, max: 5 }),
  authenticate, authorize('manager','admin'), controller.resignEmployee);
router.get('/profile-change/pending', authenticate, authorize('manager','admin'), controller.listProfileChangePending);
router.get('/profile-change/:id', authenticate, authorize('manager','admin'), controller.getProfileChange);
router.patch('/profile-change/:id/status',
  rateLimitNamed('manager_profile_change_status', { windowMs: 60_000, max: 10 }),
  authenticate, authorize('manager','admin'), controller.approveProfileChange);
module.exports = router;
