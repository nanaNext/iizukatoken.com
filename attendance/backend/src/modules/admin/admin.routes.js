const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { permit } = require('../../core/middleware/rbac');
const userCtrl = require('../users/user.controller');
const deptRoutes = require('../departments/department.routes');
const settingsRoutes = require('../settings/settings.routes');
const auditRepo = require('../audit/audit.repository');
const attendanceService = require('../attendance/attendance.service');
const userRepo = require('../users/user.repository');
const authRepo = require('../auth/auth.repository');
const { companyName } = require('../../config/env');
const { rateLimit } = require('../../core/middleware/rateLimit');
const salaryService = require('../salary/salary.service');
const db = require('../../core/database/mysql');
const upload = require('../../core/middleware/upload');
// Admin tổng hợp
router.use(authenticate);
// Users
router.get('/users', authorize('admin'), userCtrl.list);
router.get('/users/:id', authorize('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const row = await userRepo.getUserById(id);
    if (!row) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/users', async (req, res, next) => {
  try {
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_create', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, authorize('admin'), userCtrl.create);
router.patch('/users/:id', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_update', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, authorize('admin'), userCtrl.update);
router.delete('/users/:id', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    if (before?.email === superEmail) {
      return res.status(403).json({ message: 'Cannot delete SUPER_ADMIN user' });
    }
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_delete', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: null });
  } catch {}
  next();
}, authorize('admin'), userCtrl.remove);
// Employees alias
router.get('/employees', authorize('admin'), userCtrl.list);
router.get('/employees/:id', permit('employees','view'), async (req, res) => {
  try {
    const id = req.params.id;
    const row = await userRepo.getUserById(id);
    if (!row) return res.status(404).json({ message: 'User not found' });
    if (String(req.user?.role).toLowerCase() === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const myDept = me?.departmentId;
      if (!myDept || String(row.departmentId) !== String(myDept)) {
        return res.status(403).json({ message: 'Managers can only view employees in their own department' });
      }
    }
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/employees', async (req, res, next) => {
  try {
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_employee_create', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, permit('employees','manage'), async (req, res, next) => {
  try {
    if (String(req.user?.role).toLowerCase() !== 'manager') return next();
    const me = await userRepo.getUserById(req.user.id);
    const myDept = me?.departmentId;
    const bodyDept = req.body?.departmentId ?? null;
    if (!myDept || String(bodyDept) !== String(myDept)) {
      return res.status(403).json({ message: 'Managers can only create employees in their own department' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}, userCtrl.create);
router.put('/employees/:id', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_employee_update', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, permit('employees','manage'), async (req, res, next) => {
  try {
    if (String(req.user?.role).toLowerCase() !== 'manager') return next();
    const me = await userRepo.getUserById(req.user.id);
    const myDept = me?.departmentId;
    const target = await userRepo.getUserById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!myDept || String(target.departmentId) !== String(myDept)) {
      return res.status(403).json({ message: 'Managers can only update employees in their own department' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}, userCtrl.update);
router.patch('/employees/:id', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_employee_update', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, permit('employees','manage'), async (req, res, next) => {
  try {
    if (String(req.user?.role).toLowerCase() !== 'manager') return next();
    const me = await userRepo.getUserById(req.user.id);
    const myDept = me?.departmentId;
    const target = await userRepo.getUserById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!myDept || String(target.departmentId) !== String(myDept)) {
      return res.status(403).json({ message: 'Managers can only update employees in their own department' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}, userCtrl.update);
router.delete('/employees/:id', permit('employees','manage'), async (req, res) => {
  try {
    const id = req.params.id;
    const before = await userRepo.getUserById(id);
    if (!before) return res.status(404).json({ message: 'User not found' });
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    if (before?.email === superEmail) {
      return res.status(403).json({ message: 'Cannot deactivate SUPER_ADMIN user' });
    }
    if (String(req.user?.role).toLowerCase() === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const myDept = me?.departmentId;
      if (!myDept || String(before.departmentId) !== String(myDept)) {
        return res.status(403).json({ message: 'Managers can only deactivate employees in their own department' });
      }
    }
    await userRepo.updateUser(id, { employmentStatus: 'inactive' });
    try { await require('../auth/refresh.repository').deleteUserTokens(id); } catch {}
    try { await auditRepo.writeLog({ userId: req.user.id, action: 'admin_employee_deactivate', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify({ employment_status: 'inactive' }) }); } catch {}
    res.status(200).json({ id, status: 'inactive' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/employees/:id/avatar', permit('employees','manage'), async (req, res, next) => {
  try {
    if (String(req.user?.role).toLowerCase() !== 'manager') return next();
    const me = await userRepo.getUserById(req.user.id);
    const target = await userRepo.getUserById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (!me?.departmentId || String(target.departmentId) !== String(me.departmentId)) {
      return res.status(403).json({ message: 'Managers can only update employees in their own department' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}, upload.single('file'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!req.file || !id) {
      return res.status(400).json({ message: 'Missing file or id' });
    }
    const url = `/uploads/${req.file.filename}`;
    await userRepo.updateUser(id, { avatarUrl: url });
    try { await auditRepo.writeLog({ userId: req.user.id, action: 'admin_employee_avatar_upload', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ id, avatarUrl: url, originalName: req.file.originalname }) }); } catch {}
    res.status(201).json({ id, url, originalName: req.file.originalname });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    if (before?.email === superEmail && req.body?.role !== 'admin') {
      return res.status(403).json({ message: 'Cannot change SUPER_ADMIN role' });
    }
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_set_role', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, authorize('admin'), userCtrl.setRole);
router.patch('/users/:id/department', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_set_department', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, authorize('admin'), userCtrl.setDepartment);
router.patch('/users/:id/password', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    const superEmail = process.env.SUPER_ADMIN_EMAIL;
    if (before?.email === superEmail && String(req.user.id) !== String(req.params.id)) {
      return res.status(403).json({ message: 'Only SUPER_ADMIN can change own password' });
    }
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_set_password', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: before?.id, email: before?.email }), afterData: JSON.stringify({ changed: true }) });
  } catch {}
  next();
}, authorize('admin'), userCtrl.setPassword);
// Lock/Unlock tài khoản đăng nhập
router.patch('/users/:id/lock', authorize('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const minutes = parseInt((req.body?.minutes ?? 60), 10);
    const user = await userRepo.getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await authRepo.lockUser(user.email, minutes);
    try { await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_lock', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: user.id, email: user.email }), afterData: JSON.stringify({ minutes }) }); } catch {}
    res.status(200).json({ id, locked: true, minutes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch('/users/:id/unlock', authorize('admin'), async (req, res) => {
  try {
    const id = req.params.id;
    const user = await userRepo.getUserById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await authRepo.resetLock(user.email);
    try { await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_unlock', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: user.id, email: user.email }), afterData: JSON.stringify({ unlocked: true }) }); } catch {}
    res.status(200).json({ id, unlocked: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Departments
router.use('/departments', deptRoutes);
// Settings
router.use('/settings', authorize('admin'), settingsRoutes);
// Audit: liệt kê có filter
router.get('/audit', authorize('admin'), async (req, res) => {
  try {
    const result = await auditRepo.listLogs({
      userId: req.query.userId,
      action: req.query.action,
      from: req.query.from,
      to: req.query.to,
      page: req.query.page,
      pageSize: req.query.pageSize
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DB check: thống kê nhanh và kiểm tra collation
router.get('/db/check', authorize('admin'), async (req, res) => {
  try {
    const [verRows] = await db.query('SELECT DATABASE() AS db, VERSION() AS version');
    const meta = verRows && verRows[0] ? verRows[0] : {};
    const [usersCountRows] = await db.query('SELECT COUNT(*) AS total, SUM(employment_status="active") AS active, SUM(employment_status="inactive") AS inactive, SUM(employment_status="retired") AS retired, SUM(hire_date IS NULL) AS hire_null, SUM(hire_date IS NOT NULL) AS hire_set FROM users');
    const usersCount = usersCountRows && usersCountRows[0] ? usersCountRows[0] : {};
    let departmentsCount = { total: 0 };
    try {
      const [deptRows] = await db.query('SELECT COUNT(*) AS total FROM departments');
      departmentsCount = deptRows && deptRows[0] ? deptRows[0] : { total: 0 };
    } catch {}
    const [sampleUsers] = await db.query('SELECT id, employee_code, username, email, departmentId, employment_status, hire_date FROM users ORDER BY id DESC LIMIT 5');
    const [collRows] = await db.query(`
      SELECT TABLE_NAME AS table, TABLE_COLLATION AS collation
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME ASC
    `);
    res.status(200).json({
      db: meta.db,
      version: meta.version,
      users: usersCount,
      departments: departmentsCount,
      sampleUsers,
      collations: collRows
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Export CSV timesheet
router.get('/export/timesheet.csv', authorize('admin'), async (req, res) => {
  try {
    const { userIds, from, to } = req.query;
    if (!userIds || !from || !to) {
      return res.status(400).send('Missing userIds/from/to');
    }
    const ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    const lang = (req.query.lang || req.headers['accept-language'] || '').toLowerCase();
    const isJa = lang.startsWith('ja');
    const header = isJa
      ? '従業員ID,日付,通常勤務分,残業分,深夜分\n'
      : 'userId,date,regularMinutes,overtimeMinutes,nightMinutes\n';
    let csv = header;
    for (const id of ids) {
      const r = await attendanceService.timesheet(id, from, to);
      for (const d of r.days) {
        csv += `${id},${d.date},${d.regularMinutes},${d.overtimeMinutes},${d.nightMinutes}\n`;
      }
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"timesheet.csv\"');
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Admin Home stats
router.get('/home/stats', authorize('admin'), async (req, res) => {
  try {
    const db = require('../../core/database/mysql');
    const [[{ c_checkin } = { c_checkin: 0 }]] = await db.query(`
      SELECT COUNT(DISTINCT userId) AS c_checkin
      FROM attendance
      WHERE DATE(checkIn) = CURDATE()
    `);
    const [[{ c_pending } = { c_pending: 0 }]] = await db.query(`
      SELECT COUNT(*) AS c_pending
      FROM leave_requests
      WHERE status = 'pending'
    `);
    const [[{ c_leave } = { c_leave: 0 }]] = await db.query(`
      SELECT COUNT(*) AS c_leave
      FROM leave_requests
      WHERE status = 'approved'
        AND CURDATE() BETWEEN startDate AND endDate
    `);
    const [[{ c_late } = { c_late: 0 }]] = await db.query(`
      SELECT COUNT(*) AS c_late
      FROM attendance a
      LEFT JOIN user_shift_assignments s
        ON s.userId = a.userId
       AND s.start_date <= DATE(a.checkIn)
       AND (s.end_date IS NULL OR s.end_date >= DATE(a.checkIn))
      LEFT JOIN shift_definitions d
        ON d.id = s.shiftId
      WHERE DATE(a.checkIn) = CURDATE()
        AND TIME(a.checkIn) > COALESCE(d.start_time, '09:00')
    `);
    res.status(200).json({
      todayCheckin: Number(c_checkin || 0),
      lateCount: Number(c_late || 0),
      leaveCount: Number(c_leave || 0),
      pendingCount: Number(c_pending || 0)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Attendance admin: view timesheet and edit records
router.get('/attendance/timesheet', permit('attendance','view'), async (req, res) => {
  try {
    const { userId, from, to } = req.query || {};
    if (!userId || !from || !to) {
      return res.status(400).json({ message: 'Missing userId/from/to' });
    }
    const r = await attendanceService.timesheet(userId, from, to);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/attendance/day', permit('attendance','view'), async (req, res) => {
  try {
    const { userId, date } = req.query || {};
    if (!userId || !date) {
      return res.status(400).json({ message: 'Missing userId/date' });
    }
    const rows = await attendanceRepo.listByUserBetween(userId, date, date);
    res.status(200).json({ date, segments: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.patch('/attendance/:id', permit('attendance','manage'), async (req, res) => {
  try {
    const id = req.params.id;
    const { checkIn, checkOut } = req.body || {};
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await attendanceRepo.updateTimes(id, checkIn || null, checkOut || null);
    try { await auditRepo.writeLog({ userId: req.user.id, action: 'admin_attendance_update', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id }), afterData: JSON.stringify({ checkIn, checkOut }) }); } catch {}
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
router.get('/payslip', authorize('admin'), async (req, res) => {
  try {
    const { userIds, month } = req.query;
    if (!userIds || !month) {
      return res.status(400).json({ message: 'Missing userIds/month' });
    }
    const ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    const y = parseInt(String(month).split('-')[0], 10);
    const m = parseInt(String(month).split('-')[1], 10);
    const pad = n => String(n).padStart(2, '0');
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const from = `${y}-${pad(m)}-01`;
    const to = `${y}-${pad(m)}-${pad(lastDay)}`;
    const today = new Date();
    const issueDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    const employees = [];
    for (const id of ids) {
      const user = await userRepo.getUserById(id);
      const ts = await attendanceService.timesheet(id, from, to);
      const workDays = Array.isArray(ts.days) ? ts.days.length : 0;
      const 勤怠 = {
        出勤日数: workDays,
        有給休暇: 0,
        就業時間: ts.total.regularMinutes || 0,
        法外時間外: ts.total.overtimeMinutes || 0,
        所定休出勤: 0,
        週40超時間: 0,
        月60超時間: 0,
        法定休出勤: 0,
        深夜勤時間: ts.total.nightMinutes || 0,
        前月有休残: 0
      };
      const 支給 = {
        基礎給: 0,
        就業手当: 0,
        時間外手当: 0,
        所休出手当: 0,
        週40超手当: 0,
        月60超手当: 0,
        法休出手当: 0,
        深夜勤手当: 0
      };
      const 控除 = {
        健康保険: 0,
        介護保険: 0,
        厚生年金: 0,
        雇用保険: 0,
        社保合計額: 0,
        課税対象額: 0,
        所得税: 0,
        立替家賃: 0
      };
      const 合計 = {
        総支給額: 0,
        総控除額: 0,
        差引支給額: 0
      };
      employees.push({
        userId: user?.id || parseInt(id, 10),
        従業員コード: user?.id || parseInt(id, 10),
        氏名: user?.username || '',
        対象年月: month,
        勤怠,
        支給,
        控除,
        合計,
        振込銀行: null
      });
    }
    res.status(200).json({
      companyName,
      issueDate,
      month,
      employees
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/salary', async (req, res) => {
  try {
    const { userIds, month } = req.query;
    if (!userIds || !month) {
      return res.status(400).json({ message: 'Missing userIds/month' });
    }
    let ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const issueDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    if (req.user?.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const myDept = me?.departmentId || null;
      const filtered = [];
      for (const id of ids) {
        const u = await userRepo.getUserById(id);
        if (u?.departmentId && myDept && String(u.departmentId) === String(myDept)) {
          filtered.push(id);
        }
      }
      ids = filtered;
    } else if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { employees } = await salaryService.computePayslips(ids, month);
    res.status(200).json({
      companyName,
      issueDate,
      month,
      employees
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Refresh tokens admin maintenance
const refreshRepo = require('../auth/refresh.repository');
router.post('/auth/refresh/cleanup', authorize('admin'), async (req, res) => {
  try {
    const r = await refreshRepo.cleanupExpired();
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/auth/refresh/list', authorize('admin'), async (req, res) => {
  try {
    const { userId, page, pageSize } = req.query;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const r = await refreshRepo.listByUser(userId, { page, pageSize });
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/auth/refresh/revoke-all', authorize('admin'), async (req, res) => {
  try {
    try {
      await auditRepo.writeLog({ userId: req.user?.id, action: 'admin_revoke_all_refresh_tokens', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: null });
    } catch {}
    const r = await refreshRepo.deleteAllTokens();
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const settingsService = require('../settings/settings.service');
const attendanceRepo = require('../attendance/attendance.repository');
const calendarRepo = require('../calendar/calendar.repository');
router.post('/system/flags',
  authorize('admin'),
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req, res) => {
  try {
    const before = await settingsService.getFlags();
    const after = await settingsService.setFlags(req.body || {});
    try {
      await auditRepo.writeLog({ userId: req.user?.id, action: 'admin_toggle_feature_flags', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before), afterData: JSON.stringify(after) });
    } catch {}
    res.status(200).json({ ok: true, before, after });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/system/flags',
  authorize('admin'),
  async (req, res) => {
  try {
    const r = await settingsService.getFlags();
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/attendance/ensure-schema',
  authorize('admin'),
  async (req, res) => {
  try {
    const cols = await attendanceRepo.ensureAttendanceSchemaPublic();
    res.status(200).json({ ok: true, columns: cols });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/attendance/columns',
  authorize('admin'),
  async (req, res) => {
  try {
    const cols = await attendanceRepo.listColumns();
    res.status(200).json({ columns: cols });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/ping',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    res.status(200).json({ ok: true, year, version: 'calendar-router-online' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/holidays',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const r = await calendarRepo.computeYear(year);
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/calendar/holidays',
  authorize('admin'),
  async (req, res) => {
  try {
    const dates = Array.isArray(req.body?.dates) ? req.body.dates : [];
    await calendarRepo.upsertFixed(dates);
    const year = parseInt(String(req.body?.year || new Date().getUTCFullYear()), 10);
    const r = await calendarRepo.computeYear(year);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/calendar/materialize-jp',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.body?.year || new Date().getUTCFullYear()), 10);
    const r0 = await calendarRepo.materializeJapanYear(year);
    const r = await calendarRepo.computeYear(year);
    res.status(201).json({ materialized: r0, calendar: r });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/raw',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    const rows = await calendarRepo.listAllByYear(year);
    const types = String(req.query.type || '').split(',').map(s => s.trim()).filter(Boolean);
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    let filtered = types.length ? rows.filter(r => types.includes(String(r.type))) : rows;
    if (from) filtered = filtered.filter(r => String(r.date) >= from);
    if (to) filtered = filtered.filter(r => String(r.date) <= to);
    res.status(200).json({ year, rows: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete('/calendar/jp',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || req.body?.year || new Date().getUTCFullYear()), 10);
    const [result] = await require('../../core/database/mysql').query(
      `DELETE FROM company_holidays WHERE YEAR(date) = ? AND type IN ('jp_auto','jp_substitute','jp_bridge')`,
      [year]
    );
    res.status(200).json({ ok: true, year, affected: result?.affectedRows ?? null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/export',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    let rows = await calendarRepo.listAllByYear(year);
    const lang = (req.query.lang || req.headers['accept-language'] || '').toLowerCase();
    const isJa = lang.startsWith('ja');
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const includeNonOff = String(req.query.include_nonoff || '').toLowerCase() === 'true';
    if (from) rows = rows.filter(r => String(r.date) >= from);
    if (to) rows = rows.filter(r => String(r.date) <= to);
    const pad = n => String(n).padStart(2, '0');
    const uid = (d, t) => `${year}-${d}-${t}@attendance`;
    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//attendance//calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n';
    for (const r of rows) {
      if (!includeNonOff && !r.is_off) continue;
      const dt = String(r.date);
      const summary = isJa ? (r.name?.split(' / ')[0] || r.name || '') : (r.name?.split(' / ').slice(-1)[0] || r.name || '');
      const y = dt.slice(0,4), m = dt.slice(5,7), d = dt.slice(8,10);
      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${uid(dt, r.type)}\r\n`;
      ics += `DTSTAMP:${y}${m}${d}T000000Z\r\n`;
      ics += `DTSTART;VALUE=DATE:${y}${m}${d}\r\n`;
      ics += `SUMMARY:${summary}\r\n`;
      ics += 'END:VEVENT\r\n';
    }
    ics += 'END:VCALENDAR\r\n';
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"company_holidays_${year}.ics\"`);
    res.status(200).send(ics);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/calendar/export.csv',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    let rows = await calendarRepo.listAllByYear(year);
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const types = String(req.query.type || '').split(',').map(s => s.trim()).filter(Boolean);
    const lang = (req.query.lang || req.headers['accept-language'] || '').toLowerCase();
    const isJa = lang.startsWith('ja');
    if (from) rows = rows.filter(r => String(r.date) >= from);
    if (to) rows = rows.filter(r => String(r.date) <= to);
    if (types.length) rows = rows.filter(r => types.includes(String(r.type)));
    const nameJa = s => String(s || '').split(' / ')[0] || null;
    const nameEn = s => {
      const parts = String(s || '').split(' / ');
      return parts.length > 1 ? parts[1] : null;
    };
    const label = (s) => {
      const ja = nameJa(s) || '';
      const en = nameEn(s) || '';
      return isJa ? (ja || en) : (en || ja);
    };
    let csv = 'date,month,name,label,name_ja,name_en,type,is_off\r\n';
    for (const r of rows) {
      const month = String(r.date).slice(0, 7);
      csv += `${r.date},${month},${r.name || ''},${label(r.name || '')},${nameJa(r.name) || ''},${nameEn(r.name) || ''},${r.type},${r.is_off}\r\n`;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"company_holidays_${year}.csv\"`);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Shift definitions & assignments (sub-router)
const shiftsRouter = express.Router();
shiftsRouter.get('/definitions', async (req, res) => {
  try {
    const rows = await attendanceRepo.listShiftDefinitions();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
shiftsRouter.post('/definitions', async (req, res) => {
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
shiftsRouter.post('/assign', async (req, res) => {
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
shiftsRouter.post('/backfill', async (req, res) => {
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
router.use('/shifts', authorize('admin'), shiftsRouter);
// Direct routes for shifts (for clients relying on top-level route listing)
router.get('/shifts/definitions', authorize('admin'), async (req, res) => {
  try {
    const rows = await attendanceRepo.listShiftDefinitions();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/definitions', authorize('admin'), async (req, res) => {
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
router.post('/shifts/assign', authorize('admin'), async (req, res) => {
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
router.post('/shifts/backfill', authorize('admin'), async (req, res) => {
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
router.get('/shifts/ping', authorize('admin'), (req, res) => {
  res.status(200).json({ ok: true, version: 'shifts-router-online' });
});
router.get('/debug/routes',
  authorize('admin'),
  async (req, res) => {
  try {
    const list = (router.stack || [])
      .map(l => l.route ? { path: l.route.path, methods: Object.keys(l.route.methods || {}) } : null)
      .filter(Boolean);
    res.status(200).json({ routes: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
const { nowUTCMySQL, nowJSTMySQL } = require('../../utils/dateTime');
router.get('/debug/time',
  authorize('admin'),
  async (req, res) => {
  try {
    res.status(200).json({ nowUTC: nowUTCMySQL(), nowJST: nowJSTMySQL() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Salary history close & view
const salaryRepo = require('../salary/salary.repository');
router.post('/salary/close-month', authorize('admin'), async (req, res) => {
  try {
    const { userIds, month } = req.body || {};
    if (!userIds || !month) {
      return res.status(400).json({ message: 'Missing userIds/month' });
    }
    const ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    const { employees } = await salaryService.computePayslips(ids, month);
    for (const e of employees) {
      await salaryRepo.saveHistory(e.userId, month, e);
    }
    res.status(201).json({ closed: employees.length, month });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/salary/history', authorize('admin'), async (req, res) => {
  try {
    const { userId, month, page, pageSize } = req.query;
    const r = await salaryRepo.listHistory({ userId, month, page, pageSize });
    res.status(200).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Shift definitions & assignments
router.get('/shifts/definitions', authorize('admin'), async (req, res) => {
  try {
    const rows = await attendanceRepo.listShiftDefinitions();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/shifts/definitions', authorize('admin'), async (req, res) => {
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
router.post('/shifts/assign', authorize('admin'), async (req, res) => {
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
router.post('/shifts/backfill', authorize('admin'), async (req, res) => {
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
