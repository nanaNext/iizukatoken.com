const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const controller = require('./attendance.controller');
const attendanceRepo = require('./attendance.repository');
const calendarRepo = require('../calendar/calendar.repository');
const userRepo = require('../users/user.repository');
const allowDebugRoutes = process.env.NODE_ENV !== 'production' || String(process.env.ENABLE_DEBUG_ROUTES || '').toLowerCase() === 'true';

const HOLIDAY_TYPES = new Set(['fixed', 'jp_auto', 'jp_substitute', 'jp_bridge']);

async function isKoujiFullTimeUser(userId) {
  try {
    const u = await userRepo.getUserById(userId);
    if (!u) return false;
    const tRaw = String(u?.employment_type || '').trim();
    const t = tRaw.toLowerCase();
    const fullTime = t === 'full_time' || tRaw.includes('正社員');
    if (!fullTime) return false;
    const dept = u?.departmentId ? (await userRepo.getDepartmentById(u.departmentId)) : null;
    const deptName = String(dept?.name || '').trim();
    return deptName.includes('工事部');
  } catch {
    return false;
  }
}

function buildOffSetFromCalendarDetail(detail, useKoujiPolicy) {
  const byDate = new Map();
  for (const it of (Array.isArray(detail) ? detail : [])) {
    const ds = String(it?.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
    if (!byDate.has(ds)) byDate.set(ds, []);
    byDate.get(ds).push({
      type: String(it?.type || ''),
      is_off: Number(it?.is_off || 0) === 1
    });
  }
  const off = new Set();
  for (const [ds, list] of byDate.entries()) {
    if (!useKoujiPolicy) {
      if (list.some(x => x.is_off)) off.add(ds);
      continue;
    }
    const hasSunday = list.some(x => x.is_off && x.type === 'sunday');
    const hasLastSaturday = list.some(x => x.is_off && x.type === 'saturday_last');
    const hasHoliday = list.some(x => x.is_off && HOLIDAY_TYPES.has(x.type));
    if (hasSunday || hasLastSaturday || hasHoliday) off.add(ds);
  }
  return { byDate, off };
}

router.post('/checkin',
  rateLimitNamed('attendance_checkin', { windowMs: 60_000, max: 3 }),
  authenticate, authorize('employee','manager','admin'), controller.checkIn);
router.post('/checkout',
  rateLimitNamed('attendance_checkout', { windowMs: 60_000, max: 3 }),
  authenticate, authorize('employee','manager','admin'), controller.checkOut);
router.post('/worktype', authenticate, authorize('employee','manager','admin'), controller.setWorkType);
router.get('/timesheet', authenticate, authorize('employee','manager','admin'), controller.timesheet);
router.post('/gps',
  rateLimitNamed('attendance_gps', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('employee','manager'), controller.gpsLog);
router.post('/sync',
  rateLimitNamed('attendance_sync', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('employee','manager'), controller.syncOffline);
router.get('/status', authenticate, authorize('employee','manager','admin'), controller.statusToday);
router.get('/today-summary', authenticate, authorize('manager','admin'), controller.todaySummary);
router.get('/today-roster', authenticate, authorize('admin','manager'), controller.todayRoster);
router.get('/date/:date', authenticate, authorize('employee','manager','admin'), controller.getDay);
router.get('/date/:date/daily', authenticate, authorize('employee','manager','admin'), controller.getDaily);
router.put('/date/:date', authenticate, authorize('employee','manager','admin'), controller.putDay);
router.put('/date/:date/daily', authenticate, authorize('employee','manager','admin'), controller.putDaily);
router.post('/date/:date/segments', authenticate, authorize('employee','manager'), controller.addSegment);
router.delete('/segment/:id', authenticate, authorize('employee','manager'), controller.deleteSegment);
router.post('/date/:date/submit', authenticate, authorize('employee','manager'), controller.submitDay);
router.get('/month', authenticate, authorize('employee','manager','admin','payroll'), controller.getMonth);
router.get('/month/detail', authenticate, authorize('employee','manager','admin','payroll'), controller.getMonthDetail);
router.get('/month/status', authenticate, authorize('employee','manager','admin','payroll'), controller.getMonthStatus);
router.get('/month/status-bulk', authenticate, authorize('manager','admin'), controller.getMonthStatusBulk);
router.post('/month/submit', authenticate, authorize('employee','manager','admin'), controller.submitMonth);
router.post('/month/approve',
  rateLimitNamed('attendance_month_approve', { windowMs: 60_000, max: 10 }),
  authenticate, authorize('manager','admin'), controller.approveMonth);
router.post('/month/unlock',
  rateLimitNamed('attendance_month_unlock', { windowMs: 60_000, max: 5 }),
  authenticate, authorize('admin'), controller.unlockMonth);
router.get('/month/missing', authenticate, authorize('manager','admin'), controller.getMonthMissing);
router.post('/month/approve-ready', authenticate, authorize('manager','admin'), controller.approveReadyMonth);
router.get('/month/summary', authenticate, authorize('employee','manager','admin'), controller.getMonthSummary);
router.put('/month/summary', authenticate, authorize('manager','admin'), controller.putMonthSummary);
router.get('/shifts/assignments', authenticate, authorize('employee','manager','admin','payroll'), controller.getShiftAssignments);
router.post('/shifts/assignments',
  rateLimitNamed('attendance_shift_assign', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('manager','admin'), controller.postShiftAssignment);
router.delete('/shifts/assignments/:id',
  rateLimitNamed('attendance_shift_assign_delete', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('manager','admin'), controller.deleteShiftAssignment);
router.put('/month/bulk', authenticate, authorize('employee','manager','admin'), controller.putMonthBulk);
router.post('/month/sync-salary',
  rateLimitNamed('attendance_sync_salary', { windowMs: 60_000, max: 5 }),
  authenticate, authorize('manager','admin'), controller.syncSalary);
router.put('/plan', authenticate, authorize('employee','manager','admin'), controller.putPlan);
router.get('/month/export.xlsx', authenticate, authorize('employee','manager','admin','payroll'), controller.exportMonthXlsx);
router.get('/user-profile', authenticate, authorize('employee','manager','admin'), controller.userProfileForMonthly);
router.get('/work-details', authenticate, authorize('employee','manager','admin','payroll'), controller.getWorkDetails);
router.post('/work-details',
  rateLimitNamed('attendance_work_details_post', { windowMs: 60_000, max: 30 }),
  authenticate, authorize('manager','admin'), controller.postWorkDetail);
router.put('/work-details/:id',
  rateLimitNamed('attendance_work_details_put', { windowMs: 60_000, max: 30 }),
  authenticate, authorize('manager','admin'), controller.putWorkDetail);
router.delete('/work-details/:id',
  rateLimitNamed('attendance_work_details_delete', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('manager','admin'), controller.deleteWorkDetail);
router.get('/shifts/definitions', authenticate, authorize('manager','admin','payroll'), controller.listShiftDefinitions);
router.post('/shifts/definitions',
  rateLimitNamed('attendance_shift_def_post', { windowMs: 60_000, max: 10 }),
  authenticate, authorize('manager','admin'), controller.postShiftDefinition);
router.delete('/shifts/definitions/:id',
  rateLimitNamed('attendance_shift_def_delete', { windowMs: 60_000, max: 10 }),
  authenticate, authorize('manager','admin'), controller.deleteShiftDefinition);
router.get('/export', authenticate, authorize('employee','manager','admin'), controller.exportCsv);
router.get('/calendar', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const r = await calendarRepo.computeYear(year);
    const useKoujiPolicy = await isKoujiFullTimeUser(req.user?.id);
    const detailBase = Array.isArray(r?.detail) ? r.detail : [];
    const { off } = buildOffSetFromCalendarDetail(detailBase, useKoujiPolicy);
    const detailPolicy = useKoujiPolicy
      ? detailBase.map(it => {
          const t = String(it?.type || '');
          if (t === 'saturday') return { ...it, is_off: 0 };
          return it;
        })
      : detailBase;
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
    const detail2 = Array.isArray(detailPolicy) ? detailPolicy.map(x => ({ ...x, label: labelOf(x.name, x.name_en || null) })) : detailPolicy;
    const r2 = {
      ...r,
      off_days: Array.from(off).sort(),
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
    const year = parseInt(String(date).slice(0, 4), 10);
    const cal = await calendarRepo.computeYear(year);
    const useKoujiPolicy = await isKoujiFullTimeUser(req.user?.id);
    const detail = Array.isArray(cal?.detail) ? cal.detail : [];
    const { off } = buildOffSetFromCalendarDetail(detail, useKoujiPolicy);
    const matched = detail.filter(it => String(it?.date || '').slice(0, 10) === date);
    const reasons = matched.map(it => {
      const t = String(it?.type || '');
      const specialOff = useKoujiPolicy
        ? (t === 'sunday' || t === 'saturday_last' || HOLIDAY_TYPES.has(t))
        : Number(it?.is_off || 0) === 1;
      return {
        type: t,
        name: it?.name || null,
        is_off: specialOff ? 1 : 0
      };
    });
    res.status(200).json({ date, is_off: off.has(date) ? 1 : 0, reasons });
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
if (allowDebugRoutes) {
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
  router.get('/debug/routes', authenticate, authorize('admin'), async (req, res) => {
    try {
      const list = (router.stack || [])
        .map(l => l.route ? { path: l.route.path, methods: Object.keys(l.route.methods || {}) } : null)
        .filter(Boolean);
      res.status(200).json({ routes: list });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  router.post('/debug/routes', authenticate, authorize('admin'), async (req, res) => {
    try {
      const list = (router.stack || [])
        .map(l => l.route ? { path: l.route.path, methods: Object.keys(l.route.methods || {}) } : null)
        .filter(Boolean);
      res.status(200).json({ routes: list });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  router.get('/debug/classify', authenticate, authorize('admin'), async (req, res) => {
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
  router.post('/debug/classify', authenticate, authorize('admin'), async (req, res) => {
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
}
router.get('/shifts/definitions', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const rows = await attendanceRepo.listShiftDefinitions();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/definitions', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, start_time, end_time, break_minutes, working_days } = req.body || {};
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ message: 'Missing name/start_time/end_time' });
    }
    const row = await attendanceRepo.upsertShiftDefinition({ name, start_time, end_time, break_minutes: break_minutes || 0, working_days });
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/assign', authenticate, authorize('admin','manager'), async (req, res) => {
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
