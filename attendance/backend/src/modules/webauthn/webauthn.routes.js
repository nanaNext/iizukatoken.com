const express = require('express');
const router = express.Router();
const controller = require('./webauthn.controller');
const { authenticate } = require('../../core/middleware/authMiddleware');

router.use((req, res, next) => {
  const enabled = String(process.env.ENABLE_WEBAUTHN || '').toLowerCase() === 'true';
  if (!enabled) return res.status(404).json({ message: 'Not Found' });
  next();
});

router.post('/register/options', authenticate, controller.registerOptions);
router.post('/register/verify', authenticate, controller.registerVerify);
router.post('/login/options', controller.loginOptions);
router.post('/login/verify', controller.loginVerify);

module.exports = router;
