const attendanceService = require('../attendance/attendance.service');
const userRepo = require('../users/user.repository');
const salaryService = require('../salary/salary.service');
const refreshRepo = require('../auth/refresh.repository');
const db = require('../../core/database/mysql');
// Controller quản lý: báo cáo nhóm, quản lý ca làm
exports.groupReport = async (req, res) => {
  try {
    const { userIds, from, to } = req.query;
    if (!userIds || !from || !to) {
      return res.status(400).json({ message: 'Missing userIds/from/to' });
    }
    const ids = String(userIds).split(',').map(s => s.trim()).filter(Boolean);
    const reports = [];
    for (const id of ids) {
      const r = await attendanceService.timesheet(id, from, to);
      reports.push({ userId: id, ...r });
    }
    const total = reports.reduce((acc, r) => {
      acc.regularMinutes += r.total.regularMinutes;
      acc.overtimeMinutes += r.total.overtimeMinutes;
      acc.nightMinutes += r.total.nightMinutes;
      return acc;
    }, { regularMinutes: 0, overtimeMinutes: 0, nightMinutes: 0 });
    res.status(200).json({ reports, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.assignShift = async (req, res) => {
  try {
    // Placeholder: yêu cầu tạo bảng user_shift_assignments trước khi dùng
    res.status(501).json({ message: 'Not Implemented: create table user_shift_assignments first' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Liệt kê nhân viên cùng phòng ban của manager
exports.listMyDepartment = async (req, res) => {
  try {
    const me = await userRepo.getUserById(req.user.id);
    const deptId = me?.departmentId || null;
    const all = await userRepo.listUsers();
    const rows = deptId ? all.filter(u => String(u.departmentId) === String(deptId)) : [];
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Danh sách phòng ban (cho manager)
exports.listDepartments = async (req, res) => {
  try {
    const rows = await userRepo.getAllDepartments();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Cập nhật thông tin nhân viên trong cùng phòng ban
exports.updateEmployeeInfo = async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId) return res.status(400).json({ message: 'Missing id' });
    const me = await userRepo.getUserById(req.user.id);
    const target = await userRepo.getUserById(targetId);
    if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    const b = req.body || {};
    await userRepo.updateUser(targetId, {
      username: b.username,
      email: b.email,
      departmentId: target.departmentId,
      employmentType: b.employmentType,
      lang: b.lang,
      region: b.region,
      timezone: b.timezone,
      address: b.address,
      contractType: b.contractType,
      visaNumber: b.visaNumber,
      visaExpiry: b.visaExpiry,
      insuranceNumber: b.insuranceNumber,
      employmentStatus: b.employmentStatus
    });
    res.status(200).json({ id: targetId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Xem trước bảng lương cho phòng ban của manager
exports.salaryPreviewDepartment = async (req, res) => {
  try {
    const month = String(req.query.month || '').trim();
    if (!month) return res.status(400).json({ message: 'Missing month' });
    const me = await userRepo.getUserById(req.user.id);
    const deptId = me?.departmentId || null;
    if (!deptId) return res.status(400).json({ message: 'No department set for manager' });
    const all = await userRepo.listUsers();
    const ids = all.filter(u => String(u.departmentId) === String(deptId)).map(u => u.id);
    const { employees } = await salaryService.computePayslips(ids, month);
    res.status(200).json({ month, employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Xử lý nghỉ việc: chuyển trạng thái và revoke tokens
exports.resignEmployee = async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!targetId) return res.status(400).json({ message: 'Missing id' });
    const me = await userRepo.getUserById(req.user.id);
    const target = await userRepo.getUserById(targetId);
    if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    await userRepo.updateUser(targetId, { employmentStatus: 'inactive' });
    await refreshRepo.deleteUserTokens(targetId);
    res.status(200).json({ id: targetId, status: 'inactive' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// === Phê duyệt yêu cầu cập nhật hồ sơ của nhân viên ===
async function ensureProfileChangeTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_change_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      fields_json TEXT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME NULL,
      approved_by BIGINT UNSIGNED NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
exports.listProfileChangePending = async (req, res) => {
  try {
    await ensureProfileChangeTable();
    const me = await userRepo.getUserById(req.user.id);
    const deptId = me?.departmentId || null;
    if (!deptId) return res.status(200).json([]);
    const [rows] = await db.query(`SELECT * FROM user_change_requests WHERE status='pending' ORDER BY created_at DESC`);
    const cache = new Map();
    const result = [];
    for (const r of rows) {
      if (!cache.has(r.user_id)) cache.set(r.user_id, await userRepo.getUserById(r.user_id));
      const target = cache.get(r.user_id);
      if (String(target?.departmentId) === String(deptId)) {
        result.push({
          id: r.id,
          userId: r.user_id,
          username: target?.username || '',
          email: target?.email || '',
          departmentId: target?.departmentId || null,
          status: r.status,
          createdAt: r.created_at,
          fields: (() => { try { return JSON.parse(r.fields_json); } catch { return {}; } })()
        });
      }
    }
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getProfileChange = async (req, res) => {
  try {
    await ensureProfileChangeTable();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const [rows] = await db.query(`SELECT * FROM user_change_requests WHERE id=? LIMIT 1`, [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Not found' });
    const me = await userRepo.getUserById(req.user.id);
    const target = await userRepo.getUserById(row.user_id);
    if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    res.status(200).json({
      id: row.id,
      userId: row.user_id,
      status: row.status,
      createdAt: row.created_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      fields: (() => { try { return JSON.parse(row.fields_json); } catch { return {}; } })(),
      user: { id: target.id, username: target.username, email: target.email, departmentId: target.departmentId }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.approveProfileChange = async (req, res) => {
  try {
    await ensureProfileChangeTable();
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    if (!id || !status) return res.status(400).json({ message: 'Missing id/status' });
    const [rows] = await db.query(`SELECT * FROM user_change_requests WHERE id=? LIMIT 1`, [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (row.status !== 'pending') return res.status(409).json({ message: 'Already processed' });
    const me = await userRepo.getUserById(req.user.id);
    const target = await userRepo.getUserById(row.user_id);
    if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
      return res.status(403).json({ message: 'Forbidden: cross-department access' });
    }
    if (String(status).toLowerCase() === 'approved') {
      let fields = {};
      try { fields = JSON.parse(row.fields_json) || {}; } catch {}
      await userRepo.updateUser(row.user_id, {
        username: fields.username,
        email: fields.email,
        role: fields.role,
        departmentId: fields.departmentId,
        level: fields.level,
        managerId: fields.managerId,
        employmentType: fields.employmentType,
        hireDate: fields.hireDate,
        birthDate: fields.birthDate,
        gender: fields.gender,
        phone: fields.phone,
        avatarUrl: fields.avatarUrl,
        probationDate: fields.probationDate,
        officialDate: fields.officialDate,
        address: fields.address,
        employmentStatus: fields.employmentStatus,
        contractEnd: fields.contractEnd,
        baseSalary: fields.baseSalary,
        shiftId: fields.shiftId,
        joinDate: fields.joinDate
      });
      await db.query(`UPDATE user_change_requests SET status='approved', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?`, [req.user.id, id]);
      return res.status(200).json({ id, status: 'approved' });
    } else if (String(status).toLowerCase() === 'rejected') {
      await db.query(`UPDATE user_change_requests SET status='rejected', approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE id=?`, [req.user.id, id]);
      return res.status(200).json({ id, status: 'rejected' });
    }
    return res.status(400).json({ message: 'Invalid status' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
