const attendanceService = require('../attendance/attendance.service');
const userRepo = require('../users/user.repository');
const salaryService = require('../salary/salary.service');
const refreshRepo = require('../auth/refresh.repository');
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
