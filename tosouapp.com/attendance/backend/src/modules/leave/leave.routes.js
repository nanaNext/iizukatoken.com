const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { permit } = require('../../core/middleware/rbac');
const controller = require('./leave.controller');

router.post('/', authenticate, authorize('employee','manager','admin'), controller.create);
router.post('/paid', authenticate, authorize('employee','manager','admin'), controller.createPaid);
router.post('/my/cancel-paid', authenticate, authorize('employee','manager','admin'), controller.cancelMyPaid);
router.post('/reconcile-attendance', authenticate, permit('leaveAdmin','full'), controller.reconcileAttendance);
router.post('/grant', authenticate, permit('leaveAdmin','full'), controller.grant);
router.get('/eligible-list', authenticate, permit('leaveAdmin','view'), controller.eligibleList);
router.post('/grant-eligible/run', authenticate, permit('leaveAdmin','full'), controller.grantEligibleNow);
router.post('/request', authenticate, authorize('employee','manager','admin'), controller.createRequest);
router.put('/approve', authenticate, permit('leave','approve'), controller.approve);
router.get('/balance', authenticate, authorize('employee','manager','admin'), controller.balance);
router.get('/summary', authenticate, permit('leaveAdmin','view'), controller.summary);
router.post('/auto-grant/run', authenticate, permit('leaveAdmin','full'), controller.autoGrantNow);
router.get('/my', authenticate, authorize('employee','manager','admin'), controller.listMine);
router.get('/my-balance', authenticate, authorize('employee','manager','admin'), controller.myBalance);
router.get('/user-balance', authenticate, authorize('manager','admin'), controller.userBalance);
router.get('/', authenticate, authorize('manager','admin'), controller.listUser);
router.get('/admin-requests', authenticate, authorize('manager','admin'), controller.listAdminRequests);
router.get('/pending', authenticate, authorize('manager','admin'), controller.listPending);
router.patch('/:id/status', authenticate, authorize('manager','admin'), controller.updateStatus);

module.exports = router;
