const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const ctrl = require('./notices.controller');

router.get('/', authenticate, authorize('employee','manager','admin'), ctrl.listForMe);
router.post('/read', authenticate, authorize('employee','manager','admin'), ctrl.markRead);

router.get('/admin', authenticate, authorize('manager','admin'), ctrl.listAdmin);
router.post('/admin', authenticate, authorize('manager','admin'), ctrl.create);
router.delete('/admin/:id', authenticate, authorize('manager','admin'), ctrl.remove);

module.exports = router;
