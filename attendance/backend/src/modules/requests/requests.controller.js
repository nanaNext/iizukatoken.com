const repo = require('./requests.repository');
const { body, validationResult } = require('express-validator');

exports.validateCreate = [
  body('recordType').isLength({ min: 1, max: 64 }),
  body('detail').optional().isLength({ max: 2000 }),
  body('office').optional().isLength({ max: 128 })
];

exports.listMine = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const q = String(req.query.q || '');
    const data = await repo.listByUser(userId, { q, limit: 100, offset: 0 });
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.listRecentAppliedTypes = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const limit = Number(req.query.limit || 20);
    const data = await repo.listRecentAppliedTypes(userId, { limit });
    res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.create = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const { recordType, detail, office } = req.body || {};
    const { id, requestNo } = await repo.create({ userId, recordType, detail, office });
    res.status(201).json({ id, requestNo });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
