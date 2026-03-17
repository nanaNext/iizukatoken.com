const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const payslipRepo = require('../payslip/payslip.repository');
const userRepo = require('../users/user.repository');
const auditRepo = require('../audit/audit.repository');
const docRepo = require('../documents/documents.repository');
const path = require('path');
const fs = require('fs');
const db = require('../../core/database/mysql');
router.use(authenticate);
router.get('/documents', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || 1), 10);
    const pageSize = parseInt(String(req.query.pageSize || 20), 10);
    const types = req.query.type ? String(req.query.type).split(',').map(s => s.trim()).filter(Boolean) : [];
    const from = req.query.from || null;
    const to = req.query.to || null;
    const owner = req.query.owner || null;
    let userId = req.query.userId || null;
    if (req.user.role === 'employee') {
      userId = req.user.id;
    }
    const result = await docRepo.listFiltered({ userId, types, from, to, owner, page, pageSize });
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const cache = new Map();
      const filtered = [];
      for (const r of result.rows) {
        if (!cache.has(r.userId)) {
          cache.set(r.userId, await userRepo.getUserById(r.userId));
        }
        const target = cache.get(r.userId);
        if (me?.departmentId && String(me.departmentId) === String(target?.departmentId)) {
          filtered.push(r);
        }
      }
      const total = filtered.length;
      const p = Math.max(1, page);
      const ps = Math.max(1, pageSize);
      const start = (p - 1) * ps;
      const data = filtered.slice(start, start + ps);
      return res.status(200).json({ data: data.map(r => ({ ...r, secureUrl: `/api/employee/documents/${r.id}/download` })), page: p, pageSize: ps, total, pages: Math.ceil(total / ps) });
    }
    res.status(200).json({ data: result.rows.map(r => ({ ...r, secureUrl: `/api/employee/documents/${r.id}/download` })), page: result.page, pageSize: result.pageSize, total: result.total, pages: result.pages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/documents/:id', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await docRepo.getById(id);
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (req.user.role === 'employee' && String(row.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    res.status(200).json({ ...row, secureUrl: `/api/employee/documents/${row.id}/download` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/documents/:id/download', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await docRepo.getById(id);
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (req.user.role === 'employee' && String(row.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'employee_document_download', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: row.id, userId: row.userId }), afterData: null });
    } catch {}
    const baseDir = path.join(__dirname, '../../', 'uploads', 'documents');
    const filePath = path.join(baseDir, row.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File missing' });
    }
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.title || row.filename)}"`);
    return res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/payslips/:id', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await payslipRepo.getById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    } else if (req.user.role !== 'admin' && String(row.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: not your payslip' });
    }
    res.status(200).json({
      id: row.id,
      userId: row.userId,
      month: row.month,
      originalName: row.original_name,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.created_at,
      secureUrl: `/api/payslips/me/file/${row.id}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/payslips/:id/download', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await payslipRepo.getById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    } else if (req.user.role !== 'admin' && String(row.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: not your payslip' });
    }
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'employee_payslip_download', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: row.id, userId: row.userId }), afterData: null });
    } catch {}
    res.status(200).json({ secureUrl: `/api/payslips/me/file/${row.id}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// Nhân viên gửi yêu cầu cập nhật hồ sơ -> vào hàng đợi phê duyệt
router.post('/profile-change', authorize('employee','manager','admin'), async (req, res) => {
  try {
    const userId = req.user.id;
    const b = req.body || {};
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
    const allowedKeys = ['username','email','role','departmentId','level','managerId','employmentType','hireDate','birthDate','gender','phone','avatarUrl','probationDate','officialDate','address','employmentStatus','contractEnd','baseSalary','shiftId','joinDate'];
    const filtered = {};
    for (const k of allowedKeys) {
      if (b[k] !== undefined && b[k] !== null && String(b[k]).trim() !== '') filtered[k] = b[k];
    }
    if (!Object.keys(filtered).length) return res.status(400).json({ message: 'No changes provided' });
    const [result] = await db.query(`INSERT INTO user_change_requests (user_id, fields_json, status) VALUES (?, ?, 'pending')`, [userId, JSON.stringify(filtered)]);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
