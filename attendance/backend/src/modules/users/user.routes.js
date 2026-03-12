const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const controller = require('./user.controller');
const { body } = require('express-validator');
const authRepo = require('../auth/auth.repository');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../../config/env');
const refreshRepo = require('../auth/refresh.repository');

router.get('/me',
  authenticate,
  authorize('employee','manager','admin'),
  controller.meSelf
);

router.patch('/me',
  authenticate,
  authorize('employee','manager','admin'),
  controller.updateMe
);

router.put('/change-password',
  authenticate,
  authorize('employee','manager','admin'),
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 8 }),
  async (req, res) => {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body || {};
      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Missing fields' });
      }
      const me = await authRepo.findUserById(userId);
      const ok = me && typeof me.password === 'string' && bcrypt.compareSync(currentPassword, me.password);
      if (!ok) return res.status(401).json({ message: 'Invalid current password' });
      const hashed = bcrypt.hashSync(newPassword, bcryptRounds);
      await require('./user.repository').setPassword(userId, hashed);
      await refreshRepo.deleteUserTokens(userId);
      return res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
