const repo = require('./user.repository');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../../config/env');
// Controller quản trị người dùng
exports.list = async (req, res) => {
  try {
    const rows = await repo.listUsers();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
const authRepo = require('../auth/auth.repository');
const refreshRepo = require('../auth/refresh.repository');
exports.create = async (req, res) => {
  try {
    const { employeeCode, username, email, password, role, departmentId, employmentType, hireDate } = req.body || {};
    if (!username || !email || !password || !(role || departmentId !== undefined)) {
      return res.status(400).json({ message: 'Missing username/email/password' });
    }
    const existing = await authRepo.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'Email đã tồn tại!' });
    }
    const hashed = bcrypt.hashSync(password, bcryptRounds);
    const id = await repo.createUser({ employeeCode, username, email, password: hashed, role, departmentId, employmentType, hireDate });
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const body = req.body || {};
    if (body.email) {
      const email = String(body.email).trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!ok) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existing = await require('../auth/auth.repository').findUserByEmail(email);
      if (existing && String(existing.id) !== String(id)) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    await repo.updateUser(id, {
      employeeCode: body.employeeCode,
      username: body.username,
      email: body.email,
      role: body.role,
      departmentId: body.departmentId,
      employmentType: body.employmentType,
      hireDate: body.hireDate,
      lang: body.lang,
      region: body.region,
      timezone: body.timezone,
      address: body.address,
      contractType: body.contractType,
      visaNumber: body.visaNumber,
      visaExpiry: body.visaExpiry,
      insuranceNumber: body.insuranceNumber,
      employmentStatus: body.employmentStatus
    });
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.remove = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await repo.deleteUser(id);
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.setRole = async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body || {};
    if (!id || !role) return res.status(400).json({ message: 'Missing id/role' });
    await repo.setRole(id, role);
    await refreshRepo.deleteUserTokens(id);
    res.status(200).json({ id, role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.setDepartment = async (req, res) => {
  try {
    const id = req.params.id;
    const { departmentId } = req.body || {};
    if (!id || !departmentId) return res.status(400).json({ message: 'Missing id/departmentId' });
    await repo.setDepartment(id, departmentId);
    res.status(200).json({ id, departmentId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.setPassword = async (req, res) => {
  try {
    const id = req.params.id;
    const { password } = req.body || {};
    if (!id || !password) return res.status(400).json({ message: 'Missing id/password' });
    const isHash = typeof password === 'string' && /^\$2[aby]\$\d+\$/.test(password);
    const hashed = isHash ? password : bcrypt.hashSync(password, bcryptRounds);
    await repo.setPassword(id, hashed);
    await refreshRepo.deleteUserTokens(id);
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.meSelf = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) return res.status(401).json({ message: 'Unauthorized' });
    const row = await repo.getUserById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) return res.status(401).json({ message: 'Unauthorized' });
    const body = req.body || {};
    if (body.email) {
      const email = String(body.email).trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!ok) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      const existing = await require('../auth/auth.repository').findUserByEmail(email);
      if (existing && String(existing.id) !== String(id)) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }
    await repo.updateUser(id, {
      username: body.username,
      email: body.email,
      employmentType: body.employmentType,
      lang: body.lang,
      region: body.region,
      timezone: body.timezone
    });
    res.status(200).json({ id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
