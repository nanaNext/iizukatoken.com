const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const repo = require('./workReports.repository');
const db = require('../../core/database/mysql');

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const monthJST = () => todayJST().slice(0, 7);
const monthRange = (month) => {
  const [y, m] = String(month).split('-').map(n => parseInt(n, 10));
  const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
};

router.use(authenticate);

router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const date = isISODate(req.query?.date) ? String(req.query.date) : todayJST();
    const [rows] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.departmentId AS departmentId,
        d.name AS departmentName,
        a.id AS attendanceId,
        a.checkIn AS checkIn,
        a.checkOut AS checkOut,
        wr.site AS site,
        wr.work AS work,
        wr.updated_at AS updated_at
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.departmentId
      LEFT JOIN leave_requests lr
        ON lr.userId = u.id
       AND lr.status = 'approved'
       AND ? BETWEEN lr.startDate AND lr.endDate
      LEFT JOIN (
        SELECT t1.*
        FROM attendance t1
        INNER JOIN (
          SELECT userId, MAX(checkIn) AS maxCheckIn
          FROM attendance
          WHERE DATE(checkIn) = ?
          GROUP BY userId
        ) t2
          ON t2.userId = t1.userId AND t2.maxCheckIn = t1.checkIn
      ) a
        ON a.userId = u.id
      LEFT JOIN work_reports wr
        ON wr.userId = u.id AND wr.date = ?
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
        AND lr.id IS NULL
      ORDER BY
        CASE WHEN a.checkIn IS NULL THEN 1 ELSE 0 END ASC,
        COALESCE(u.employee_code, '') ASC,
        u.id ASC
    `, [date, date, date]);

    const items = (rows || []).map(r => {
      const hasIn = !!r.checkIn;
      const hasOut = !!r.checkOut;
      const status = hasIn ? (hasOut ? 'checked_out' : 'working') : 'not_checked_in';
      const hasReport = !!(r.site && r.work);
      return {
        userId: r.userId,
        employeeCode: r.employeeCode || null,
        username: r.username || null,
        departmentId: r.departmentId || null,
        departmentName: r.departmentName || null,
        attendance: {
          id: r.attendanceId || null,
          checkIn: r.checkIn || null,
          checkOut: r.checkOut || null
        },
        status,
        report: hasReport ? {
          site: r.site,
          work: r.work,
          updatedAt: r.updated_at || null
        } : null
      };
    });

    const submitted = items.filter(i => !!i.report).length;
    const required = items.filter(i => i.status === 'checked_out').length;
    const missing = items.filter(i => i.status === 'checked_out' && !i.report).length;
    res.status(200).json({ date, summary: { submitted, required, missing }, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/month', authorize('admin', 'manager'), async (req, res) => {
  try {
    const month = isYM(req.query?.month) ? String(req.query.month) : monthJST();
    const { start, end } = monthRange(month);
    const closed = await repo.isMonthClosed(month).catch(() => false);

    const [users] = await db.query(`
      SELECT u.id AS userId, u.employee_code AS employeeCode, u.username AS username,
             u.departmentId AS departmentId, d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC
    `);

    let latestRows = [];
    try {
      const [x] = await db.query(`
        SELECT a.id, a.userId, a.checkIn, a.checkOut
        FROM attendance a
        INNER JOIN (
          SELECT userId, MAX(checkIn) AS maxCheckIn
          FROM attendance
          WHERE checkIn >= ? AND checkIn < DATE_ADD(?, INTERVAL 1 DAY)
            AND userId IN (
              SELECT id
              FROM users
              WHERE employment_status = 'active'
                AND role IN ('employee','manager')
            )
          GROUP BY userId, DATE(checkIn)
        ) t
          ON t.userId = a.userId AND t.maxCheckIn = a.checkIn
      `, [start + ' 00:00:00', end + ' 00:00:00']);
      latestRows = x;
    } catch {
      try {
        const [attRows] = await db.query(`
          SELECT id, userId, checkIn, checkOut
          FROM attendance
          WHERE checkIn >= ? AND checkIn < DATE_ADD(?, INTERVAL 1 DAY)
            AND userId IN (
              SELECT id
              FROM users
              WHERE employment_status = 'active'
                AND role IN ('employee','manager')
            )
        `, [start + ' 00:00:00', end + ' 00:00:00']);
        latestRows = attRows;
      } catch {}
    }

    const [leaveRows] = await db.query(`
      SELECT userId, startDate, endDate
      FROM leave_requests
      WHERE status = 'approved'
        AND endDate >= ? AND startDate <= ?
    `, [start, end]);

    const reports = await repo.listByMonth(month);
    const reportMap = new Map();
    for (const r of (reports || [])) {
      reportMap.set(`${r.userId}|${String(r.date).slice(0, 10)}`, r);
    }

    const leaveByUser = new Map();
    for (const lr of (leaveRows || [])) {
      const uid = Number(lr.userId);
      if (!leaveByUser.has(uid)) leaveByUser.set(uid, []);
      leaveByUser.get(uid).push({ start: String(lr.startDate).slice(0, 10), end: String(lr.endDate).slice(0, 10) });
    }
    const isOnLeave = (uid, date) => {
      const arr = leaveByUser.get(uid);
      if (!arr || !arr.length) return false;
      for (const it of arr) {
        if (date >= it.start && date <= it.end) return true;
      }
      return false;
    };

    const attLatest = new Map();
    for (const a of (latestRows || [])) {
      const d = String(a.checkIn).slice(0, 10);
      const key = `${a.userId}|${d}`;
      const prev = attLatest.get(key);
      if (!prev || String(a.checkIn) > String(prev.checkIn)) attLatest.set(key, a);
    }

    const daysInMonth = (() => {
      const out = [];
      const d0 = new Date(start + 'T00:00:00Z');
      const d1 = new Date(end + 'T00:00:00Z');
      for (let t = d0.getTime(); t <= d1.getTime(); t += 24 * 60 * 60 * 1000) {
        out.push(new Date(t).toISOString().slice(0, 10));
      }
      return out;
    })();

    let requiredTotal = 0;
    let submittedTotal = 0;
    let missingTotal = 0;

    const items = (users || []).map(u => {
      const uid = Number(u.userId);
      const perDay = {};
      for (const d of daysInMonth) {
        if (isOnLeave(uid, d)) {
          perDay[d] = { status: 'leave', report: null };
          continue;
        }
        const a = attLatest.get(`${uid}|${d}`) || null;
        const status = a ? (a.checkOut ? 'checked_out' : 'working') : 'not_checked_in';
        const rep = reportMap.get(`${uid}|${d}`) || null;
        const report = rep ? { site: rep.site, work: rep.work, updatedAt: rep.updated_at || rep.updatedAt || null } : null;
        perDay[d] = { status, report };
        if (status === 'checked_out') {
          requiredTotal++;
          if (report) submittedTotal++;
          else missingTotal++;
        }
      }
      return {
        userId: uid,
        employeeCode: u.employeeCode || null,
        username: u.username || null,
        departmentId: u.departmentId || null,
        departmentName: u.departmentName || null,
        days: perDay
      };
    });

    res.status(200).json({
      month,
      closed,
      range: { start, end },
      days: daysInMonth,
      summary: { required: requiredTotal, submitted: submittedTotal, missing: missingTotal },
      items
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/month/:userId', authorize('admin', 'manager'), async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Invalid userId' });
    const month = isYM(req.query?.month) ? String(req.query.month) : monthJST();
    const { start, end } = monthRange(month);
    const closed = await repo.isMonthClosed(month).catch(() => false);

    const [[u]] = await db.query(`
      SELECT u.id AS userId, u.employee_code AS employeeCode, u.username AS username,
             u.departmentId AS departmentId, d.name AS departmentName
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE u.id = ?
      LIMIT 1
    `, [userId]);

    const [attRows] = await db.query(`
      SELECT id, checkIn, checkOut
      FROM attendance
      WHERE userId = ?
        AND checkIn >= ? AND checkIn < DATE_ADD(?, INTERVAL 1 DAY)
      ORDER BY checkIn ASC
    `, [userId, start + ' 00:00:00', end + ' 00:00:00']);

    const attLatest = new Map();
    for (const a of (attRows || [])) {
      const d = String(a.checkIn).slice(0, 10);
      const prev = attLatest.get(d);
      if (!prev || String(a.checkIn) > String(prev.checkIn)) attLatest.set(d, a);
    }

    const [leaveRows] = await db.query(`
      SELECT startDate, endDate
      FROM leave_requests
      WHERE userId = ?
        AND status = 'approved'
        AND endDate >= ? AND startDate <= ?
    `, [userId, start, end]);
    const leaves = (leaveRows || []).map(r => ({ start: String(r.startDate).slice(0, 10), end: String(r.endDate).slice(0, 10) }));
    const isOnLeave = (d) => leaves.some(it => d >= it.start && d <= it.end);

    const reports = await repo.listByUserMonth(userId, month);
    const reportMap = new Map();
    for (const r of (reports || [])) {
      reportMap.set(String(r.date).slice(0, 10), r);
    }

    const days = (() => {
      const out = [];
      const d0 = new Date(start + 'T00:00:00Z');
      const d1 = new Date(end + 'T00:00:00Z');
      for (let t = d0.getTime(); t <= d1.getTime(); t += 24 * 60 * 60 * 1000) {
        out.push(new Date(t).toISOString().slice(0, 10));
      }
      return out;
    })();

    const items = days.map(d => {
      if (isOnLeave(d)) return { date: d, status: 'leave', report: null };
      const a = attLatest.get(d) || null;
      const status = a ? (a.checkOut ? 'checked_out' : 'working') : 'not_checked_in';
      const rep = reportMap.get(d) || null;
      const report = rep ? { site: rep.site, work: rep.work, updatedAt: rep.updated_at || rep.updatedAt || null } : null;
      return { date: d, status, report };
    });

    res.status(200).json({
      month,
      closed,
      user: u ? { userId: u.userId, employeeCode: u.employeeCode || null, username: u.username || null, departmentName: u.departmentName || null } : { userId },
      items
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/close-month', authorize('admin', 'manager'), async (req, res) => {
  try {
    const month = isYM(req.body?.month) ? String(req.body.month) : null;
    if (!month) return res.status(400).json({ message: 'Missing month' });
    const r = await repo.closeMonth(month, req.user?.id || null);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:userId', authorize('admin', 'manager'), async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId || ''), 10);
    if (!userId) return res.status(400).json({ message: 'Invalid userId' });
    const date = isISODate(req.query?.date) ? String(req.query.date) : todayJST();
    await repo.ensureSchema();
    const [[row]] = await db.query(`
      SELECT
        wr.*,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.departmentId AS departmentId,
        d.name AS departmentName
      FROM work_reports wr
      LEFT JOIN users u ON u.id = wr.userId
      LEFT JOIN departments d ON d.id = u.departmentId
      WHERE wr.userId = ? AND wr.date = ?
      LIMIT 1
    `, [userId, date]);
    res.status(200).json({ date, report: row || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
