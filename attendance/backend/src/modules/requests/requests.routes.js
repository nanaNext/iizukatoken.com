const express = require('express');
const router = express.Router();
const ctrl = require('./requests.controller');
const { authenticate } = require('../../core/middleware/authMiddleware');

router.get('/', authenticate, ctrl.listMine);
router.get('/recent/applied-types', authenticate, ctrl.listRecentAppliedTypes);
router.post('/', authenticate, ctrl.validateCreate, ctrl.create);

module.exports = router;
