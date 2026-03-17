const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const controller = require('./attendance.controller');
const attendanceRepo = require('./attendance.repository');
const calendarRepo = require('../calendar/calendar.repository');

router.post('/checkin', authenticate, authorize('employee','manager'), controller.checkIn);
router.post('/checkout', authenticate, authorize('employee','manager'), controller.checkOut);
router.get('/timesheet', authenticate, authorize('employee','manager','admin'), controller.timesheet);
router.post('/gps', authenticate, authorize('employee','manager'), controller.gpsLog);
router.post('/sync', authenticate, authorize('employee','manager'), controller.syncOffline);
router.get('/status', authenticate, authorize('employee','manager'), controller.statusToday);
router.get('/today-summary', authenticate, authorize('employee','manager','admin'), controller.todaySummary);
router.get('/today-roster', authenticate, authorize('admin','manager'), controller.todayRoster);
router.get('/date/:date', authenticate, authorize('employee','manager','admin'), controller.getDay);
router.put('/date/:date', authenticate, authorize('employee','manager','admin'), controller.putDay);
router.post('/date/:date/segments', authenticate, authorize('employee','manager'), controller.addSegment);
router.delete('/segment/:id', authenticate, authorize('employee','manager'), controller.deleteSegment);
router.post('/date/:date/submit', authenticate, authorize('employee','manager'), controller.submitDay);
router.get('/month', authenticate, authorize('employee','manager','admin'), controller.getMonth);
router.put('/month/bulk', authenticate, authorize('employee','manager'), controller.putMonthBulk);
router.get('/export', authenticate, authorize('employee','manager','admin'), controller.exportCsv);
router.get('/calendar', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const r = await calendarRepo.computeYear(year);
    const lang = (req.query.lang || req.headers['accept-language'] || '').toLowerCase();
    const isJa = lang.startsWith('ja');
    const bilingual = String(req.query.bilingual || '').toLowerCase() === 'true';
    const labelOf = (ja, en) => {
      const j = ja || null;
      const e = en || null;
      if (bilingual) return [j, e || j].filter(Boolean).join(' / ');
      return isJa ? (j || e || null) : (e || j || null);
    };
    const mapLabel = list => (Array.isArray(list) ? list.map(x => ({ ...x, label: labelOf(x.name_ja || x.name, x.name_en || null) })) : list);
    const detail2 = Array.isArray(r.detail) ? r.detail.map(x => ({ ...x, label: labelOf(x.name, x.name_en || null) })) : r.detail;
    const r2 = {
      ...r,
      jp_auto: mapLabel(r.jp_auto),
      jp_substitute: mapLabel(r.jp_substitute),
      jp_bridge: mapLabel(r.jp_bridge),
      detail: detail2
    };
    res.status(200).json(r2);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/day/:date', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const date = String(req.params.date || '').slice(0, 10);
    if (!date) return res.status(400).json({ message: 'Missing date' });
    const r = await calendarRepo.explainDate(date);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/working-days', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const month = req.query.month ? parseInt(String(req.query.month), 10) : null;
    const includeSunday = String(req.query.include_sunday || '').toLowerCase() === 'true';
    const includeSaturday = String(req.query.include_saturday || 'true').toLowerCase() === 'true';
    const includeLastSaturday = String(req.query.include_last_saturday || '').toLowerCase() === 'true';
    const excludeHolidays = String(req.query.exclude_holidays || '').toLowerCase() === 'true';
    const includeHolidayTypes = String(req.query.include_holiday_types || '').split(',').map(s => s.trim()).filter(Boolean);
    const onlyWeekdays = String(req.query.only_weekdays || '').toLowerCase() === 'true';
    const pad = n => String(n).padStart(2, '0');
    const r = await calendarRepo.computeYear(year);
    const off = new Set((r.off_days || []).map(d => String(d)));
    if (includeSunday) {
      for (const ds of (r.sundays || [])) {
        off.delete(String(ds));
      }
    }
    if (includeLastSaturday) {
      for (const ds of (r.saturday_last || [])) {
        off.delete(String(ds));
      }
    }
    if (includeHolidayTypes.length > 0) {
      const allow = new Set(includeHolidayTypes.map(t => String(t)));
      for (const it of (r.detail || [])) {
        if (allow.has(String(it.type))) {
          off.delete(String(it.date));
        }
      }
    } else if (excludeHolidays) {
      const holidayTypes = new Set(['fixed','jp_auto','jp_substitute','jp_bridge']);
      for (const it of (r.detail || [])) {
        if (holidayTypes.has(String(it.type))) {
          off.delete(String(it.date));
        }
      }
    }
    const from = new Date(Date.UTC(year, month ? (month - 1) : 0, 1, 0, 0, 0));
    const to = month ? new Date(Date.UTC(year, month, 0, 0, 0, 0)) : new Date(Date.UTC(year, 11, 31, 0, 0, 0));
    const list = [];
    let d = new Date(from);
    while (d.getTime() <= to.getTime()) {
      const ds = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      const dow = d.getUTCDay();
      if (onlyWeekdays && (dow === 0 || dow === 6)) {
        d.setUTCDate(d.getUTCDate() + 1);
        continue;
      }
      if (!includeSaturday && dow === 6) {
        off.add(ds);
      }
      if (!off.has(ds)) list.push(ds);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    res.status(200).json({ year, month: month || null, count: list.length, days: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/debug', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const r = await calendarRepo.computeYear(year);
    const summary = {
      year: r.year,
      keys: Object.keys(r),
      counts: {
        fixed: Array.isArray(r.fixed) ? r.fixed.length : 0,
        jp_auto: Array.isArray(r.jp_auto) ? r.jp_auto.length : 0,
        jp_substitute: Array.isArray(r.jp_substitute) ? r.jp_substitute.length : 0,
        jp_bridge: Array.isArray(r.jp_bridge) ? r.jp_bridge.length : 0,
        sundays: Array.isArray(r.sundays) ? r.sundays.length : 0,
        saturday_last: Array.isArray(r.saturday_last) ? r.saturday_last.length : 0,
        off_days: Array.isArray(r.off_days) ? r.off_days.length : 0,
        detail: Array.isArray(r.detail) ? r.detail.length : 0
      }
    };
    res.status(200).json({ summary, sample: { jp_auto_first: r.jp_auto?.[0] || null, jp_substitute_first: r.jp_substitute?.[0] || null, jp_bridge_first: r.jp_bridge?.[0] || null } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/debug/routes', async (req, res) => {
  try {
    const list = (router.stack || [])
      .map(l => l.route ? { path: l.route.path, methods: Object.keys(l.route.methods || {}) } : null)
      .filter(Boolean);
res.status(200).json({ routes: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
}
});
router.post('/debug/routes', async (req, res) => {
  try {
    const list = (router.stack || [])
      .map(l => l.route ? { path: l.route.path, methods: Object.keys(l.route.methods || {}) } : null)
      .filter(Boolean);
    res.status(200).json({ routes: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/debug/classify', async (req, res) => {
  try {
    const userId = parseInt(req.query.userId, 10);
    const date = String(req.query.date || '').slice(0,10);
    if (!userId || !date) {
      return res.status(400).json({ message: 'Missing userId/date' });
    }
    const userRepo = require('../users/user.repository');
    const rules = require('./attendance.rules');
    const user = await userRepo.getUserById(userId);
    const dept = user?.departmentId ? (await userRepo.getDepartmentById(user.departmentId)) : null;
    const rows = await attendanceRepo.listByUserBetween(userId, date, date);
    const rec = rows.find(r => String(r.checkOut || '').startsWith(date) || String(r.checkIn || '').startsWith(date)) || null;
    if (!rec) {
      return res.status(404).json({ message: 'No attendance for date' });
    }
    const computed = await rules.computeRecord(rec);
    res.status(200).json({
      user: {
        id: user?.id || userId,
        employment_type: user?.employment_type || null,
        departmentId: user?.departmentId || null,
        departmentName: dept?.name || null
      },
      attendance: {
        id: rec.id,
        checkIn: rec.checkIn,
        checkOut: rec.checkOut,
        shiftId: rec.shiftId || null
      },
      computed
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/debug/classify', async (req, res) => {
  try {
    const userId = parseInt((req.body?.userId ?? req.query.userId), 10);
    const date = String((req.body?.date ?? req.query.date) || '').slice(0,10);
    if (!userId || !date) {
      return res.status(400).json({ message: 'Missing userId/date' });
    }
    const userRepo = require('../users/user.repository');
    const rules = require('./attendance.rules');
    const user = await userRepo.getUserById(userId);
    const dept = user?.departmentId ? (await userRepo.getDepartmentById(user.departmentId)) : null;
    const rows = await attendanceRepo.listByUserBetween(userId, date, date);
    const rec = rows.find(r => String(r.checkOut || '').startsWith(date) || String(r.checkIn || '').startsWith(date)) || null;
    if (!rec) {
      return res.status(404).json({ message: 'No attendance for date' });
    }
    const computed = await rules.computeRecord(rec);
    res.status(200).json({
      user: {
        id: user?.id || userId,
        employment_type: user?.employment_type || null,
        departmentId: user?.departmentId || null,
        departmentName: dept?.name || null
      },
      attendance: {
        id: rec.id,
        checkIn: rec.checkIn,
        checkOut: rec.checkOut,
        shiftId: rec.shiftId || null
      },
      computed
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/shifts/ping', authenticate, authorize('admin'), (req, res) => {
  res.status(200).json({ ok: true });
});
router.get('/shifts/definitions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const rows = await attendanceRepo.listShiftDefinitions();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/definitions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, start_time, end_time, break_minutes } = req.body || {};
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ message: 'Missing name/start_time/end_time' });
    }
    const row = await attendanceRepo.upsertShiftDefinition({ name, start_time, end_time, break_minutes: break_minutes || 0 });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/assign', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userId, shiftId, startDate, endDate } = req.body || {};
    if (!userId || !shiftId || !startDate) {
      return res.status(400).json({ message: 'Missing userId/shiftId/startDate' });
    }
    await attendanceRepo.assignShiftToUser(userId, shiftId, startDate, endDate);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/backfill', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userId, fromDate, toDate } = req.body || {};
    if (!userId || !fromDate || !toDate) {
      return res.status(400).json({ message: 'Missing userId/fromDate/toDate' });
    }
    const r = await attendanceRepo.backfillShiftIdForUserRange(userId, fromDate, toDate);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
