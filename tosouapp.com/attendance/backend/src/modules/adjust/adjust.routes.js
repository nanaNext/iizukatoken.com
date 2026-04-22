const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const controller = require('./adjust.controller');
console.log('🔧 adjust.routes.js loaded, controller.listAll exists:', typeof controller.listAll);
// Routes yêu cầu sửa giờ - 放更具体的路由放在前面！
router.get('/admin', authenticate, authorize('admin','manager'), controller.listAll);
router.get('/my', authenticate, authorize('employee','manager','admin'), controller.listMine);
router.patch('/:id/status', authenticate, authorize('manager','admin'), controller.updateStatus);
router.post('/', authenticate, authorize('employee','manager','admin'), controller.create);
router.get('/', authenticate, authorize('manager','admin'), controller.listUser);
router.patch('/:id', authenticate, authorize('employee','manager','admin'), controller.updateByActor);
router.delete('/:id', authenticate, authorize('employee','manager','admin'), controller.remove);
module.exports = router;
