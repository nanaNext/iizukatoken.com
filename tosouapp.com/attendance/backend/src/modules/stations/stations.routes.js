const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { rateLimitNamed } = require('../../core/middleware/rateLimit');
const repo = require('./stations.repository');

router.use(authenticate);
router.get('/',
  rateLimitNamed('stations_search', { windowMs: 60_000, max: 60 }),
  authorize('employee','manager','admin'),
  async (req, res) => {
    try {
      const q = String(req.query.search || req.query.q || '').trim();
      if (!q) return res.status(200).json([]);
      const rows = await repo.searchByName(q, 20);
      res.status(200).json(rows || []);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
