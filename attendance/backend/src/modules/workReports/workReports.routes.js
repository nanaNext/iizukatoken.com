const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const repo = require('./workReports.repository');
const db = require('../../core/database/mysql');

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

router.use(authenticate);

router.get('/my', authorize('employee', 'manager', 'admin'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const date = isISODate(req.query?.date) ? String(req.query.date) : todayJST();
    const month = date.slice(0, 7);
    const row = await repo.getByUserDate(userId, date);
    const closed = await repo.isMonthClosed(month).catch(() => false);
    res.status(200).json({ date, month, closed, report: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', authorize('employee', 'manager', 'admin'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body || {};
    const date = isISODate(body.date) ? String(body.date) : todayJST();
    const month = date.slice(0, 7);
    try {
      if (await repo.isMonthClosed(month)) {
        return res.status(409).json({ message: 'Month is closed' });
      }
    } catch {}
    const site = String(body.site || '').trim();
    const work = String(body.work || '').trim();
    if (!site || !work) {
      return res.status(400).json({ message: 'Missing site/work' });
    }
    const [attRows] = await db.query(`
      SELECT id, checkIn, checkOut
      FROM attendance
      WHERE userId = ?
        AND DATE(checkIn) = ?
      ORDER BY checkIn DESC
      LIMIT 1
    `, [userId, date]);
    const att = attRows && attRows[0] ? attRows[0] : null;
    if (!att || !att.checkOut) {
      return res.status(409).json({ message: 'Must check-out before submitting report' });
    }
    await repo.upsert({ userId, date, attendanceId: att.id, site, work });
    const saved = await repo.getByUserDate(userId, date);
    res.status(201).json({ date, report: saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
