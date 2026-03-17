const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { permit } = require('../../core/middleware/rbac');
const controller = require('./department.controller');
// Routes quản trị phòng ban
router.get('/', authenticate, permit('departments', 'view'), controller.list);
router.post('/', authenticate, permit('departments', 'full'), controller.create);
router.post('/bulk', authenticate, permit('departments', 'full'), controller.createBulk);
router.patch('/:id', authenticate, permit('departments', 'full'), controller.update);
router.delete('/:id', authenticate, permit('departments', 'full'), controller.remove);
module.exports = router;
