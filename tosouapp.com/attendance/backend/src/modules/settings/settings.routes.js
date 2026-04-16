const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const controller = require('./settings.controller');
// Routes cấu hình hệ thống
router.get('/', authenticate, authorize('admin'), controller.get);
router.patch('/', authenticate, authorize('admin'), controller.update);
module.exports = router;
