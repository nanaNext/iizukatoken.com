const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const repo = require('./workReports.repository');
const db = require('../../core/database/mysql');
const attendanceRepo = require('../attendance/attendance.repository');

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
    const wt = String(body.workType || body.work_type || '').trim();
    const workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
    const siteRaw = String(body.site || '').trim();
    const work = String(body.work || '').trim();
    if (!work) {
      return res.status(400).json({ message: 'Missing work' });
    }
    const site = siteRaw || '飯塚塗研';
    const [attRows] = await db.query(`
      SELECT id, checkIn, checkOut
      FROM attendance
      WHERE userId = ?
        AND DATE(checkIn) = ?
      ORDER BY checkIn DESC
      LIMIT 1
    `, [userId, date]);
    const att = attRows && attRows[0] ? attRows[0] : null;
    await repo.upsert({ userId, date, attendanceId: att?.id || null, workType, site, work });
    await attendanceRepo.upsertDaily(userId, date, { location: site, memo: work });
    const saved = await repo.getByUserDate(userId, date);
    const daily = await attendanceRepo.getDaily(userId, date).catch(() => null);
    res.status(201).json({ date, report: saved, daily });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
