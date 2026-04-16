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
const calendarRepo = require('../calendar/calendar.repository');
const { companyName, payslipEncKey, payslipKeyVersion } = require('../../config/env');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const salaryService = require('../salary/salary.service');
const salaryInputRepo = require('../salary/salaryInput.repository');
const payslipRepo = require('../payslip/payslip.repository');
const db = require('../../core/database/mysql');
const upload = require('../../core/middleware/upload');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { buildPayslipPdf } = require('../salary/payslipPdf');
const allowDebugRoutes = process.env.NODE_ENV !== 'production' || String(process.env.ENABLE_DEBUG_ROUTES || '').toLowerCase() === 'true';
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
}, rateLimitNamed('admin_users_create', { windowMs: 60_000, max: 10 }), authorize('admin'), userCtrl.create);
router.patch('/users/:id', async (req, res, next) => {
  try {
    const before = await userRepo.getUserById(req.params.id);
    await auditRepo.writeLog({ userId: req.user.id, action: 'admin_user_update', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: JSON.stringify(req.body || {}) });
  } catch {}
  next();
}, rateLimitNamed('admin_users_update', { windowMs: 60_000, max: 30 }), authorize('admin'), userCtrl.update);
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
}, rateLimitNamed('admin_users_delete', { windowMs: 60_000, max: 10 }), authorize('admin'), userCtrl.remove);
// Employees alias
router.get('/employees', authorize('admin'), userCtrl.list);
router.get('/employees/:id', permit('employees','view'), async (req, res) => {
  try {
    const id = req.params.id;
    const row = await userRepo.getUserById(id);
    if (!row) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/employees/:id/export.xlsx', permit('employees','view'), async (req, res) => {
  try {
    const id = parseInt(String(req.params.id || ''), 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const target = await userRepo.getUserById(id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (String(req.user?.role).toLowerCase() === 'manager'
        && String(process.env.MANAGER_STRICT_DEPT || '').toLowerCase() === 'true') {
      const me = await userRepo.getUserById(req.user.id);
      const myDept = me?.departmentId;
      if (!myDept || String(target.departmentId) !== String(myDept)) {
        return res.status(403).json({ message: 'Managers can only view employees in their own department' });
      }
    }

    const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
    const year = parseInt(String(req.query.year || nowJst.getUTCFullYear()), 10) || nowJst.getUTCFullYear();
    const start = `${String(year).padStart(4, '0')}-01-01`;
    const end = `${String(year).padStart(4, '0')}-12-31`;

    const [[info]] = await db.query(`
      SELECT
        u.*,
        d.name AS departmentName,
        m.username AS managerName,
        m.employee_code AS managerEmployeeCode
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      LEFT JOIN users m ON m.id = u.manager_id
      WHERE u.id = ?
      LIMIT 1
    `, [id]);

    const [attRows] = await db.query(`
      SELECT id, checkIn, checkOut, work_type, labels, shiftId
      FROM attendance
      WHERE userId = ?
        AND DATE(checkIn) >= ? AND DATE(checkIn) <= ?
      ORDER BY checkIn ASC
    `, [id, start, end]);

    const [repRows] = await db.query(`
      SELECT date, work_type, site, work, updated_at
      FROM work_reports
      WHERE userId = ?
        AND date >= ? AND date <= ?
      ORDER BY date ASC
    `, [id, start, end]);

    const [leaveRows] = await db.query(`
      SELECT type, status, startDate, endDate, reason, created_at
      FROM leave_requests
      WHERE userId = ?
        AND endDate >= ? AND startDate <= ?
      ORDER BY startDate ASC, created_at ASC
    `, [id, start, end]);

    const cal = await calendarRepo.computeYear(year).catch(() => null);
    const offSet = new Set((cal?.off_days || []).map(ds => String(ds).slice(0, 10)));
    const isOff = (dateStr) => offSet.has(String(dateStr).slice(0, 10));

    const fmt = (v) => (v == null ? '' : String(v));
    const fmtDate = (v) => String(v || '').slice(0, 10);
    const fmtHm = (v) => {
      if (!v) return '';
      const s = String(v);
      return s.length >= 16 ? s.slice(11, 16) : s;
    };
    const dowJa = (dateStr) => {
      try {
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
      } catch {
        return '';
      }
    };
    const roleLabel = (r) => {
      const s = String(r || '').toLowerCase();
      if (s === 'admin') return '管理者';
      if (s === 'manager') return 'マネージャー';
      if (s === 'employee') return '従業員';
      return r || '';
    };
    const wtLabel = (wt) => wt === 'onsite' ? '出社' : wt === 'remote' ? '在宅' : wt === 'satellite' ? '現場/出張' : '';
    const empTypeLabel = (t) => {
      const s = String(t || '').toLowerCase();
      if (s === 'full_time') return '正社員';
      if (s === 'part_time') return 'パート・アルバイト';
      if (s === 'contract') return '契約社員';
      return t || '';
    };
    const empStatusLabel = (t) => {
      const s = String(t || '').toLowerCase();
      if (s === 'active') return '在籍';
      if (s === 'inactive') return '無効/休職';
      if (s === 'retired') return '退職';
      return t || '';
    };

    const profileRows = [];
    const addKV = (k, v) => { if (String(v ?? '').trim() !== '') profileRows.push({ isOff: false, cells: [k, fmt(v)] }); };
    addKV('ID', info?.id ?? id);
    addKV('社員番号', info?.employee_code);
    addKV('氏名', info?.username);
    addKV('メール', info?.email);
    addKV('部署', info?.departmentName);
    addKV('役割', roleLabel(info?.role));
    addKV('雇用形態', empTypeLabel(info?.employment_type));
    addKV('雇用状態', empStatusLabel(info?.employment_status));
    addKV('レベル', info?.level);
    addKV('直属マネージャー', info?.managerName || info?.managerEmployeeCode ? `${info?.managerEmployeeCode || ''} ${info?.managerName || ''}`.trim() : '');
    addKV('入社日', fmtDate(info?.hire_date));
    addKV('参加日', fmtDate(info?.join_date));
    addKV('試用期間', fmtDate(info?.probation_date));
    addKV('正式日', fmtDate(info?.official_date));
    addKV('契約終了', fmtDate(info?.contract_end));
    addKV('基本給', info?.base_salary);
    addKV('シフトID', info?.shift_id);
    addKV('電話', info?.phone);
    addKV('生年月日', fmtDate(info?.birth_date));
    addKV('性別', info?.gender);
    addKV('住所', info?.address);
    addKV('言語', info?.lang);
    addKV('地域', info?.region);
    addKV('タイムゾーン', info?.timezone);
    addKV('在留番号', info?.visa_number);
    addKV('在留期限', fmtDate(info?.visa_expiry));
    addKV('保険番号', info?.insurance_number);

    const segRows = (attRows || []).map(a => {
      const d = fmtDate(a.checkIn);
      return {
        isOff: isOff(d),
        cells: [
          d,
          dowJa(d),
          fmt(a.id),
          fmtHm(a.checkIn),
          fmtHm(a.checkOut),
          wtLabel(a.work_type),
          fmt(a.shiftId),
          fmt(a.labels)
        ]
      };
    });

    const wrRows = (repRows || []).map(r => {
      const d = fmtDate(r.date);
      return {
        isOff: isOff(d),
        cells: [
          d,
          dowJa(d),
          wtLabel(r.work_type),
          fmt(r.site),
          fmt(r.work),
          fmtDate(r.updated_at) + (r.updated_at ? ' ' + fmtHm(r.updated_at) : '')
        ]
      };
    });

    const lvRows = (leaveRows || []).map(lr => {
      const d0 = fmtDate(lr.startDate);
      return {
        isOff: isOff(d0),
        cells: [
          fmt(lr.status),
          fmt(lr.type),
          fmtDate(lr.startDate),
          fmtDate(lr.endDate),
          fmt(lr.reason),
          fmtDate(lr.created_at)
        ]
      };
    });

    const { buildXlsxBook } = require('../../utils/xlsx');
    const buf = buildXlsxBook({
      sheets: [
        {
          name: `Profile ${year}`,
          columns: [{ header: '項目', width: 18 }, { header: '値', width: 52 }],
          rows: profileRows
        },
        {
          name: `Segments ${year}`,
          columns: [
            { header: '日付', width: 12 },
            { header: '曜日', width: 6 },
            { header: 'ID', width: 10 },
            { header: '出勤', width: 8 },
            { header: '退勤', width: 8 },
            { header: '勤務区分', width: 12 },
            { header: 'シフト', width: 8 },
            { header: 'Labels', width: 30 }
          ],
          rows: segRows
        },
        {
          name: `WorkReports ${year}`,
          columns: [
            { header: '日付', width: 12 },
            { header: '曜日', width: 6 },
            { header: '勤務区分', width: 12 },
            { header: '現場', width: 18 },
            { header: '作業内容', width: 48 },
            { header: '更新日', width: 18 }
          ],
          rows: wrRows
        },
        {
          name: `Leave ${year}`,
          columns: [
            { header: '状態', width: 10 },
            { header: '種類', width: 10 },
            { header: '開始', width: 12 },
            { header: '終了', width: 12 },
            { header: '理由', width: 36 },
            { header: '申請日', width: 12 }
          ],
          rows: lvRows
        }
      ]
    });

    const fileName = `employee_${info?.employee_code || id}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(buf);
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
router.get('/export/attendance-month.csv', authorize('admin','manager'), async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).send('Missing month (YYYY-MM)');
    }
    const deptId = req.query.deptId ? String(req.query.deptId) : null;
    const y = parseInt(month.slice(0, 4), 10);
    const m = parseInt(month.slice(5, 7), 10);
    const pad2 = (n) => String(n).padStart(2, '0');
    const start = `${y}-${pad2(m)}-01`;
    const next = new Date(Date.UTC(y, m, 1));
    const nextStart = `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
    const whereDept = deptId ? 'AND u.departmentId = ?' : '';
    const params1 = [start + ' 00:00:00', nextStart + ' 00:00:00'];
    if (deptId) params1.push(deptId);
    const [rows1] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        d.name AS departmentName,
        DATE(a.checkIn) AS date,
        MIN(a.checkIn) AS checkIn,
        MAX(a.checkOut) AS checkOut,
        MAX(wr.site) AS site,
        MAX(wr.work) AS work
      FROM users u
      LEFT JOIN departments d ON d.id = u.departmentId
      INNER JOIN attendance a
        ON a.userId = u.id
       AND a.checkIn >= ? AND a.checkIn < ?
      LEFT JOIN work_reports wr
        ON wr.userId = u.id AND wr.date = DATE(a.checkIn)
      WHERE u.employment_status = 'active'
        AND u.role IN ('employee','manager')
        ${whereDept}
      GROUP BY u.id, DATE(a.checkIn)
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC, date ASC
    `, params1);

    const params2 = [start, nextStart];
    if (deptId) params2.push(deptId);
    const [rows2] = await db.query(`
      SELECT
        u.id AS userId,
        u.employee_code AS employeeCode,
        u.username AS username,
        d.name AS departmentName,
        wr.date AS date,
        NULL AS checkIn,
        NULL AS checkOut,
        wr.site AS site,
        wr.work AS work
      FROM work_reports wr
      INNER JOIN users u ON u.id = wr.userId
      LEFT JOIN departments d ON d.id = u.departmentId
      LEFT JOIN attendance a
        ON a.userId = wr.userId AND DATE(a.checkIn) = wr.date
      WHERE wr.date >= ? AND wr.date < ?
        AND a.id IS NULL
        AND u.employment_status = 'active'
        AND u.role IN ('employee','manager')
        ${whereDept}
      ORDER BY COALESCE(u.employee_code, '') ASC, u.id ASC, date ASC
    `, params2);

    const csvEsc = (v) => {
      const s = String(v ?? '');
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtHm = (dt) => {
      if (!dt) return '';
      const s = String(dt);
      return s.length >= 16 ? s.slice(11, 16) : s;
    };
    const header = '社員番号,氏名,部署,日付,出勤,退勤,現場,作業内容\n';
    let csv = header;
    for (const r of [...(rows1 || []), ...(rows2 || [])]) {
      csv += [
        csvEsc(r.employeeCode || `EMP${String(r.userId).padStart(3,'0')}`),
        csvEsc(r.username || ''),
        csvEsc(r.departmentName || ''),
        csvEsc(String(r.date || '').slice(0, 10)),
        csvEsc(fmtHm(r.checkIn)),
        csvEsc(fmtHm(r.checkOut)),
        csvEsc(r.site || ''),
        csvEsc(r.work || '')
      ].join(',') + '\n';
    }
    const filename = `attendance_${month}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
    res.status(200).send('\uFEFF' + csv);
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
    const daily = await attendanceRepo.getDaily(userId, date).catch(() => null);
    res.status(200).json({ date, daily: daily ? {
      workType: daily.work_type || null,
      location: daily.location || null,
      reason: daily.reason || null,
      memo: daily.memo || null,
      breakMinutes: daily.break_minutes == null ? null : Number(daily.break_minutes),
      nightBreakMinutes: daily.night_break_minutes == null ? null : Number(daily.night_break_minutes)
    } : null, segments: rows });
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

async function ensureSameDepartmentIfManager(req, targetUserId) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role !== 'manager') return true;
  if (String(process.env.MANAGER_STRICT_DEPT || '').toLowerCase() !== 'true') return true;
  const me = await userRepo.getUserById(req.user.id);
  const target = await userRepo.getUserById(targetUserId);
  if (!me?.departmentId || !target?.departmentId) return false;
  return String(me.departmentId) === String(target.departmentId);
}

function normalizeJsonPayload(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(String(v)); } catch { return null; }
}

const EARNING_LABELS = new Set([
  '基礎給',
  '就業手当',
  '時間外手当',
  '所休出手当',
  '週40超手当',
  '月60超手当',
  '法休出手当',
  '深夜勤手当',
  '夜間出勤手当',
  '休日出勤手当',
  '固定残業手当',
  '非課税通勤費',
  '資格手当',
  '通信手当',
  '誕生日月手当',
  '残業手当',
  '欠勤控除',
  '催事協力手当'
]);

function normalizeDeductionLabel(label) {
  const s = String(label || '').trim();
  if (!s) return s;
  if (s === '健康保険') return '健康保険料';
  if (s === '介護保険') return '介護保険料';
  if (s === '厚生年金') return '厚生年金保険';
  if (s === '雇用保険') return '雇用保険料';
  if (s === '住民票') return '住民税';
  return s;
}

function normalizeSalaryPayload(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const out = { ...p };

  const normDeductionEntries = (entries) => {
    const o = {};
    for (const [k0, v] of entries) {
      const k = normalizeDeductionLabel(k0);
      if (!k) continue;
      if (EARNING_LABELS.has(k)) throw new Error(`控除に「${k}」は入力できません`);
      if (k === '社保合計額' || k === '課税対象額') throw new Error(`控除に「${k}」は入力できません`);
      o[k] = v;
    }
    return o;
  };

  if (Array.isArray(out.overrideDeductions)) {
    out.overrideDeductions = out.overrideDeductions.map(it => ({ ...it, label: normalizeDeductionLabel(it?.label) }));
    for (const it of out.overrideDeductions) {
      const k = String(it?.label || '').trim();
      if (!k) continue;
      if (EARNING_LABELS.has(k)) throw new Error(`控除に「${k}」は入力できません`);
      if (k === '社保合計額' || k === '課税対象額') throw new Error(`控除に「${k}」は入力できません`);
    }
  } else if (out.overrideDeductions && typeof out.overrideDeductions === 'object') {
    out.overrideDeductions = normDeductionEntries(Object.entries(out.overrideDeductions));
  }

  if (Array.isArray(out.extraDeductions)) {
    out.extraDeductions = out.extraDeductions.map(it => ({ ...it, label: normalizeDeductionLabel(it?.label) }));
    for (const it of out.extraDeductions) {
      const k = String(it?.label || '').trim();
      if (!k) continue;
      if (EARNING_LABELS.has(k)) throw new Error(`控除に「${k}」は入力できません`);
      if (k === '社保合計額' || k === '課税対象額') throw new Error(`控除に「${k}」は入力できません`);
    }
  }

  return out;
}

router.get('/salary/input', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = parseInt(String(req.query?.userId || ''), 10);
    const month = String(req.query?.month || '').slice(0, 7);
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const row = await salaryInputRepo.getByUserMonth(userId, month);
    res.status(200).json({ 
      userId, 
      month, 
      payload: normalizeJsonPayload(row?.payload), 
      is_published: Boolean(row?.is_published),
      updatedBy: row?.updated_by || null, 
      updatedAt: row?.updated_at || null 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/salary/input', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const body = req.body || {};
    const userId = parseInt(String(body.userId || ''), 10);
    const month = String(body.month || '').slice(0, 7);
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const payload0 = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const payload = normalizeSalaryPayload(payload0);
    const row = await salaryInputRepo.upsert({ userId, month, payload, updatedBy: req.user.id });
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'salary_input_upsert', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ userId, month }) });
    } catch {}
    res.status(200).json({ ok: true, row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/salary/preview', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = parseInt(String(req.query?.userId || ''), 10);
    const month = String(req.query?.month || '').slice(0, 7);
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const input = await salaryInputRepo.getByUserMonth(userId, month);
    const options = normalizeJsonPayload(input?.payload);
    const emp = await salaryService.computePayslipForUser(userId, month, options || null);
    res.status(200).json(emp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/salary/preview-live', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const body = req.body || {};
    const userId = parseInt(String(body.userId || ''), 10);
    const month = String(body.month || '').slice(0, 7);
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const payload0 = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const payload = normalizeSalaryPayload(payload0);
    const emp = await salaryService.computePayslipForUser(userId, month, payload || null);
    res.status(200).json(emp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

function pdfFromPayslip(emp, meta) {
  return buildPayslipPdf({ employee: emp, companyName: meta.companyName, issueDate: meta.issueDate });
}

function normalizeBankAccountParts(v) {
  if (!v || typeof v !== 'object') return null;
  const bankName = String(v.bankName || '').trim();
  const branchName = String(v.branchName || '').trim();
  const accountType = String(v.accountType || '').trim();
  const accountNumber = String(v.accountNumber || '').replace(/[^\d]/g, '').trim();
  const accountHolder = String(v.accountHolder || '').trim();
  return { bankName, branchName, accountType, accountNumber, accountHolder };
}

function validateBankAccount({ bankAccount, bankAccountParts }) {
  const p = normalizeBankAccountParts(bankAccountParts);
  if (p && (p.bankName || p.branchName || p.accountType || p.accountNumber || p.accountHolder)) {
    const errs = [];
    if (!p.bankName) errs.push('bankName');
    if (!p.branchName) errs.push('branchName');
    if (!['普通', '当座'].includes(p.accountType)) errs.push('accountType');
    if (!/^\d{7}$/.test(p.accountNumber)) errs.push('accountNumber');
    if (!p.accountHolder) errs.push('accountHolder');
    if (errs.length) return { ok: false, message: `Invalid bankAccountParts: ${errs.join(', ')}` };
    return { ok: true };
  }
  const s = String(bankAccount || '').trim();
  if (!s) return { ok: true };
  const digits = (s.match(/\d/g) || []).length;
  if (digits < 7) return { ok: false, message: '振込口座の番号が不足しています（7桁）' };
  if (s.length < 8) return { ok: false, message: '振込口座が短すぎます' };
  return { ok: true };
}

function validatePaymentConsistency(emp) {
  const net = Number(emp?.合計?.差引支給額 || 0);
  const bank = Number(emp?.支払?.振込支給額 || 0);
  const cash = Number(emp?.支払?.現金支給額 || 0);
  const kind = Number(emp?.支払?.現物支給額 || 0);
  const sum = bank + cash + kind;
  if (Math.round(sum) !== Math.round(net)) {
    return { ok: false, message: `支払内訳の合計が差引支給額と一致しません（${sum} != ${net}）` };
  }
  return { ok: true };
}

const payslipDeliveryRepo = require('../salary/payslipDelivery.repository');

async function writePayslipFile({ userId, month, pdfBuf, actorId, originalName }) {
  const dir = path.join(__dirname, '../../', 'uploads', 'payslips');
  fs.mkdirSync(dir, { recursive: true });
  const baseName = `payslip_${userId}_${month}_${Date.now()}.pdf`;
  let filename = baseName;
  let iv = null;
  let tag = null;
  let hash = crypto.createHash('sha256').update(pdfBuf).digest('hex');
  let keyVersion = null;
  let outBuf = pdfBuf;
  if (payslipEncKey) {
    const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
    const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
    iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    outBuf = Buffer.concat([cipher.update(pdfBuf), cipher.final()]);
    tag = cipher.getAuthTag();
    filename = baseName + '.enc';
    keyVersion = payslipKeyVersion;
  }
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, outBuf);

  const existing = await payslipRepo.findLatestByUserMonth(userId, month);
  const originalName2 = String(originalName || `payslip_${month}.pdf`);
  let id = null;
  let version = 1;
  if (existing?.id) {
    try {
      const oldPath = path.join(dir, String(existing.filename || ''));
      if (existing.filename && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch {}
    version = (existing.version || 1) + 1;
    const updated = await payslipRepo.updateFile(existing.id, filename, originalName2, actorId, iv, tag, keyVersion, hash, version);
    id = updated?.id || existing.id;
  } else {
    id = await payslipRepo.create({ userId, month, filename, originalName: originalName2, uploadedBy: actorId, iv, authTag: tag, keyVersion, hash, version: 1 });
  }
  return { id, filename, version };
}

router.post('/salary/payslip/generate', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const body = req.body || {};
    const userId = parseInt(String(body.userId || ''), 10);
    const month = String(body.month || '').slice(0, 7);
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const input = await salaryInputRepo.getByUserMonth(userId, month);
    const options = normalizeJsonPayload(input?.payload);
    const emp = await salaryService.computePayslipForUser(userId, month, options || null);
    try {
      emp._bankAccountParts = normalizeBankAccountParts(options?.bankAccountParts);
    } catch {}
    const bankCheck = validateBankAccount({ bankAccount: emp?.振込口座 || emp?.振込銀行, bankAccountParts: options?.bankAccountParts });
    if (!bankCheck.ok) return res.status(400).json({ message: bankCheck.message });
    const payCheck = validatePaymentConsistency(emp);
    if (!payCheck.ok) return res.status(400).json({ message: payCheck.message });
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const issueDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    const pdfBuf = await pdfFromPayslip(emp, { companyName, issueDate });
    const m = String(month || '');
    const y = m.slice(0, 4);
    const mm = m.slice(5, 7);
    const empCode = String(emp?.従業員コード || emp?.userId || userId || '').trim() || String(userId);
    const originalName = `${y}年${mm}月給与明細${empCode}.pdf`;
    const saved = await writePayslipFile({ userId, month, pdfBuf, actorId: req.user.id, originalName });
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_generate', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ userId, month, payslipId: saved.id }) });
    } catch {}
    res.status(201).json({ id: saved.id, month, secureUrl: `/api/payslips/admin/file/${saved.id}?v=${encodeURIComponent(saved.version || 1)}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/salary/publish', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const body = req.body || {};
    const userId = parseInt(String(body.userId || ''), 10);
    const month = String(body.month || '').slice(0, 7);
    const isPublished = Boolean(body.is_published);

    if (!userId || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Missing userId/month' });
    if (!(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }

    const input = await salaryInputRepo.getByUserMonth(userId, month);
    if (!input) return res.status(404).json({ message: '給与データが保存されていません（先に保存してください）' });

    if (isPublished) {
      const file = await payslipRepo.findLatestByUserMonth(userId, month);
      if (!file?.id) return res.status(404).json({ message: 'PDFが作成されていません（先にPDF作成してください）' });
      try { await payslipDeliveryRepo.create({ userId, month, payslipFileId: file.id, sentBy: req.user.id }); } catch {}
    }

    await salaryInputRepo.setPublished(userId, month, isPublished, req.user.id);
    
    try {
      await auditRepo.writeLog({ 
        userId: req.user.id, 
        action: isPublished ? 'payslip_publish' : 'payslip_unpublish', 
        path: req.path, 
        method: req.method, 
        ip: req.ip, 
        userAgent: req.headers['user-agent'], 
        beforeData: JSON.stringify({ is_published: input.is_published }), 
        afterData: JSON.stringify({ userId, month, is_published: isPublished }) 
      });
    } catch {}

    res.status(200).json({ message: isPublished ? '公開しました' : '非公開にしました', is_published: isPublished });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/salary/deliveries', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = req.query?.userId ? parseInt(String(req.query.userId), 10) : null;
    const month = req.query?.month ? String(req.query.month).slice(0, 7) : null;
    if (userId && !(await ensureSameDepartmentIfManager(req, userId))) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const rows = await payslipDeliveryRepo.list({ userId, month, limit: 500 });
    const items = rows.map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.user_name || r.user_email || '',
      month: r.month,
      fileId: r.payslip_file_id,
      fileName: r.original_name,
      sentAt: r.sent_at,
      sentBy: r.sent_by,
      senderName: r.sender_name || r.sender_email || ''
    }));
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/salary/deliveries/:id', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const id = parseInt(String(req.params.id || ''), 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const row = await payslipDeliveryRepo.getById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    }
    const before = await payslipDeliveryRepo.deleteById(id);
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_delivery_delete', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify(before || {}), afterData: null });
    } catch {}
    res.status(200).json({ ok: true, id });
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
const db2 = require('../../core/database/mysql');
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
    const csvEsc = (v) => {
      const s = String(v ?? '');
      return `"${s.replace(/"/g, '""')}"`;
    };
    let csv = '\uFEFF' + 'date,month,name,label,name_ja,name_en,type,is_off\r\n';
    for (const r of rows) {
      const month = String(r.date).slice(0, 7);
      csv += [
        csvEsc(String(r.date || '').slice(0, 10)),
        csvEsc(month),
        csvEsc(r.name || ''),
        csvEsc(label(r.name || '')),
        csvEsc(nameJa(r.name) || ''),
        csvEsc(nameEn(r.name) || ''),
        csvEsc(r.type || ''),
        csvEsc(String(r.is_off ?? ''))
      ].join(',') + '\r\n';
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"company_holidays_${year}.csv\"`);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/salary/files', async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
    const userId = req.query?.userId ? parseInt(String(req.query.userId), 10) : null;
    const month = req.query?.month ? String(req.query.month).slice(0, 7) : null;
    const limit = Math.max(1, Math.min(1000, parseInt(String(req.query?.limit || '500'), 10) || 500));
    if (role === 'manager' && userId) {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    }
    let sql = `
      SELECT f.id, f.userId, f.month, f.original_name, f.created_at, f.uploaded_by,
             u.username AS user_name, u.email AS user_email,
             s.username AS uploader_name, s.email AS uploader_email
      FROM payslip_files f
      JOIN users u ON u.id = f.userId
      LEFT JOIN users s ON s.id = f.uploaded_by
      WHERE 1=1
    `;
    const params = [];
    if (userId) { sql += ` AND f.userId = ?`; params.push(userId); }
    if (month) { sql += ` AND f.month = ?`; params.push(month); }
    sql += ` ORDER BY f.created_at DESC LIMIT ?`;
    params.push(limit);
    const [rows] = await db2.query(sql, params);
    const items = (rows || []).map(r => ({
      id: r.id,
      userId: r.userId,
      userName: r.user_name || r.user_email || '',
      month: r.month,
      fileName: r.original_name,
      createdAt: r.created_at,
      uploadedBy: r.uploaded_by,
      uploaderName: r.uploader_name || r.uploader_email || ''
    }));
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/calendar/export.xls',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    let rows = await calendarRepo.listAllByYear(year);
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const types = String(req.query.type || '').split(',').map(s => s.trim()).filter(Boolean);
    const includeNonOff = String(req.query.include_nonoff || '').toLowerCase() === 'true';
    if (from) rows = rows.filter(r => String(r.date) >= from);
    if (to) rows = rows.filter(r => String(r.date) <= to);
    if (types.length) rows = rows.filter(r => types.includes(String(r.type)));
    if (!includeNonOff) rows = rows.filter(r => !!r.is_off);
    rows.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.type || '').localeCompare(String(b?.type || '')));

    const xml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;' }[c]));
    const nameJa = s => String(s || '').split(' / ')[0] || '';
    const nameEn = s => {
      const parts = String(s || '').split(' / ');
      return parts.length > 1 ? parts.slice(1).join(' / ') : '';
    };
    const dowJa = (dateStr) => {
      try {
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
      } catch {
        return '';
      }
    };
    const typeLabel = (t) => {
      const s = String(t || '');
      if (s === 'jp_auto') return '祝日';
      if (s === 'jp_substitute') return '振替';
      if (s === 'jp_bridge') return '国民の休日';
      if (s === 'fixed') return '会社';
      if (s === 'custom') return '任意';
      return s || '';
    };
    const cell = (styleId, val) => `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ''}><Data ss:Type="String">${xml(val)}</Data></Cell>`;
    const borderBlock = `
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    `;

    const sheetName = `Holidays ${year}`;
    const header = ['日付', '曜日', '種別', '休日', '名称', 'English'];
    const bodyRows = rows.map(r => {
      const dt = String(r?.date || '').slice(0, 10);
      const off = Number(r?.is_off || 0) ? '休' : '';
      const baseStyle = Number(r?.is_off || 0) ? 'OffCell' : 'Cell';
      return `<Row>
        ${cell(baseStyle, dt)}
        ${cell(baseStyle, dowJa(dt))}
        ${cell(baseStyle, typeLabel(r?.type))}
        ${cell(baseStyle, off)}
        ${cell(baseStyle, nameJa(r?.name || ''))}
        ${cell(baseStyle, nameEn(r?.name || ''))}
      </Row>`;
    }).join('');

    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#1F3553" ss:Pattern="Solid"/>
      ${borderBlock}
    </Style>
    <Style ss:ID="Cell">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
      ${borderBlock}
    </Style>
    <Style ss:ID="OffCell">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
      <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
      ${borderBlock}
    </Style>
  </Styles>
  <Worksheet ss:Name="${xml(sheetName)}">
    <Table ss:DefaultRowHeight="18">
      <Column ss:Width="86"/>
      <Column ss:Width="44"/>
      <Column ss:Width="76"/>
      <Column ss:Width="44"/>
      <Column ss:Width="300"/>
      <Column ss:Width="300"/>
      <Row ss:StyleID="Header">
        ${header.map(h => cell(null, h).replace('<Cell', '<Cell ss:StyleID="Header"')).join('')}
      </Row>
      ${bodyRows}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <Panes>
        <Pane>
          <Number>2</Number>
          <ActiveRow>1</ActiveRow>
          <ActiveCol>0</ActiveCol>
        </Pane>
      </Panes>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=\"company_holidays_${year}.xls\"`);
    res.status(200).send(workbook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/calendar/export.xlsx',
  authorize('admin'),
  async (req, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getUTCFullYear()), 10);
    let rows = await calendarRepo.listAllByYear(year);
    const from = String(req.query.from || '').slice(0, 10);
    const to = String(req.query.to || '').slice(0, 10);
    const types = String(req.query.type || '').split(',').map(s => s.trim()).filter(Boolean);
    const includeNonOff = String(req.query.include_nonoff || '').toLowerCase() === 'true';
    if (from) rows = rows.filter(r => String(r.date) >= from);
    if (to) rows = rows.filter(r => String(r.date) <= to);
    if (types.length) rows = rows.filter(r => types.includes(String(r.type)));
    if (!includeNonOff) rows = rows.filter(r => !!r.is_off);
    rows.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.type || '').localeCompare(String(b?.type || '')));

    const pad2 = (n) => String(n).padStart(2, '0');
    const dowJa = (dateStr) => {
      try {
        const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
      } catch {
        return '';
      }
    };
    const typeLabel = (t) => {
      const s = String(t || '');
      if (s === 'jp_auto') return '祝日';
      if (s === 'jp_substitute') return '振替';
      if (s === 'jp_bridge') return '国民の休日';
      if (s === 'fixed') return '会社';
      if (s === 'custom') return '任意';
      return s || '';
    };
    const nameJa = s => String(s || '').split(' / ')[0] || '';
    const nameEn = s => {
      const parts = String(s || '').split(' / ');
      return parts.length > 1 ? parts.slice(1).join(' / ') : '';
    };

    const columns = [
      { header: '日付', width: 12 },
      { header: '曜日', width: 6 },
      { header: '種別', width: 12 },
      { header: '休日', width: 6 },
      { header: '名称', width: 44 },
      { header: 'English', width: 44 }
    ];
    const sheetName = `Holidays ${year}`;
    const dataRows = rows.map(r => {
      const dt = String(r?.date || '').slice(0, 10);
      const off = Number(r?.is_off || 0) ? '休' : '';
      return {
        isOff: Number(r?.is_off || 0) === 1,
        cells: [
          dt,
          dowJa(dt),
          typeLabel(r?.type),
          off,
          nameJa(r?.name || ''),
          nameEn(r?.name || '')
        ]
      };
    });

    const { buildXlsx } = require('../../utils/xlsx');
    const buf = buildXlsx({ sheetName, columns, rows: dataRows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"company_holidays_${year}.xlsx\"`);
    res.status(200).send(buf);
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
const { nowUTCMySQL, nowJSTMySQL } = require('../../utils/dateTime');
if (allowDebugRoutes) {
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
  router.get('/debug/time',
    authorize('admin'),
    async (req, res) => {
    try {
      res.status(200).json({ nowUTC: nowUTCMySQL(), nowJST: nowJSTMySQL() });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
}
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
