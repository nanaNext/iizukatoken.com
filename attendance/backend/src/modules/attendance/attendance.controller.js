const service = require('./attendance.service');
const auditRepo = require('../audit/audit.repository');
const rules = require('./attendance.rules');
const repo = require('./attendance.repository');
const { formatInputToMySQLJST } = require('../../utils/dateTime');
const userRepo = require('../users/user.repository');
const workReportRepo = require('../workReports/workReports.repository');
const salaryInputRepo = require('../salary/salaryInput.repository');
const { calculatePaidLeaveEntitlement } = require('../../utils/leaveRules');
// Controller xử lý request/response cho module chấm công

exports.checkIn = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }
    const b = req.body || {};
    
    // 1. Validation: Chặn thời gian ngoài khoảng 06:00 - 23:59 (Ưu tiên 1)
    const checkTimeRange = (timeInput) => {
      try {
        const d = timeInput ? new Date(timeInput) : new Date(Date.now() + 9 * 3600 * 1000);
        const hm = `${String(d.getUTCHours() + 9).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
        return hm >= '06:00' && hm <= '23:59';
      } catch { return true; }
    };
    if (!checkTimeRange(b?.time)) {
      return res.status(400).json({ message: 'Invalid time: Check-in must be between 06:00 and 23:59' });
    }

    const wt = String(b?.workType || b?.work_type || '').trim();
    const workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
    const loc = {
      latitude: b?.latitude,
      longitude: b?.longitude,
      accuracy: b?.accuracy,
      locationSource: b?.locationSource,
      countryCode: b?.countryCode,
      note: b?.note,
      deviceId: b?.deviceId,
      tzOffset: b?.tzOffset
    };
    const result = await service.checkIn(userId, b?.time, loc, workType);
    if (!result) {
      return res.status(409).json({ message: 'Already checked in' });
    }
    try {
      await auditRepo.writeLog({
        userId,
        action: 'checkin',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ ...loc, workType, result })
      });
    } catch {}
    try {
      const dtStr = String(result?.checkIn || b?.time || '').slice(0, 10) || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const y = parseInt(dtStr.slice(0, 4), 10);
      const m = parseInt(dtStr.slice(5, 7), 10);
      const st = await getMonthStatusValue(userId, y, m);
      if (st !== 'approved') await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
    } catch {}
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }
    const b = req.body || {};
    const loc = {
      latitude: b?.latitude,
      longitude: b?.longitude,
      accuracy: b?.accuracy,
      locationSource: b?.locationSource,
      countryCode: b?.countryCode,
      note: b?.note,
      deviceId: b?.deviceId,
      tzOffset: b?.tzOffset
    };
    const result = await service.checkOut(userId, b?.time, loc);
    if (!result) {
      return res.status(404).json({ message: 'No open attendance' });
    }
    try {
      await auditRepo.writeLog({
        userId,
        action: 'checkout',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ ...loc, result })
      });
    } catch {}
    try {
      const dtStr = String(result?.checkOut || result?.checkIn || b?.time || '').slice(0, 10) || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const y = parseInt(dtStr.slice(0, 4), 10);
      const m = parseInt(dtStr.slice(5, 7), 10);
      const st = await getMonthStatusValue(userId, y, m);
      if (st !== 'approved') await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
    } catch {}
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.setWorkType = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const b = req.body || {};
    const date = String(b.date || '').slice(0, 10) || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const wt = String(b?.workType || b?.work_type || '').trim();
    const workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
    const r = await require('./attendance.repository').setWorkTypeForUserDate(userId, date, workType);
    res.status(200).json({ date, workType, updated: Number(r?.updated || 0) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const { timesheetMaxDays } = require('../../config/env');
const { nowJSTMySQL } = require('../../utils/dateTime');
exports.userProfileForMonthly = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const requesterId = req.user?.id;
    let userId = req.query.userId ? parseInt(String(req.query.userId), 10) : requesterId;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    if (role === 'employee' && String(userId) !== String(requesterId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await userRepo.getUserById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const dept = user?.departmentId ? (await userRepo.getDepartmentById(user.departmentId)) : null;
    const db = require('../../core/database/mysql');
    await require('./attendance.repository').ensureWorkDetailsSchema();
    const [workRows] = await db.query(`
      SELECT id, start_date, end_date, company_name, work_place_address, work_content, role_title, responsibility_level
      FROM user_work_details
      WHERE userId = ?
      ORDER BY start_date DESC, id DESC
      LIMIT 10
    `, [userId]);
    let shift = null;
    const ym = String(req.query.ym || '').slice(0, 7);
    let targetDate = null;
    if (/^\d{4}-\d{2}$/.test(ym)) targetDate = ym + '-15';
    if (user?.shift_id) {
      const [srows] = await db.query(`SELECT id, name, start_time, end_time, break_minutes FROM shift_definitions WHERE id = ? LIMIT 1`, [user.shift_id]);
      if (srows && srows[0]) shift = srows[0];
    }
    if (!shift) {
      const refDate = targetDate || new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const [rowsAssign] = await db.query(`
        SELECT sd.id, sd.name, sd.start_time, sd.end_time, sd.break_minutes
        FROM user_shift_assignments usa
        JOIN shift_definitions sd ON sd.id = usa.shiftId
        WHERE usa.userId = ?
          AND (usa.start_date IS NULL OR usa.start_date <= ?)
          AND (usa.end_date IS NULL OR usa.end_date >= ?)
        ORDER BY usa.start_date DESC, usa.id DESC
        LIMIT 1
      `, [userId, refDate, refDate]);
      if (rowsAssign && rowsAssign[0]) shift = rowsAssign[0];
    }
    res.status(200).json({
      userId,
      contract: {
        employment_type: user?.employment_type || null,
        contract_type: user?.contract_type || null,
        base_salary: user?.base_salary || null,
        contract_end: user?.contract_end || null,
        departmentId: user?.departmentId || null,
        departmentName: dept?.name || null,
        shift: shift
      },
      workDetails: workRows || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.timesheet = async (req, res) => {
  try {
    const requesterId = req.user?.id;
    const userId = req.query.userId || requesterId;
    const fromDate = req.query.from;
    const toDate = req.query.to;
    if (!userId || !fromDate || !toDate) {
      return res.status(400).json({ message: 'Missing userId/from/to' });
    }
    const from = new Date(fromDate + 'T00:00:00Z');
    const to = new Date(toDate + 'T23:59:59Z');
    const maxSpanDays = timesheetMaxDays > 0 ? timesheetMaxDays : 0;
    const spanDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (maxSpanDays > 0 && spanDays > maxSpanDays) {
      return res.status(400).json({ message: 'Range too large: limit 3 months' });
    }
    if (req.user?.role === 'employee' && String(userId) !== String(requesterId)) {
      return res.status(403).json({ message: 'Forbidden: employees can only view their own timesheet' });
    }
    const result = await service.timesheet(userId, fromDate, toDate);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.gpsLog = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lat, lng, accuracy, at } = req.body || {};
    if (!userId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Missing userId/lat/lng' });
    }
    await auditRepo.writeLog({
      userId,
      action: 'gps',
      path: '/api/attendance/gps',
      method: 'POST',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      beforeData: null,
      afterData: JSON.stringify({ lat, lng, accuracy, at: at || new Date().toISOString() })
    });
    res.status(201).json({ message: 'GPS logged' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.syncOffline = async (req, res) => {
  try {
    const userId = req.user?.id;
    const events = req.body?.events;
    if (!userId || !Array.isArray(events)) {
      return res.status(400).json({ message: 'Missing userId/events' });
    }
    const results = [];
    for (const ev of events) {
      if (ev.type === 'checkin') {
        const ms = Math.floor(new Date(ev.time || Date.now()).getTime() / 60000) * 60000;
        const t = formatInputToMySQLJST(ms);
        const dup = await repo.findCheckInByTime(userId, t);
        if (dup) {
          results.push({ type: 'checkin', ok: true, id: dup.id, duplicate: true });
          continue;
        }
        const r = await service.checkIn(userId, t);
        try {
          await auditRepo.writeLog({ userId, action: 'offline_checkin', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ time: t }) });
        } catch {}
        results.push({ type: 'checkin', ok: true, id: r.id });
      } else if (ev.type === 'checkout') {
        const ms = Math.floor(new Date(ev.time || Date.now()).getTime() / 60000) * 60000;
        const t = formatInputToMySQLJST(ms);
        const dup = await repo.findCheckOutByTime(userId, t);
        if (dup) {
          results.push({ type: 'checkout', ok: true, id: dup.id, duplicate: true });
          continue;
        }
        const r = await service.checkOut(userId, t);
        try {
          await auditRepo.writeLog({ userId, action: 'offline_checkout', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ time: t }) });
        } catch {}
        results.push({ type: 'checkout', ok: !!r, id: r?.id || null });
      } else {
        results.push({ type: ev.type, ok: false, error: 'unknown type' });
      }
    }
    res.status(200).json({ synced: results.length, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.statusToday = async (req, res) => {
  try {
    const userId = req.user?.id;
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const qDate = String(req.query?.date || '').slice(0, 10);
    const date = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : today;
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }
    const range = await service.timesheet(userId, date, date);
    const open = date === today ? await require('./attendance.repository').getOpenAttendanceForUser(userId) : null;
    res.status(200).json({
      date,
      open: !!open,
      attendance: open ? { id: open.id, checkIn: open.checkIn || null, checkOut: open.checkOut || null } : null,
      timesheet: range
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.todaySummary = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const db = require('../../core/database/mysql');
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

    const [[{ c_checkin } = { c_checkin: 0 }]] = await db.query(`
      SELECT COUNT(DISTINCT userId) AS c_checkin
      FROM attendance
      WHERE DATE(checkIn) = CURDATE()
    `);
    const [[{ c_open } = { c_open: 0 }]] = await db.query(`
      SELECT COUNT(DISTINCT userId) AS c_open
      FROM attendance
      WHERE DATE(checkIn) = CURDATE() AND checkOut IS NULL
    `);
    const [[{ c_active } = { c_active: 0 }]] = await db.query(`
      SELECT COUNT(*) AS c_active
      FROM users
      WHERE employment_status = 'active'
        AND role IN ('employee','manager')
    `);
    let c_leave_users = 0;
    try {
      const [[{ c_leave_users: x } = { c_leave_users: 0 }]] = await db.query(`
        SELECT COUNT(DISTINCT userId) AS c_leave_users
        FROM leave_requests
        WHERE status = 'approved'
          AND CURDATE() BETWEEN startDate AND endDate
      `);
      c_leave_users = Number(x || 0);
    } catch {}
    const target = Math.max(0, Number(c_active || 0) - Number(c_leave_users || 0));
    const notCheckedIn = Math.max(0, target - Number(c_checkin || 0));
    const notCheckedOut = Number(c_open || 0);

    const open = await require('./attendance.repository').getOpenAttendanceForUser(userId);
    const [myRows] = await db.query(`
      SELECT id, checkIn, checkOut
      FROM attendance
      WHERE userId = ?
        AND DATE(checkIn) = CURDATE()
      ORDER BY checkIn DESC
      LIMIT 1
    `, [userId]);
    const my = myRows && myRows[0] ? myRows[0] : null;

    res.status(200).json({
      date: today,
      counts: {
        targetEmployees: target,
        checkIn: Number(c_checkin || 0),
        notCheckedIn,
        notCheckedOut,
        activeEmployees: Number(c_active || 0),
        leaveUsers: Number(c_leave_users || 0)
      },
      me: {
        open: !!open,
        attendanceId: my?.id || null,
        checkIn: my?.checkIn || null,
        checkOut: my?.checkOut || null
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.todayRoster = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const db = require('../../core/database/mysql');
    const attendanceRepo = require('./attendance.repository');
    const qDate = String(req.query?.date || '').slice(0, 10);
    const date = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const [rows] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.role AS role,
        u.departmentId AS departmentId,
        d.name AS departmentName,
        a.id AS attendanceId,
        a.shiftId AS shiftId,
        a.checkIn AS checkIn,
        a.checkOut AS checkOut,
        ad.kubun AS dailyKubun
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.departmentId
      LEFT JOIN leave_requests lr
        ON lr.userId = u.id
       AND lr.status = 'approved'
       AND ? BETWEEN lr.startDate AND lr.endDate
      LEFT JOIN attendance_daily ad
        ON ad.userId = u.id AND ad.date = ?
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
      return {
        userId: r.userId,
        employeeCode: r.employeeCode || null,
        username: r.username || null,
        departmentId: r.departmentId || null,
        departmentName: r.departmentName || null,
        role: r.role || null,
        dailyKubun: r.dailyKubun || null,
        attendance: {
          id: r.attendanceId || null,
          shiftId: r.shiftId || null,
          checkIn: r.checkIn || null,
          checkOut: r.checkOut || null
        },
        status
      };
    });

    const [plannedBase] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        u.role AS role,
        u.departmentId AS departmentId,
        d.name AS departmentName,
        CASE WHEN lr.id IS NULL THEN 0 ELSE 1 END AS isLeave,
        lr.type AS leaveType
      FROM users u
      LEFT JOIN departments d
        ON d.id = u.departmentId
      LEFT JOIN leave_requests lr
        ON lr.userId = u.id
       AND lr.status = 'approved'
       AND ? BETWEEN lr.startDate AND lr.endDate
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC
    `, [date]);
    const planned = [];
    for (const r of plannedBase || []) {
      let shift = null;
      try {
        const assign = await attendanceRepo.getActiveAssignment(r.userId, date);
        if (assign?.shiftId) {
          const def = await attendanceRepo.getShiftById(assign.shiftId);
          shift = def ? { id: def.id, name: def.name, start_time: def.start_time, end_time: def.end_time } : null;
        } else if (Object.prototype.hasOwnProperty.call(assign || {}, 'shift') && assign.shift) {
          const [defs] = await db.query(`SELECT * FROM shift_definitions WHERE name = ? LIMIT 1`, [assign.shift]);
          const def = defs && defs[0] ? defs[0] : null;
          shift = def ? { id: def.id, name: def.name, start_time: def.start_time, end_time: def.end_time } : null;
        } else if (r.shiftId) {
          const def2 = await attendanceRepo.getShiftById(r.shiftId).catch(() => null);
          shift = def2 ? { id: def2.id, name: def2.name, start_time: def2.start_time, end_time: def2.end_time } : null;
        }
      } catch {}
      planned.push({
        userId: r.userId,
        employeeCode: r.employeeCode || null,
        username: r.username || null,
        role: r.role || null,
        departmentId: r.departmentId || null,
        departmentName: r.departmentName || null,
        planned: {
          status: Number(r.isLeave || 0) ? 'leave' : 'work',
          leaveType: r.leaveType || null,
          shift
        }
      });
    }
    res.status(200).json({ date, items, planned });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function parseMonth(s) {
  const [y, m] = String(s).split('-');
  const yy = parseInt(y, 10), mm = parseInt(m, 10);
  if (!yy || !mm || mm < 1 || mm > 12) return null;
  return { y: yy, m: mm };
}
function isEditableMonth(y, m) {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const cy = now.getUTCFullYear();
  const cm = now.getUTCMonth() + 1;
  const idx = Number(y) * 12 + Number(m);
  const cidx = cy * 12 + cm;
  // Cho phép tháng hiện tại và tháng kế tiếp
  return idx === cidx || idx === cidx + 1;
}

async function resolveTargetUserId(req) {
  const role = String(req.user?.role || '').toLowerCase();
  const meId = req.user?.id;
  const raw = (req.query?.userId ?? req.body?.userId ?? null);
  const targetId = raw == null || raw === '' ? meId : parseInt(String(raw), 10);
  if (!meId || !targetId) return null;
  if (role === 'employee') return meId;
  if (role === 'manager' && String(targetId) !== String(meId)) {
    const me = await userRepo.getUserById(meId);
    const target = await userRepo.getUserById(targetId);
    if (!target) return null;
    if (!me?.departmentId || String(me.departmentId) !== String(target.departmentId)) {
      return '__forbidden__';
    }
  }
  return targetId;
}

async function getMonthStatusValue(userId, year, month) {
  try {
    const r = await repo.getMonthStatus(userId, year, month);
    const st = String(r?.status || '').trim();
    return st || 'draft';
  } catch {
    return 'draft';
  }
}

async function assertMonthWritable(req, targetUserId, year, month) {
  const role = String(req.user?.role || '').toLowerCase();
  const meId = req.user?.id;
  const y = parseInt(String(year), 10);
  const m = parseInt(String(month), 10);
  if (role === 'employee' && !isEditableMonth(y, m)) {
    const e = new Error('Forbidden: employees can only edit current month');
    e.status = 403;
    throw e;
  }
  const st = await getMonthStatusValue(targetUserId, y, m);
  if (st === 'approved') {
    const e = new Error('Locked: month is closed');
    e.status = 423;
    throw e;
  }
  if (st === 'submitted' && role === 'payroll') {
    const e = new Error('Locked: month is submitted');
    e.status = 423;
    throw e;
  }
}

async function computeMonthMissing(userId, y, m) {
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${pad(m)}-01`;
  const to = `${y}-${pad(m)}-${pad(lastDay)}`;
  const calendarRepo = require('../calendar/calendar.repository');
  const cal = await calendarRepo.computeYear(y).catch(() => null);
  const off = new Set();
  try {
    const detail = Array.isArray(cal?.detail) ? cal.detail : [];
    for (const it of detail) {
      const ds = String(it?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
      if (Number(it?.is_off || 0) === 1) off.add(ds);
    }
  } catch {}
  const dailyRows = await repo.listDailyBetween(userId, from, to).catch(() => []);
  const dailyKubun = new Map((dailyRows || []).map(r => [String(r?.date || '').slice(0, 10), String(r?.kubun || '').trim()]));
  const segRows = await repo.listByUserBetween(userId, from, to).catch(() => []);
  const segByDate = new Map();
  for (const r of segRows || []) {
    const ds = String(r?.checkIn || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
    if (!segByDate.has(ds)) segByDate.set(ds, []);
    segByDate.get(ds).push(r);
  }
  const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
  const missing = [];
  for (let day = 1; day <= lastDay; day++) {
    const ds = `${y}-${pad(m)}-${pad(day)}`;
    const dow = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(y, m - 1, day, 0, 0, 0)).getUTCDay()];
    const isOff = off.has(ds) || dow === '日' || dow === '土';
    const k0 = dailyKubun.get(ds) || '';
    const allowedNormal = new Set(['', '出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日']);
    const allowedOff = new Set(['休日', '休日出勤', '代替出勤']);
    const kubun = (isOff ? (allowedOff.has(k0) ? k0 : '休日') : (allowedNormal.has(k0) ? (k0 || '出勤') : '出勤'));
    const segs = segByDate.get(ds) || [];
    const hasComplete = segs.some(s => !!s?.checkIn && !!s?.checkOut);
    const isWork = workKubunSet.has(kubun);
    if (isWork && !hasComplete) {
      missing.push(ds);
    }
  }
  return missing;
}

exports.getMonthStatus = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.query || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const r = await repo.getMonthStatus(userId, year, month);
    const status = String(r?.status || '').trim() || 'draft';
    res.status(200).json({
      userId,
      year: parseInt(String(year), 10),
      month: parseInt(String(month), 10),
      status,
      submitted_at: r?.submitted_at || null,
      submitted_by: r?.submitted_by || null,
      approved_at: r?.approved_at || null,
      approved_by: r?.approved_by || null,
      approved_by_name: r?.approved_by_name || null,
      unlocked_at: r?.unlocked_at || null,
      unlocked_by: r?.unlocked_by || null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMonthStatusBulk = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const { userIds, year, month } = req.query || {};
    if (!userIds || !year || !month) return res.status(400).json({ message: 'Missing userIds/year/month' });
    const ids = String(userIds).split(',').map(s => parseInt(s, 10)).filter(Boolean);
    if (!ids.length) return res.status(200).json([]);
    const rows = await repo.getMonthStatusBulk(ids, year, month);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(lastDay)}`;
    const calendarRepo = require('../calendar/calendar.repository');
    const cal = await calendarRepo.computeYear(y).catch(() => null);
    const off = new Set();
    try {
      const detail = Array.isArray(cal?.detail) ? cal.detail : [];
      for (const it of detail) {
        const ds = String(it?.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
        if (Number(it?.is_off || 0) === 1) off.add(ds);
      }
    } catch {}
    const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
    const enrich = async (uid) => {
      try {
        const dailyRows = await repo.listDailyBetween(uid, from, to).catch(() => []);
        const dailyKubun = new Map((dailyRows || []).map(r => [String(r?.date || '').slice(0, 10), String(r?.kubun || '').trim()]));
        const segRows = await repo.listByUserBetween(uid, from, to).catch(() => []);
        const segByDate = new Map();
        for (const r of segRows || []) {
          const ds = String(r?.checkIn || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
          if (!segByDate.has(ds)) segByDate.set(ds, []);
          segByDate.get(ds).push(r);
        }
        let missing = 0;
        for (let day = 1; day <= lastDay; day++) {
          const ds = `${y}-${pad(m)}-${pad(day)}`;
          const dow = ['日', '月', '火', '水', '木', '金', '土'][new Date(Date.UTC(y, m - 1, day, 0, 0, 0)).getUTCDay()];
          const isOff = off.has(ds) || dow === '日' || dow === '土';
          const k0 = dailyKubun.get(ds) || '';
          const allowedNormal = new Set(['', '出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日']);
          const allowedOff = new Set(['休日', '休日出勤', '代替出勤']);
          const kubun = (isOff ? (allowedOff.has(k0) ? k0 : '休日') : (allowedNormal.has(k0) ? (k0 || '出勤') : '出勤'));
          const segs = segByDate.get(ds) || [];
          const hasComplete = segs.some(s => !!s?.checkIn && !!s?.checkOut);
          const isWork = workKubunSet.has(kubun);
          if (isWork && !hasComplete) missing++;
        }
        return { ready: missing === 0, missingCount: missing };
      } catch {
        return { ready: false, missingCount: null };
      }
    };
    const readyMap = new Map();
    for (const id of ids) {
      readyMap.set(String(id), await enrich(id));
    }
    res.status(200).json(rows.map(r => {
      const extra = readyMap.get(String(r.userId)) || { ready: false, missingCount: null };
      return {
        userId: r.userId,
        year: r.year,
        month: r.month,
        status: r.status,
        ready: !!extra.ready,
        missing_count: extra.missingCount,
        submitted_at: r.submitted_at || null,
        submitted_by: r.submitted_by || null,
        approved_at: r.approved_at || null,
        approved_by: r.approved_by || null,
        approved_by_name: r.approved_by_name || null
      };
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitMonth = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.body || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (String(req.user?.role || '').toLowerCase() === 'employee' && !isEditableMonth(y, m)) {
      return res.status(403).json({ message: 'Forbidden: cannot submit past months' });
    }
    const status = await getMonthStatusValue(userId, y, m);
    if (status === 'approved') return res.status(409).json({ message: 'Locked: month is closed' });

    try {
      const missing = await computeMonthMissing(userId, y, m);
      if (missing.length) {
        return res.status(400).json({ message: `入力が未完了です`, missing });
      }
    } catch {}

    await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
    res.status(200).json({ ok: true, userId, year: y, month: m, status: 'submitted' });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};

exports.getMonthMissing = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const allow = role === 'admin' || role === 'manager';
    if (!allow) return res.status(403).json({ message: 'Forbidden' });
    const { userId, year, month } = req.query || {};
    const uid = parseInt(String(userId), 10);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (!uid || !y || !m) return res.status(400).json({ message: 'Missing userId/year/month' });
    const missing = await computeMonthMissing(uid, y, m);
    res.status(200).json({ userId: uid, year: y, month: m, missing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveReadyMonth = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const allow = role === 'admin' || role === 'manager';
    if (!allow) return res.status(403).json({ message: 'Forbidden' });
    const { month, departmentId } = req.body || {};
    const ym = String(month || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) return res.status(400).json({ message: 'Missing month (YYYY-MM)' });
    const y = parseInt(ym.slice(0, 4), 10);
    const m = parseInt(ym.slice(5, 7), 10);
    const db = require('../../core/database/mysql');
    const params = [];
    let sql = `
      SELECT u.id AS userId
      FROM users u
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
    `;
    if (departmentId != null) {
      sql += ` AND u.departmentId = ?`;
      params.push(parseInt(String(departmentId), 10));
    }
    const [rows] = await db.query(sql, params);
    let approved = 0, submitted = 0, skipped = 0;
    const results = [];
    for (const r of (rows || [])) {
      const uid = Number(r.userId);
      const st = await repo.getMonthStatus(uid, y, m).catch(() => null);
      const status = String(st?.status || '').trim() || 'draft';
      const missing = await computeMonthMissing(uid, y, m).catch(() => ['error']);
      if (missing && missing.length) {
        results.push({ userId: uid, status, ok: false, reason: 'missing_days', missing });
        skipped++;
        continue;
      }
      if (status !== 'submitted') {
        await repo.setMonthStatus(uid, y, m, 'submitted', req.user?.id).catch(() => {});
        submitted++;
      }
      await repo.setMonthStatus(uid, y, m, 'approved', req.user?.id).catch(() => {});
      approved++;
      results.push({ userId: uid, status: 'approved', ok: true });
    }
    res.status(200).json({ month: ym, approved, submitted, skipped, results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.approveMonth = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.body || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    const status = await getMonthStatusValue(userId, y, m);
    if (status !== 'submitted') {
      await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
    }
    try {
      const missing = await computeMonthMissing(userId, y, m);
      if (missing.length) {
        return res.status(400).json({ message: `未承認: 勤務未入力の日があります`, missing });
      }
    } catch {}
    await repo.setMonthStatus(userId, y, m, 'approved', req.user?.id);
    res.status(200).json({ ok: true, userId, year: y, month: m, status: 'approved' });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};

exports.unlockMonth = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    const { year, month } = req.body || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    await repo.setMonthStatus(userId, y, m, 'unlocked', req.user?.id);
    res.status(200).json({ ok: true, userId, year: y, month: m, status: 'unlocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDay = async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.params.date;
    if (!userId || !date) return res.status(400).json({ message: 'Missing date' });
    const rows = await repo.listByUserBetween(userId, date, date);
    res.status(200).json({ date, segments: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDaily = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const date = String(req.params.date || '').slice(0, 10);
    if (!userId || !date) return res.status(400).json({ message: 'Missing date' });
    const daily = await repo.getDaily(userId, date);
    res.status(200).json({ date, daily });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.putDaily = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const date = String(req.params.date || '').slice(0, 10);
    if (!userId || !date) return res.status(400).json({ message: 'Missing date' });
    const y = parseInt(date.slice(0, 4), 10);
    const m = parseInt(date.slice(5, 7), 10);
    await assertMonthWritable(req, userId, y, m);
    if (req.user.role === 'employee' && !isEditableMonth(y, m)) {
      return res.status(403).json({ message: 'Forbidden: cannot edit past months' });
    }
    await repo.upsertDaily(userId, date, req.body || {});
    const daily = await repo.getDaily(userId, date);
  try {
    const y = parseInt(date.slice(0, 4), 10);
    const m = parseInt(date.slice(5, 7), 10);
    const st = await getMonthStatusValue(userId, y, m);
    if (st !== 'approved') await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
  } catch {}
    res.status(200).json({ date, daily });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};
exports.putDay = async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.params.date;
    if (!userId || !date) return res.status(400).json({ message: 'Missing date' });
    const y = parseInt(date.slice(0,4),10), m = parseInt(date.slice(5,7),10);
    await assertMonthWritable(req, userId, y, m);
    if (req.user.role === 'employee' && !isEditableMonth(y,m)) {
      return res.status(403).json({ message: 'Forbidden: cannot edit past months' });
    }

    const { attendanceId, checkIn, checkOut } = req.body || {};
    if (!attendanceId) return res.status(400).json({ message: 'Missing attendanceId' });
    const row = await repo.getById(attendanceId);
    if (!row || String(row.userId) !== String(userId)) {
      return res.status(404).json({ message: 'Attendance not found' });
    }
    const nextIn = (typeof checkIn === 'undefined') ? row.checkIn : (checkIn || null);
    const nextOut = (typeof checkOut === 'undefined') ? row.checkOut : (checkOut || null);
    
    // Bypass strict future check to allow setting end of day time before the end of day.
    const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    if (date > todayStr) {
      // return res.status(400).json({ message: 'Cannot set future attendance times' });
    }

    await repo.updateTimes(attendanceId, nextIn, nextOut);
  try {
    const st = await getMonthStatusValue(userId, y, m);
    if (st !== 'approved') await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
  } catch {}
    res.status(200).json({ id: attendanceId });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};
exports.addSegment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.params.date;
    const { checkIn, checkOut } = req.body || {};
    if (!userId || !date || !checkIn) return res.status(400).json({ message: 'Missing checkIn' });
    const y = parseInt(date.slice(0,4),10), m = parseInt(date.slice(5,7),10);
    await assertMonthWritable(req, userId, y, m);
    if (req.user.role === 'employee' && !isEditableMonth(y,m)) {
      return res.status(403).json({ message: 'Forbidden: cannot edit past months' });
    }
    
    const id = await repo.createCheckIn(userId, checkIn, null, null);
    if (checkOut) {
      await repo.setCheckOut(id, checkOut, null, null);
    }
  try {
    const y = parseInt(date.slice(0,4),10), m = parseInt(date.slice(5,7),10);
    const st = await getMonthStatusValue(userId, y, m);
    if (st !== 'approved') await repo.setMonthStatus(userId, y, m, 'submitted', req.user?.id);
  } catch {}
    res.status(201).json({ id });
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};
exports.deleteSegment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const id = parseInt(req.params.id, 10);
    if (!userId || !id) return res.status(400).json({ message: 'Missing id' });
    const row = await repo.getById(id);
    if (!row || String(row.userId) !== String(userId)) {
      return res.status(404).json({ message: 'Attendance not found' });
    }
    try {
      const ds = String(row.checkIn || row.checkOut || '').slice(0, 10);
      const y = parseInt(ds.slice(0, 4), 10);
      const m = parseInt(ds.slice(5, 7), 10);
      if (y && m) await assertMonthWritable(req, userId, y, m);
    } catch (e) {
      return res.status(Number(e?.status || 500)).json({ message: e.message });
    }
    await require('../../core/database/mysql').query(`DELETE FROM attendance WHERE id = ?`, [id]);
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.submitDay = async (req, res) => {
  try {
    const userId = req.user?.id;
    const date = req.params.date;
    if (!userId || !date) return res.status(400).json({ message: 'Missing date' });
    const rows = await repo.listByUserBetween(userId, date, date);
    for (const r of rows) {
      await require('../../core/database/mysql').query(`UPDATE attendance SET labels = CONCAT_WS(',', labels, 'submitted') WHERE id = ?`, [r.id]);
    }
    res.status(200).json({ submitted: rows.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getMonth = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.query || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const pad = n => String(n).padStart(2,'0');
    const y = parseInt(year,10), m = parseInt(month,10);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    let to = `${y}-${pad(m)}-${pad(lastDay)}`;
    const role = String(req.user?.role || '').toLowerCase();
    const status = await getMonthStatusValue(userId, y, m);
    if (role === 'payroll' && status !== 'approved') {
      return res.status(403).json({ message: 'Forbidden: month is not closed' });
    }
    try {
      const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      if (role !== 'payroll' && status !== 'approved') {
        if (todayStr < from) {
          to = from;
        } else if (to > todayStr) {
          to = todayStr;
        }
      }
    } catch {}
    const result = await service.timesheet(userId, from, to);
    res.status(200).json({ ...result, monthStatus: { status } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getMonthDetail = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.query || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const pad = n => String(n).padStart(2,'0');
    const y = parseInt(year,10), m = parseInt(month,10);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(lastDay)}`;
    const role = String(req.user?.role || '').toLowerCase();
    const monthStatusObj = await repo.getMonthStatus(userId, y, m);
    const monthStatus = monthStatusObj?.status || 'draft';
    const approverName = monthStatusObj?.approved_by_name || null;
    if (role === 'payroll' && monthStatus !== 'approved') {
      return res.status(403).json({ message: 'Forbidden: month is not closed' });
    }
    let rows = [];
    let todayStr = null;
    try { todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); } catch {}
    if (role !== 'payroll' && monthStatus !== 'approved' && todayStr && todayStr < from) {
      rows = [];
    } else {
      rows = await repo.listByUserBetween(userId, from, to);
    }
    const dailyRows = await repo.listDailyBetween(userId, from, to).catch(() => []);
    const planRows = await repo.listPlanBetween(userId, from, to).catch(() => []);
    const workReportRows = await workReportRepo.listByUserMonth(userId, `${y}-${pad(m)}`).catch(() => []);
    const calendarRepo = require('../calendar/calendar.repository');
    const cal = await calendarRepo.computeYear(y).catch(() => null);
    const off = new Set();
    try {
      const detail = Array.isArray(cal?.detail) ? cal.detail : [];
      const byDate = new Map();
      for (const it of detail) {
        const ds = String(it?.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
        if (!byDate.has(ds)) byDate.set(ds, []);
        byDate.get(ds).push({
          type: String(it?.type || ''),
          is_off: Number(it?.is_off || 0) === 1
        });
      }
      const addDaysUTC = (dateStr, n) => {
        const yy = parseInt(String(dateStr).slice(0, 4), 10);
        const mm = parseInt(String(dateStr).slice(5, 7), 10) - 1;
        const dd = parseInt(String(dateStr).slice(8, 10), 10);
        const dt = new Date(Date.UTC(yy, mm, dd, 0, 0, 0));
        dt.setUTCDate(dt.getUTCDate() + n);
        const y2 = dt.getUTCFullYear();
        const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d2 = String(dt.getUTCDate()).padStart(2, '0');
        return `${y2}-${m2}-${d2}`;
      };
      const isHolidayType = (t) => {
        if (t === 'fixed') return true;
        if (t === 'jp_auto') return true;
        if (t === 'jp_substitute') return true;
        if (t === 'jp_bridge') return true;
        return false;
      };
      const isNonWeekendHoliday = (ds) => {
        const list = byDate.get(ds) || [];
        return list.some(x => x.is_off && isHolidayType(x.type));
      };
      const hasValidBridge = (ds) => {
        const list = byDate.get(ds) || [];
        const hasBridge = list.some(x => x.is_off && x.type === 'jp_bridge');
        if (!hasBridge) return false;
        const prev = addDaysUTC(ds, -1);
        const next = addDaysUTC(ds, 1);
        return isNonWeekendHoliday(prev) && isNonWeekendHoliday(next);
      };
      for (const [ds, list] of byDate.entries()) {
        const hasSunday = list.some(x => x.is_off && x.type === 'sunday');
        if (hasSunday) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'saturday_last')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'fixed')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'jp_auto')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'jp_substitute')) off.add(ds);
        if (hasValidBridge(ds)) off.add(ds);
      }
    } catch {}
    const shiftDefs = await repo.listShiftDefinitions().catch(() => []);
    const shiftById = new Map((shiftDefs || []).map(s => [String(s.id), s]));
    const shiftByName = new Map((shiftDefs || []).map(s => [String(s.name), s]));
    const assigns = await repo.listShiftAssignmentsBetween(userId, from, to).catch(() => []);
    const resolveDefForAssign = (a) => {
      let def = null;
      const sid = a?.shiftId != null ? String(a.shiftId) : '';
      if (sid) def = shiftById.get(sid) || null;
      if (!def) {
        const nm = a?.shift != null ? String(a.shift) : '';
        if (nm) def = shiftByName.get(nm) || null;
      }
      return def;
    };
    const days = [];
    const map = new Map();
    const toMySQLDateTime = (v) => {
      if (!v) return '';
      if (typeof v === 'string') {
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s.replace('T', ' ').slice(0, 19);
        return s;
      }
      try {
        return formatInputToMySQLJST(v);
      } catch {
        return String(v || '');
      }
    };
    for (const r of (rows || [])) {
      const inStr = toMySQLDateTime(r.checkIn);
      const outStr = toMySQLDateTime(r.checkOut);
      const d = String(inStr || '').slice(0, 10) || String(outStr || '').slice(0, 10);
      if (!d) continue;
      if (!map.has(d)) map.set(d, []);
      map.get(d).push({
        id: r.id,
        checkIn: inStr || null,
        checkOut: outStr || null,
        shiftId: r.shiftId || null,
        workType: r.work_type || null,
        labels: r.labels || null
      });
    }
    const reportMap = new Map();
    for (const r of workReportRows || []) {
      const d = String(r?.date || '').slice(0, 10);
      if (!d) continue;
      reportMap.set(d, {
        workType: r?.work_type || null,
        location: r?.site || null,
        memo: r?.work || null
      });
    }
    const dailyMap = new Map();
    for (const r of dailyRows || []) {
      const d = String(r?.date || '').slice(0, 10);
      if (!d) continue;
      const report = reportMap.get(d) || null;
      const kc = (() => {
        try {
          const raw = Number(r.kubun_confirmed || 0);
          if (raw) return 1;
          const k = String(r.kubun || '').trim();
          return k ? 1 : 0;
        } catch {
          return 0;
        }
      })();
      dailyMap.set(d, {
        kubun: r.kubun || null,
        kubunConfirmed: kc,
        workType: r.work_type || report?.workType || null,
        location: r.location || report?.location || null,
        reason: r.reason || null,
        memo: r.memo || report?.memo || null,
        breakMinutes: r.break_minutes == null ? null : Number(r.break_minutes),
        nightBreakMinutes: r.night_break_minutes == null ? null : Number(r.night_break_minutes),
        status: r.status || null
      });
    }
    for (const [d, report] of reportMap.entries()) {
      if (dailyMap.has(d)) continue;
      dailyMap.set(d, {
        kubun: null,
        kubunConfirmed: 0,
        workType: report?.workType || null,
        location: report?.location || null,
        reason: null,
        memo: report?.memo || null,
        breakMinutes: null,
        nightBreakMinutes: null
      });
    }
    const shiftForDate = (ds) => {
      let best = null;
      for (const a of assigns || []) {
        const sd = String(a?.start_date || '').slice(0, 10);
        if (!sd || sd > ds) continue;
        const ed = a?.end_date ? String(a.end_date).slice(0, 10) : '';
        if (ed && ed < ds) continue;
        best = a;
      }
      if (!best) return null;
      const def = resolveDefForAssign(best);
      if (!def) return null;
      return {
        id: def.id,
        name: def.name,
        start_time: def.start_time,
        end_time: def.end_time,
        break_minutes: def.break_minutes,
        standard_minutes: def.standard_minutes
      };
    };
    const shiftAssignments = (assigns || []).map(a => {
      const def = resolveDefForAssign(a);
      return {
        id: a?.id || null,
        start_date: String(a?.start_date || '').slice(0, 10) || null,
        end_date: a?.end_date ? String(a.end_date).slice(0, 10) : null,
        shift: def ? {
          id: def.id,
          name: def.name,
          start_time: def.start_time,
          end_time: def.end_time,
          break_minutes: def.break_minutes,
          standard_minutes: def.standard_minutes
        } : null
      };
    });
    const workDetailsRows = await repo.listWorkDetailsBetween(userId, from, to).catch(() => []);
    const workDetails = (workDetailsRows || []).map(r => ({
      id: r.id,
      startDate: String(r.start_date || '').slice(0, 10) || null,
      endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
      companyName: r.company_name || null,
      workPlaceAddress: r.work_place_address || null,
      workContent: r.work_content || null,
      roleTitle: r.role_title || null,
      responsibilityLevel: r.responsibility_level || null
    }));
    const monthSummaryRow = await repo.getMonthSummary(userId, y, m).catch(() => null);
    const monthSummary = (() => {
      if (!monthSummaryRow) return null;
      const safeParse = (s) => {
        try { return s ? JSON.parse(String(s)) : null; } catch { return null; }
      };
      return {
        all: safeParse(monthSummaryRow.summary_all),
        inhouse: safeParse(monthSummaryRow.summary_inhouse),
        updatedBy: monthSummaryRow.updated_by || null,
        updatedAt: monthSummaryRow.updated_at || null
      };
    })();
    const leaveSummary = await (async () => {
      const daysBetweenInclusive = (a, b) => {
        const ms = 24 * 60 * 60 * 1000;
        const d1 = new Date(String(a).slice(0, 10) + 'T00:00:00Z');
        const d2 = new Date(String(b).slice(0, 10) + 'T00:00:00Z');
        return Math.max(0, Math.ceil((d2 - d1) / ms) + 1);
      };
      const overlapDays = (aStart, aEnd, bStart, bEnd) => {
        const s = aStart > bStart ? aStart : bStart;
        const e = aEnd < bEnd ? aEnd : bEnd;
        if (s > e) return 0;
        return daysBetweenInclusive(s, e);
      };
      try {
        const leaveRepo = require('../leave/leave.repository');
        const all = await leaveRepo.listByUser(userId).catch(() => []);
        let paidDays = 0;
        let substituteDays = 0;
        let unpaidDays = 0;
        let standbyDays = 0;
        for (const r of (all || [])) {
          if (String(r?.status || '') !== 'approved') continue;
          const s = String(r?.startDate || '').slice(0, 10);
          const e = String(r?.endDate || '').slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) continue;
          const ov = overlapDays(s, e, from, to);
          if (ov <= 0) continue;
          const t = String(r?.type || '').toLowerCase();
          if (t === 'paid') paidDays += ov;
          else if (t.includes('sub') || t.includes('daikyu') || t.includes('comp')) substituteDays += ov;
          else if (t.includes('unpaid') || t.includes('nopay') || t.includes('no_pay')) unpaidDays += ov;
          else if (t.includes('standby') || t.includes('wait') || t.includes('taiki')) standbyDays += ov;
        }
        return { paidDays, substituteDays, unpaidDays, standbyDays };
      } catch {
        return { paidDays: 0, substituteDays: 0, unpaidDays: 0, standbyDays: 0 };
      }
    })();
    for (let day = 1; day <= lastDay; day++) {
      const ds = `${y}-${pad(m)}-${pad(day)}`;
      const plan = planRows.find(p => String(p.date).slice(0, 10) === ds) || null;
      days.push({ 
        date: ds, 
        is_off: off.has(ds) ? 1 : 0, 
        shift: shiftForDate(ds), 
        daily: dailyMap.get(ds) || null, 
        plan: plan ? {
          shiftId: plan.shiftId,
          workType: plan.work_type,
          location: plan.location,
          memo: plan.memo
        } : null,
        segments: map.get(ds) || [] 
      });
    }
    const u = await userRepo.getUserById(userId).catch(() => null);
    const paidLeaveEntitlement = calculatePaidLeaveEntitlement(u?.join_date || u?.hire_date);
    const user = u ? {
      id: u.id,
      employee_code: u.employee_code || null,
      employeeCode: u.employee_code || null,
      username: u.username || null,
      email: u.email || null,
      departmentId: u.departmentId || null,
      departmentName: u.departmentName || null,
      office_code: u.office_code || null,
      officeCode: u.office_code || null,
      paidLeaveEntitlement: paidLeaveEntitlement
    } : null;
    res.status(200).json({
      year: y,
      month: m,
      from,
      to,
      user,
      monthStatus: {
        status: monthStatus,
        approved_by: monthStatusObj?.approved_by || null,
        approved_at: monthStatusObj?.approved_at || null,
        approverName: approverName
      },
      shiftAssignments,
      workDetails,
      monthSummary,
      leaveSummary,
      days
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listShiftDefinitions = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const rows = await repo.listShiftDefinitions();
    res.status(200).json(rows || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.postShiftDefinition = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const start_time = String(b.start_time || '').trim();
    const end_time = String(b.end_time || '').trim();
    const break_minutes = b.break_minutes == null ? 60 : parseInt(String(b.break_minutes), 10);
    const working_days = b.working_days == null ? null : String(b.working_days);
    if (!name || !/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
      return res.status(400).json({ message: 'Invalid name/start_time/end_time' });
    }
    const row = await repo.upsertShiftDefinition({ name, start_time, end_time, break_minutes, working_days });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteShiftDefinition = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const id = parseInt(String(req.params?.id || ''), 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const r = await repo.deleteShiftDefinitionById(id);
    if (r?.notFound) return res.status(404).json({ message: 'Not found' });
    if (r?.inUse) return res.status(409).json({ message: 'Shift is in use', assignedCount: r.assignedCount ?? null });
    if (!r || !r.deleted) return res.status(500).json({ message: 'Delete failed' });
    res.status(200).json({ ok: true, deleted: r.deleted });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getMonthSummary = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const y = parseInt(String(req.query?.year || ''), 10);
    const m = parseInt(String(req.query?.month || ''), 10);
    if (!userId || !y || !m) return res.status(400).json({ message: 'Missing userId/year/month' });
    const row = await repo.getMonthSummary(userId, y, m);
    const safeParse = (s) => { try { return s ? JSON.parse(String(s)) : null; } catch { return null; } };
    res.status(200).json({
      userId,
      year: y,
      month: m,
      all: row ? safeParse(row.summary_all) : null,
      inhouse: row ? safeParse(row.summary_inhouse) : null,
      updatedBy: row ? (row.updated_by || null) : null,
      updatedAt: row ? (row.updated_at || null) : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.putMonthSummary = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const b = req.body || {};
    const y = parseInt(String(b.year || req.query?.year || ''), 10);
    const m = parseInt(String(b.month || req.query?.month || ''), 10);
    if (!userId || !y || !m) return res.status(400).json({ message: 'Missing userId/year/month' });
    const all = b.all ?? b.summaryAll ?? null;
    const inhouse = b.inhouse ?? b.summaryInhouse ?? null;
    try {
      const s1 = all == null ? '' : JSON.stringify(all);
      const s2 = inhouse == null ? '' : JSON.stringify(inhouse);
      if (s1.length > 50000 || s2.length > 50000) return res.status(400).json({ message: 'Payload too large' });
    } catch {
      return res.status(400).json({ message: 'Invalid summary payload' });
    }
    const r = await repo.upsertMonthSummary(userId, y, m, all, inhouse, req.user?.id || null);
    res.status(200).json({ ok: true, ...r });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getShiftAssignments = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const from = String(req.query?.from || '1900-01-01').slice(0, 10);
    const to = String(req.query?.to || '2999-12-31').slice(0, 10);
    if (!userId) return res.status(404).json({ message: 'User not found' });
    const assigns = await repo.listShiftAssignmentsBetween(userId, from, to).catch(() => []);
    const shiftDefs = await repo.listShiftDefinitions().catch(() => []);
    const shiftById = new Map((shiftDefs || []).map(s => [String(s.id), s]));
    const shiftByName = new Map((shiftDefs || []).map(s => [String(s.name), s]));
    const resolveDefForAssign = (a) => {
      let def = null;
      const sid = a?.shiftId != null ? String(a.shiftId) : '';
      if (sid) def = shiftById.get(sid) || null;
      if (!def) {
        const nm = a?.shift != null ? String(a.shift) : '';
        if (nm) def = shiftByName.get(nm) || null;
      }
      return def;
    };
    const items = (assigns || []).map(a => {
      const def = resolveDefForAssign(a);
      return {
        id: a?.id || null,
        start_date: String(a?.start_date || '').slice(0, 10) || null,
        end_date: a?.end_date ? String(a.end_date).slice(0, 10) : null,
        shift: def ? {
          id: def.id,
          name: def.name,
          start_time: def.start_time,
          end_time: def.end_time,
          break_minutes: def.break_minutes,
          standard_minutes: def.standard_minutes
        } : null
      };
    });
    res.status(200).json({ userId, from, to, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.postShiftAssignment = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const b = req.body || {};
    const shiftId = parseInt(String(b.shiftId || ''), 10);
    const startDate = String(b.startDate || '').slice(0, 10);
    const endDate = b.endDate == null || b.endDate === '' ? null : String(b.endDate).slice(0, 10);
    if (!userId || !shiftId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({ message: 'Missing userId/shiftId/startDate' });
    }
    await repo.assignShiftToUser(userId, shiftId, startDate, endDate);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteShiftAssignment = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const id = parseInt(String(req.params.id), 10);
    if (!userId || !id) return res.status(400).json({ message: 'Missing userId/id' });
    const r = await repo.deleteShiftAssignment(id, userId);
    if (!r?.ok) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getWorkDetails = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    if (!userId) return res.status(404).json({ message: 'User not found' });
    const from = String(req.query?.from || '').slice(0, 10);
    const to = String(req.query?.to || '').slice(0, 10);
    const rows = await repo.listWorkDetailsBetween(userId, from || '1900-01-01', to || '2999-12-31');
    const items = (rows || []).map(r => ({
      id: r.id,
      startDate: String(r.start_date || '').slice(0, 10) || null,
      endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
      companyName: r.company_name || null,
      workPlaceAddress: r.work_place_address || null,
      workContent: r.work_content || null,
      roleTitle: r.role_title || null,
      responsibilityLevel: r.responsibility_level || null
    }));
    res.status(200).json({ userId, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.postWorkDetail = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    if (!userId) return res.status(404).json({ message: 'User not found' });
    const id = await repo.createWorkDetail(userId, req.body || {});
    if (!id) return res.status(400).json({ message: 'Invalid payload' });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.putWorkDetail = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    if (!userId) return res.status(404).json({ message: 'User not found' });
    const id = parseInt(String(req.params.id), 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const r = await repo.updateWorkDetail(id, userId, req.body || {});
    if (!r?.ok) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ id, updated: r.updated || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteWorkDetail = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    if (!userId) return res.status(404).json({ message: 'User not found' });
    const id = parseInt(String(req.params.id), 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const r = await repo.deleteWorkDetail(id, userId);
    res.status(200).json({ id, deleted: r.deleted || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.putMonthBulk = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month, updates, dailyUpdates } = req.body || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month || !Array.isArray(updates)) return res.status(400).json({ message: 'Missing fields' });
    const y = parseInt(year,10), m = parseInt(month,10);
    await assertMonthWritable(req, userId, y, m);
    if (req.user.role === 'employee' && !isEditableMonth(y,m)) {
      return res.status(403).json({ message: 'Forbidden: cannot edit past months' });
    }

    // Role-based classification validation:
    // If employee, prevent setting kubun back to Planned ('') if they have actual data or non-empty kubun.
    if (req.user.role === 'employee' && Array.isArray(dailyUpdates)) {
      for (const d of dailyUpdates) {
        if (d.kubun === '' || d.kubun === null) {
          // If trying to set to Planned, check if they are providing actual times in this request
          const date = String(d.date || '').slice(0, 10);
          const hasActualInBody = Array.isArray(updates) && updates.some(u => {
            const uDate = String(u.checkIn || u.checkOut || '').slice(0, 10);
            return uDate === date && (u.checkIn || u.checkOut) && u.delete !== true;
          });
          if (hasActualInBody) {
            return res.status(400).json({ message: 'Cannot set classification to Planned when attendance times are provided' });
          }
        }
      }
    }

    // 1. Validation: Cho phép mọi khung giờ (00:00 - 23:59) để hỗ trợ ca đêm và tăng ca muộn
    // (Đã gỡ bỏ logic chặn 06:00 - 23:59 theo yêu cầu của người dùng)

    const normalizedUpdates = Array.isArray(updates) ? updates.map(u => ({ ...(u || {}) })) : [];
    const normalizedDailyUpdates = Array.isArray(dailyUpdates) ? dailyUpdates : dailyUpdates;

    // De-dup within the same request by (userId, checkIn): keep the last one
    try {
      const seen = new Map();
      for (let i = 0; i < normalizedUpdates.length; i++) {
        const u = normalizedUpdates[i];
        const key = (!u?.id && u?.checkIn) ? String(u.checkIn) : null;
        if (!key) continue;
        if (seen.has(key)) {
          normalizedUpdates[seen.get(key)] = null;
        }
        seen.set(key, i);
      }
    } catch {}

    // Normalize: if segment already exists (same checkIn), convert "create" into "update" to avoid unique error.
    try {
      for (const u of normalizedUpdates) {
        if (!u || u.delete === true) continue;
        if (u.id) continue;
        const inV = String(u.checkIn || '').trim();
        if (!inV) continue;
        const existing = await repo.findCheckInByTime(userId, inV).catch(() => null);
        if (existing?.id) {
          u.id = Number(existing.id);
          delete u.clientId;
        }
      }
    } catch {}

    const cleanedUpdates = normalizedUpdates.filter(Boolean);

    let result = null;
    try {
      result = await repo.bulkUpsertAttendance(userId, { updates: cleanedUpdates, dailyUpdates: normalizedDailyUpdates });
    } catch (err) {
      if (String(err?.code || '') === 'ER_DUP_ENTRY') {
        try {
          for (const u of cleanedUpdates) {
            if (u?.id || u?.delete === true) continue;
            const inV = String(u.checkIn || '').trim();
            if (!inV) continue;
            const existing = await repo.findCheckInByTime(userId, inV).catch(() => null);
            if (existing?.id) {
              u.id = Number(existing.id);
              delete u.clientId;
            }
          }
        } catch {}
        result = await repo.bulkUpsertAttendance(userId, { updates: cleanedUpdates, dailyUpdates: normalizedDailyUpdates });
      } else {
        throw err;
      }
    }

    try {
      await auditRepo.writeLog({
        userId: req.user?.id,
        action: 'attendance_month_bulk',
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        beforeData: null,
        afterData: JSON.stringify({ targetUserId: userId, year: y, month: m, saved: result.saved })
      });
    } catch {}

    res.status(200).json(result);
  } catch (err) {
    res.status(Number(err?.status || 500)).json({ message: err.message });
  }
};

exports.syncSalary = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.body || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // 1. Calculate work days and paid leave from attendance
    const dailyRows = await repo.listDailyBetween(userId, from, to).catch(() => []);
    const attendanceRows = await repo.listByUserBetween(userId, from, to).catch(() => []);
    
    const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
    const workDaysSet = new Set();
    let paidLeaveDays = 0;

    for (const r of dailyRows) {
      const date = String(r.date || '').slice(0, 10);
      const kubun = String(r.kubun || '').trim();
      if (workKubunSet.has(kubun)) {
        workDaysSet.add(date);
      }
      if (kubun === '有給休暇') {
        paidLeaveDays++;
      }
    }
    for (const r of attendanceRows) {
      const date = String(r.checkIn || r.checkOut || '').slice(0, 10);
      if (date) workDaysSet.add(date);
    }

    const workDays = workDaysSet.size;

    // 2. Get user info for paid leave entitlement
    const user = await userRepo.getUserById(userId);
    const joinDate = user?.join_date || user?.hire_date || null;
    const paidLeaveEntitlement = calculatePaidLeaveEntitlement(joinDate);

    // 3. Update salary_inputs
    const existingInput = await salaryInputRepo.getByUserMonth(userId, ym);
    const payload = existingInput?.payload || {};
    
    // Update payload with new attendance data
    payload.kintai = payload.kintai || {};
    payload.kintai['出勤日数'] = workDays;
    payload.kintai['有給休暇'] = paidLeaveDays;
    payload.kintai['有給休暇付与'] = paidLeaveEntitlement;

    await salaryInputRepo.upsert({
      userId,
      month: ym,
      payload,
      updatedBy: req.user?.id
    });

    res.status(200).json({
      ok: true,
      workDays,
      paidLeaveDays,
      paidLeaveEntitlement
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.putPlan = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { date, plan } = req.body || {};
    if (!userId || !date) return res.status(400).json({ message: 'Missing userId/date' });
    const result = await repo.upsertPlan(userId, date, plan);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { from, to } = req.query || {};
    if (!userId || !from || !to) return res.status(400).json({ message: 'Missing from/to' });
    const r = await service.timesheet(userId, from, to);
    let csv = 'date,regularMinutes,overtimeMinutes,nightMinutes\n';
    for (const d of r.days) {
      csv += `${d.date},${d.regularMinutes},${d.overtimeMinutes},${d.nightMinutes}\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"timesheet.csv\"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.exportMonthXlsx = async (req, res) => {
  try {
    const userId = await resolveTargetUserId(req);
    if (userId === '__forbidden__') return res.status(403).json({ message: 'Forbidden' });
    const { year, month } = req.query || {};
    if (!userId) return res.status(404).json({ message: 'User not found' });
    if (!year || !month) return res.status(400).json({ message: 'Missing year/month' });
    const pad = (n) => String(n).padStart(2, '0');
    const y = parseInt(year, 10), m = parseInt(month, 10);
    if (!y || !m) return res.status(400).json({ message: 'Invalid year/month' });
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(lastDay)}`;
    const role = String(req.user?.role || '').toLowerCase();
    const monthStatus = await getMonthStatusValue(userId, y, m);
    if (role === 'payroll' && monthStatus !== 'approved') {
      return res.status(403).json({ message: 'Forbidden: month is not closed' });
    }

    const user = await userRepo.getUserById(userId).catch(() => null);
    const employeeCode = String(user?.employee_code || user?.employeeCode || '').trim();
    const employeeName = String(user?.username || user?.email || '').trim();

    const rows = await repo.listByUserBetween(userId, from, to);
    const dailyRows = await repo.listDailyBetween(userId, from, to).catch(() => []);
    const planRows = await repo.listPlanBetween(userId, from, to).catch(() => []);
    const shiftDefs = await repo.listShiftDefinitions().catch(() => []);
    const shiftById = new Map((shiftDefs || []).map(s => [String(s.id), s]));
    const calendarRepo = require('../calendar/calendar.repository');
    const cal = await calendarRepo.computeYear(y).catch(() => null);
    const off = new Set();
    try {
      const detail = Array.isArray(cal?.detail) ? cal.detail : [];
      const byDate = new Map();
      for (const it of detail) {
        const ds = String(it?.date || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) continue;
        if (!byDate.has(ds)) byDate.set(ds, []);
        byDate.get(ds).push({
          type: String(it?.type || ''),
          is_off: Number(it?.is_off || 0) === 1
        });
      }
      const addDaysUTC = (dateStr, n) => {
        const yy = parseInt(String(dateStr).slice(0, 4), 10);
        const mm = parseInt(String(dateStr).slice(5, 7), 10) - 1;
        const dd = parseInt(String(dateStr).slice(8, 10), 10);
        const dt = new Date(Date.UTC(yy, mm, dd, 0, 0, 0));
        dt.setUTCDate(dt.getUTCDate() + n);
        const y2 = dt.getUTCFullYear();
        const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d2 = String(dt.getUTCDate()).padStart(2, '0');
        return `${y2}-${m2}-${d2}`;
      };
      const isHolidayType = (t) => {
        if (t === 'fixed') return true;
        if (t === 'jp_auto') return true;
        if (t === 'jp_substitute') return true;
        if (t === 'jp_bridge') return true;
        return false;
      };
      const isNonWeekendHoliday = (ds) => {
        const list = byDate.get(ds) || [];
        return list.some(x => x.is_off && isHolidayType(x.type));
      };
      const hasValidBridge = (ds) => {
        const list = byDate.get(ds) || [];
        const hasBridge = list.some(x => x.is_off && x.type === 'jp_bridge');
        if (!hasBridge) return false;
        const prev = addDaysUTC(ds, -1);
        const next = addDaysUTC(ds, 1);
        return isNonWeekendHoliday(prev) && isNonWeekendHoliday(next);
      };
      for (const [ds, list] of byDate.entries()) {
        const hasSunday = list.some(x => x.is_off && x.type === 'sunday');
        if (hasSunday) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'saturday_last')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'fixed')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'jp_auto')) off.add(ds);
        if (list.some(x => x.is_off && x.type === 'jp_substitute')) off.add(ds);
        if (hasValidBridge(ds)) off.add(ds);
      }
    } catch {}

    const dailyMap = new Map();
    for (const r of dailyRows || []) {
      const d = String(r?.date || '').slice(0, 10);
      if (!d) continue;
      dailyMap.set(d, {
        kubun: r.kubun || null,
        workType: r.work_type || null,
        location: r.location || null,
        reason: r.reason || null,
        memo: r.memo || null,
        breakMinutes: r.break_minutes == null ? null : Number(r.break_minutes),
        nightBreakMinutes: r.night_break_minutes == null ? null : Number(r.night_break_minutes)
      });
    }

    const segMap = new Map();
    for (const r of (rows || [])) {
      const d = String(r.checkIn || '').slice(0, 10) || String(r.checkOut || '').slice(0, 10);
      if (!d) continue;
      if (!segMap.has(d)) segMap.set(d, []);
      segMap.get(d).push({
        id: r.id,
        checkIn: r.checkIn || null,
        checkOut: r.checkOut || null,
        shiftId: r.shiftId || null,
        workType: r.work_type || null,
        labels: r.labels || null
      });
    }

    const dowJa = (dateStr) => {
      try {
        const [yy, mm, dd] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
        const dt = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 0, 0, 0));
        return ['日', '月', '火', '水', '木', '金', '土'][dt.getUTCDay()];
      } catch {
        return '';
      }
    };
    const hm = (dtStr) => {
      const s = String(dtStr || '');
      if (!s) return '';
      if (s.includes('T')) return s.slice(11, 16);
      return s.slice(11, 16);
    };
    const fmtHm = (mins) => {
      const m0 = Math.max(0, Number(mins || 0));
      const h = Math.floor(m0 / 60);
      const mm = Math.floor(m0 % 60);
      return `${h}:${String(mm).padStart(2, '0')}`;
    };
    const minutesBetween = (aStr, bStr) => {
      const a = String(aStr || '');
      const b = String(bStr || '');
      if (!a || !b) return 0;
      const aD = a.slice(0, 10);
      const bD = b.slice(0, 10);
      const aT = a.slice(11, 16);
      const bT = b.slice(11, 16);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(aD) || !/^\d{4}-\d{2}-\d{2}$/.test(bD)) return 0;
      if (!/^\d{2}:\d{2}$/.test(aT) || !/^\d{2}:\d{2}$/.test(bT)) return 0;
      const [ay, am, ad] = aD.split('-').map(n => parseInt(n, 10));
      const [by, bm, bd] = bD.split('-').map(n => parseInt(n, 10));
      const [ah, amn] = aT.split(':').map(n => parseInt(n, 10));
      const [bh, bmn] = bT.split(':').map(n => parseInt(n, 10));
      const aUtc = Date.UTC(ay, (am || 1) - 1, ad || 1, (ah || 0) - 9, amn || 0, 0);
      const bUtc = Date.UTC(by, (bm || 1) - 1, bd || 1, (bh || 0) - 9, bmn || 0, 0);
      return Math.max(0, Math.round((bUtc - aUtc) / 60000));
    };
    const brLabel = (min) => min === 45 ? '0:45' : min === 30 ? '0:30' : min === 0 ? '0:00' : '1:00';
    const nbLabel = (min) => min === 60 ? '1:00' : min === 30 ? '0:30' : '0:00';
    const reasonLabel = (r) => {
      const s = String(r || '').trim();
      if (s === 'private') return '私用';
      if (s === 'late') return '遅刻';
      if (s === 'early') return '早退';
      if (s === 'other') return 'その他';
      return s;
    };

    const workDetailsRows = await repo.listWorkDetailsBetween(userId, from, to).catch(() => []);
    const workDetails = (workDetailsRows || []).map(r => ({
      startDate: String(r.start_date || '').slice(0, 10) || null,
      endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
      companyName: r.company_name || null,
      workContent: r.work_content || null
    }));
    const resolveWorkDetail = (ds) => {
      let best = null;
      for (const w of workDetails) {
        const sd = String(w?.startDate || '').slice(0, 10);
        if (!sd || sd > ds) continue;
        const ed = w?.endDate ? String(w.endDate).slice(0, 10) : '';
        if (ed && ed < ds) continue;
        best = w;
      }
      return best;
    };

    const assigns = await repo.listShiftAssignmentsBetween(userId, from, to).catch(() => []);
    const shiftForDate = (ds) => {
      let best = null;
      for (const a of assigns || []) {
        const sd = String(a?.start_date || '').slice(0, 10);
        if (!sd || sd > ds) continue;
        const ed = a?.end_date ? String(a.end_date).slice(0, 10) : '';
        if (ed && ed < ds) continue;
        best = a;
      }
      if (!best) return null;
      const sid = best?.shiftId != null ? String(best.shiftId) : '';
      const def = sid ? (shiftById.get(sid) || null) : null;
      if (!def) return null;
      const st = String(def.start_time || '').trim();
      const et = String(def.end_time || '').trim();
      if (!/^\d{2}:\d{2}$/.test(st) || !/^\d{2}:\d{2}$/.test(et)) return null;
      const [sh, sm] = st.split(':').map(n => parseInt(n, 10));
      const [eh, em] = et.split(':').map(n => parseInt(n, 10));
      return { startMin: (sh || 0) * 60 + (sm || 0), endMin: (eh || 0) * 60 + (em || 0) };
    };

    const columns = [
      { header: '社員番号', width: 14 },
      { header: '氏名', width: 18 },
      { header: '日付', width: 12 },
      { header: '曜日', width: 6 },
      { header: '勤務区分', width: 10 },
      { header: '企業名', width: 28 },
      { header: '出社', width: 6 },
      { header: '在宅', width: 6 },
      { header: '現場・出張', width: 14 },
      { header: '開始時刻', width: 10 },
      { header: '終了時刻', width: 10 },
      { header: '休憩時間', width: 10 },
      { header: '深夜休憩', width: 10 },
      { header: '勤務時間', width: 10 },
      { header: '超過時間', width: 10 },
      { header: '遅刻/早退', width: 10 },
      { header: '理由', width: 12 },
      { header: '社内業務', width: 14 },
      { header: '備考', width: 26 },
      { header: '承認ステータス', width: 12 },
      { header: '承認者', width: 12 }
    ];

    const sheetRows = [];
    const planSheetRows = [];
    const planColumns = [
      { header: '日付', width: 12 },
      { header: '勤務区分', width: 10 },
      { header: '変換勤務区分', width: 14 },
      { header: '企業名', width: 20 },
      { header: '開始時刻', width: 10 },
      { header: '終了時刻', width: 10 },
      { header: '休憩時間', width: 10 },
      { header: '深夜休憩', width: 10 },
      { header: '勤務時間', width: 10 },
      { header: '勤務形態', width: 14 }
    ];

    for (let day = 1; day <= lastDay; day++) {
      const ds = `${y}-${pad(m)}-${pad(day)}`;
      const dow = dowJa(ds);
      const isOff = off.has(ds) || dow === '日' || dow === '土';
      
      // Sheet 1: 入力用勤怠表
      const segs0 = (segMap.get(ds) || []).slice().sort((a, b) => String(a?.checkIn || '').localeCompare(String(b?.checkIn || '')));
      const segs = segs0.filter(s => {
        try {
          const sid = s?.shiftId != null ? String(s.shiftId) : '';
          const def = sid ? (shiftById.get(sid) || null) : null;
          const wt = String(s?.workType || '').trim();
          const labels = String(s?.labels || '').trim();
          const inHm = hm(s?.checkIn);
          const outHm = hm(s?.checkOut);
          if (def && !wt && !labels && inHm === String(def.start_time || '').trim() && outHm === String(def.end_time || '').trim()) {
            return false;
          }
        } catch {}
        return true;
      });
      const seg = segs[0] || null;
      const daily = dailyMap.get(ds) || null;
      const wd = resolveWorkDetail(ds);
      const inHm = hm(seg?.checkIn);
      const outHm = hm(seg?.checkOut);
      const hasTime = !!inHm || !!outHm;
      const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      const dailyKubun = String(daily?.kubun || '').trim();
      const kubun = (() => {
        if (isOff) {
          if (dailyKubun === '休日' || dailyKubun === '休日出勤' || dailyKubun === '代替出勤') return dailyKubun;
          if (hasTime) return '休日出勤';
          return '休日';
        }
        const allowed = new Set(['', '出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日']);
        if (allowed.has(dailyKubun)) return dailyKubun || '出勤';
        return '出勤';
      })();
      const isWorkKubun = workKubunSet.has(kubun);
      let wt = isWorkKubun ? String(seg?.workType || daily?.workType || '').trim() : '';
      if (isWorkKubun && !wt) wt = 'onsite';
      const wtOn = wt === 'onsite' ? { v: '✓', s: 'checkOn' } : '';
      const wtRe = wt === 'remote' ? { v: '✓', s: 'checkOn' } : '';
      const wtSa = wt === 'satellite' ? { v: '✓', s: 'checkOn' } : '';
      const holidayLock = !isWorkKubun;
      const brMin = holidayLock ? 0 : (daily?.break_minutes == null ? 60 : Number(daily.break_minutes));
      const nbMin = holidayLock ? 0 : (daily?.night_break_minutes == null ? 0 : Number(daily.night_break_minutes));
      const workedMin = holidayLock ? 0 : Math.max(0, minutesBetween(seg?.checkIn, seg?.checkOut) - brMin);
      const otMin = holidayLock ? 0 : Math.max(0, workedMin - (8 * 60));
      const lateEarly = (() => {
        if (holidayLock) return '';
        if (!inHm && !outHm) return '';
        const parse = (t) => {
          const s = String(t || '');
          if (!/^\d{2}:\d{2}$/.test(s)) return null;
          const [h, mi] = s.split(':').map(n => parseInt(n, 10));
          return (h || 0) * 60 + (mi || 0);
        };
        const a = parse(inHm);
        const b = parse(outHm);
        if (a == null || b == null) return '';
        const se = shiftForDate(ds);
        const startBase = se?.startMin ?? (8 * 60);
        const endBase = se?.endMin ?? (17 * 60);
        const late = a > (startBase + 30);
        const early = b < (endBase + 30);
        if (late && early) return '遅刻/早退';
        if (late) return '遅刻';
        if (early) return '早退';
        return '';
      })();
      const companyName = String(wd?.companyName || '').trim() || String(daily?.location || '').trim();
      const inhouseWork = String(wd?.workContent || '').trim();
      const approveStatus = monthStatus === 'approved' ? '承認済' : (() => {
        const labels = String(seg?.labels || '').split(',').map(s => s.trim()).filter(Boolean);
        if (labels.includes('submitted')) return '承認待ち';
        return '';
      })();
      sheetRows.push({
        isOff,
        cells: [
          employeeCode || '',
          employeeName || '',
          ds,
          dow,
          kubun,
          companyName,
          wtOn,
          wtRe,
          wtSa,
          inHm,
          outHm,
          brLabel(brMin),
          nbLabel(nbMin),
          fmtHm(workedMin),
          fmtHm(otMin),
          lateEarly,
          reasonLabel(daily?.reason || ''),
          inhouseWork,
          String(daily?.memo || ''),
          approveStatus,
          ''
        ]
      });

      // Sheet 2: 予定
      const plan = planRows.find(p => String(p.date).slice(0, 10) === ds) || null;
      const shiftDef = plan?.shiftId ? shiftById.get(String(plan.shiftId)) : (shiftForDate(ds) ? shiftById.get(String(shiftForDate(ds).id)) : null);
      const planKubun = isOff ? '休日' : '出勤';
      const planStartTime = plan?.startTime || shiftDef?.start_time || '';
      const planEndTime = plan?.endTime || shiftDef?.end_time || '';
      const planBreak = plan?.breakMinutes != null ? plan.breakMinutes : (shiftDef?.break_minutes || 0);
      const planWorkType = plan?.work_type || (isOff ? '' : '契約なし');
      
      planSheetRows.push({
        isOff,
        cells: [
          `${m}月${day}日(${dow})`,
          planKubun,
          planKubun,
          plan?.location || '',
          planStartTime ? planStartTime.split(':')[0] : '',
          planStartTime ? planStartTime.split(':')[1] : '',
          planEndTime ? planEndTime.split(':')[0] : '',
          planEndTime ? planEndTime.split(':')[1] : '',
          Math.floor(planBreak / 60),
          planBreak % 60,
          0, 0, // 深夜休憩
          { f: `MAX(0, (G${day+1}*60+H${day+1})-(E${day+1}*60+F${day+1})-(I${day+1}*60+J${day+1}))` }, // Công thức tính phút
          planWorkType
        ]
      });
    }

    const safeFile = (s) => String(s || '').replace(/[\\\/:*?"<>|]/g, '_');
    const fileName = safeFile(`attendance_month_${from.slice(0, 7)}_${userId}.xlsx`);
    const { buildXlsxBook } = require('../../utils/xlsx');
    const buf = buildXlsxBook({ 
      sheets: [
        { name: '入力用勤怠表', columns, rows: sheetRows, headerStyleKey: 'headerGrey' },
        { name: '予定', columns: planColumns, rows: planSheetRows, headerStyleKey: 'headerGrey' }
      ] 
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
