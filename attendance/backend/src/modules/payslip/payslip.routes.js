const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const uploadPdf = require('../../core/middleware/uploadPdf');
const repo = require('./payslip.repository');
const userRepo = require('../users/user.repository');
const auditRepo = require('../audit/audit.repository');
const fs = require('fs');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const { payslipEncKey, payslipKeyVersion } = require('../../config/env');
const settingsService = require('../settings/settings.service');
const crypto = require('crypto');

function rfc5987Encode(str) {
  return encodeURIComponent(String(str || ''))
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
}

function setAttachmentFilename(res, filename) {
  const name = String(filename || 'payslip.pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip.pdf"; filename*=UTF-8''${rfc5987Encode(name)}`);
}

router.post('/admin/upload',
  rateLimitNamed('payslip_admin_upload', { windowMs: 60_000, max: 5 }),
  authenticate,
  authorize('admin','manager'),
  uploadPdf.single('file'),
  async (req, res) => {
  try {
    const t0 = Date.now();
    const flags = await settingsService.getFlags();
    const maintenanceMode = !!flags.maintenanceMode;
    const disablePayslipUpload = !!flags.disablePayslipUpload;
    if (maintenanceMode || disablePayslipUpload) {
      try { require('../../core/metrics').inc('maintenance_mode_hits', 1); } catch {}
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const { userId, month } = req.body;
    if (!userId || !month || !req.file) {
      return res.status(400).json({ message: 'Missing userId/month/file' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department upload' });
      }
    }
    let filename = req.file.filename;
    let iv = null, tag = null, hash = null, keyVersion = null;
    if (payslipEncKey) {
      const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
      const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
      const srcPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      const src = fs.readFileSync(srcPath);
      iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(src), cipher.final()]);
      tag = cipher.getAuthTag();
      hash = crypto.createHash('sha256').update(src).digest('hex');
      filename = filename + '.enc';
      const dstPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      fs.writeFileSync(dstPath, enc);
      try { fs.unlinkSync(srcPath); } catch {}
      keyVersion = payslipKeyVersion;
    }
    let createdId = null;
    try {
      createdId = await repo.create({
        userId: parseInt(userId, 10),
        month,
        filename,
        originalName: req.file.originalname,
        uploadedBy: req.user.id,
        iv,
        authTag: tag,
        keyVersion,
        hash
      });
    } catch (e) {
      if (String(filename || '').endsWith('.enc')) {
        try {
          const dstPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
          fs.existsSync(dstPath) && fs.unlinkSync(dstPath);
        } catch {}
      }
      throw e;
    }
    const url = `/uploads/payslips/${filename}`;
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_upload', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: null, afterData: JSON.stringify({ id: createdId, userId: parseInt(userId, 10), month, filename }) });
    } catch {}
    res.status(201).json({ id: createdId, userId: parseInt(userId, 10), month, url, originalName: req.file.originalname });
    try { require('../../core/metrics').observe('payslip_upload_latency_ms', Date.now() - t0); } catch {}
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG: Danh sách payslip cho admin/manager
// - Thêm secureUrl để tải qua endpoint có xác thực
// - 400 "Missing userId": thiếu query userId
// - 403 "Forbidden: cross-department access": manager khác phòng ban
router.get('/admin/list', authenticate, authorize('admin','manager'), async (req, res) => {
  try {
    const { userId, month, fromMonth, toMonth, page = 1, pageSize = 20, q, uploadedBy } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'Missing userId' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    }
    let rows = month
      ? await repo.listByUserMonth(parseInt(userId, 10), month || null)
      : await repo.listByUserBetween(parseInt(userId, 10), fromMonth || null, toMonth || null);
    const base = '/uploads/payslips/';
    // filter by q and uploadedBy
    if (uploadedBy) {
      rows = rows.filter(r => String(r.uploaded_by) === String(uploadedBy));
    }
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(r => String(r.original_name || '').toLowerCase().includes(s));
    }
    const total = rows.length;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 20);
    const start = (p - 1) * ps;
    const slice = rows.slice(start, start + ps);
    const data = slice.map(r => ({
      id: r.id,
      userId: r.userId,
      month: r.month,
      url: base + r.filename,
      secureUrl: `/api/payslips/admin/file/${r.id}`,
      originalName: r.original_name,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.created_at
    }));
    res.status(200).json({ data, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG: Danh sách payslip của chính user
// - Trả về secureUrl /api/payslips/me/file/:id
router.get('/me/list', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const maintenanceMode = !!(await settingsService.getFlags()).maintenanceMode;
    if (maintenanceMode) {
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const { month, fromMonth, toMonth, page = 1, pageSize = 20, q } = req.query;
    let rows = month
      ? await repo.listByUserMonth(req.user.id, month || null)
      : await repo.listByUserBetween(req.user.id, fromMonth || null, toMonth || null);
    const base = '/uploads/payslips/';
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter(r => String(r.original_name || '').toLowerCase().includes(s));
    }
    const total = rows.length;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 20);
    const start = (p - 1) * ps;
    const slice = rows.slice(start, start + ps);
    const data = slice.map(r => ({
      id: r.id,
      userId: r.userId,
      month: r.month,
      url: base + r.filename,
      secureUrl: `/api/payslips/me/file/${r.id}`,
      originalName: r.original_name,
      uploadedBy: r.uploaded_by,
      uploadedAt: r.created_at
    }));
    res.status(200).json({ data, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/my/:id', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await repo.getById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    } else if (String(row.userId) !== String(req.user.id) && req.user.role !== 'admin') {
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
router.get('/my/:id/download', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await repo.getById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    } else if (String(row.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: not your payslip' });
    }
    res.status(200).json({ secureUrl: `/api/payslips/me/file/${row.id}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/admin/:id',
  rateLimitNamed('payslip_admin_delete', { windowMs: 60_000, max: 10 }),
  authenticate,
  authorize('admin','manager'),
  async (req, res) => {
  try {
    const maintenanceMode = !!(await settingsService.getFlags()).maintenanceMode;
    if (maintenanceMode) {
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const id = parseInt(req.params.id, 10);
    const row = await repo.getById(id);
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (!req.body?.reason) {
      return res.status(400).json({ message: 'Missing reason' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const target = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(target?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department delete' });
      }
    }
    const deleted = await repo.deleteById(id);
    try {
      const p = path.join(__dirname, '../../', 'uploads', 'payslips', deleted.filename);
      fs.existsSync(p) && fs.unlinkSync(p);
    } catch {}
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_delete', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id, filename: deleted.filename }), afterData: JSON.stringify({ reason: req.body?.reason }) });
    } catch {}
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/admin/replace/:id',
  rateLimitNamed('payslip_admin_replace', { windowMs: 60_000, max: 5 }),
  authenticate,
  authorize('admin','manager'),
  uploadPdf.single('file'),
  async (req, res) => {
  try {
    const flags = await settingsService.getFlags();
    const maintenanceMode = !!flags.maintenanceMode;
    const disablePayslipUpload = !!flags.disablePayslipUpload;
    if (maintenanceMode || disablePayslipUpload) {
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const id = parseInt(req.params.id, 10);
    const { userId, month, reason } = req.body || {};
    if (!req.file) {
      return res.status(400).json({ message: 'Missing file' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Missing reason' });
    }
    const row = await repo.getById(id);
    let target = row;
    if (!target && userId && month) {
      target = await repo.findLatestByUserMonth(parseInt(userId, 10), String(month));
    }
    if (!target) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(target.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department replace' });
      }
    }
    const oldPath = path.join(__dirname, '../../', 'uploads', 'payslips', target.filename);
    let filename = req.file.filename;
    let iv = null, tag = null, hash = null, keyVersion = null;
    if (payslipEncKey) {
      const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
      const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
      const srcPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      const src = fs.readFileSync(srcPath);
      iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(src), cipher.final()]);
      tag = cipher.getAuthTag();
      hash = crypto.createHash('sha256').update(src).digest('hex');
      filename = filename + '.enc';
      const dstPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      fs.writeFileSync(dstPath, enc);
      try { fs.unlinkSync(srcPath); } catch {}
      keyVersion = payslipKeyVersion;
    }
    const updated = await repo.updateFile(target.id, filename, req.file.originalname, req.user.id, iv, tag, keyVersion, hash);
    try { fs.existsSync(oldPath) && fs.unlinkSync(oldPath); } catch {}
    const url = `/uploads/payslips/${updated.filename}`;
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_replace', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: target.id, filename: target.filename }), afterData: JSON.stringify({ filename: updated.filename, reason }) });
    } catch {}
    res.status(200).json({ id: updated.id, userId: updated.userId, month: updated.month, url, originalName: updated.original_name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/admin/replace-by-month',
  rateLimitNamed('payslip_admin_replace_by_month', { windowMs: 60_000, max: 5 }),
  authenticate,
  authorize('admin','manager'),
  uploadPdf.single('file'),
  async (req, res) => {
  try {
    const flags2 = await settingsService.getFlags();
    const maintenanceMode2 = !!flags2.maintenanceMode;
    const disablePayslipUpload2 = !!flags2.disablePayslipUpload;
    if (maintenanceMode2 || disablePayslipUpload2) {
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const { userId, month, reason } = req.body || {};
    if (!userId || !month || !req.file) {
      return res.status(400).json({ message: 'Missing userId/month/file' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Missing reason' });
    }
    const target = await repo.findLatestByUserMonth(parseInt(userId, 10), String(month));
    if (!target) {
      return res.status(404).json({ message: 'Not found for user/month' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(target.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department replace' });
      }
    }
    const oldPath2 = path.join(__dirname, '../../', 'uploads', 'payslips', target.filename);
    let filename = req.file.filename;
    let iv = null, tag = null, hash = null, keyVersion = null;
    if (payslipEncKey) {
      const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
      const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
      const srcPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      const src = fs.readFileSync(srcPath);
      iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(src), cipher.final()]);
      tag = cipher.getAuthTag();
      hash = crypto.createHash('sha256').update(src).digest('hex');
      filename = filename + '.enc';
      const dstPath = path.join(__dirname, '../../', 'uploads', 'payslips', filename);
      fs.writeFileSync(dstPath, enc);
      try { fs.unlinkSync(srcPath); } catch {}
      keyVersion = payslipKeyVersion;
    }
    const updated = await repo.updateFile(target.id, filename, req.file.originalname, req.user.id, iv, tag, keyVersion, hash);
    try { fs.existsSync(oldPath2) && fs.unlinkSync(oldPath2); } catch {}
    const url = `/uploads/payslips/${updated.filename}`;
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_replace', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: target.id, filename: target.filename }), afterData: JSON.stringify({ filename: updated.filename, reason }) });
    } catch {}
    res.status(200).json({ id: updated.id, userId: updated.userId, month: updated.month, url, originalName: updated.original_name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG: Tải payslip của chính user
// - 404 "Not found": không có bản ghi payslip_files theo id
// - 403 "Forbidden: not your payslip": id không thuộc user hiện tại
// - 404 "File missing": bản ghi có nhưng file vật lý thiếu
// - Luôn gửi Authorization: Bearer {accessToken}
router.get('/me/file/:id',
  rateLimitNamed('payslip_me_file', { windowMs: 60_000, max: 10 }),
  authenticate,
  authorize('employee','manager','admin'),
  async (req, res) => {
  try {
    const flags3 = await settingsService.getFlags();
    const maintenanceMode3 = !!flags3.maintenanceMode;
    const disablePayslipDownload3 = !!flags3.disablePayslipDownload;
    if (maintenanceMode3 || disablePayslipDownload3) {
      try { require('../../core/metrics').inc('maintenance_mode_hits', 1); } catch {}
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const id = parseInt(req.params.id, 10);
    const row = await repo.getById(id);
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (String(row.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Forbidden: not your payslip' });
    }
    const filePath = path.join(__dirname, '../../', 'uploads', 'payslips', row.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File missing' });
    }
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_download', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: row.id, userId: row.userId }), afterData: null });
    } catch {}
    res.setHeader('Content-Type', 'application/pdf');
    setAttachmentFilename(res, row.original_name || row.filename);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    if (row.iv && row.auth_tag && payslipEncKey && String(row.filename || '').endsWith('.enc')) {
      const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
      const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
      const enc = fs.readFileSync(filePath);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.iv));
      decipher.setAuthTag(Buffer.from(row.auth_tag));
      const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
      const h = crypto.createHash('sha256').update(plain).digest('hex');
      if (row.hash && h !== row.hash) {
        return res.status(500).json({ message: 'Integrity check failed' });
      }
      return res.status(200).send(plain);
    } else {
      return res.sendFile(filePath);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DEBUG: Tải payslip cho admin/manager
// - 404 "Not found": id không tồn tại trong payslip_files
// - 403 "Forbidden: cross-department access": manager khác phòng ban với user của payslip
// - 404 "File missing": bản ghi có nhưng file vật lý thiếu
router.get('/admin/file/:id',
  rateLimitNamed('payslip_admin_file', { windowMs: 60_000, max: 20 }),
  authenticate,
  authorize('admin','manager'),
  async (req, res) => {
  try {
    const flags4 = await settingsService.getFlags();
    const maintenanceMode4 = !!flags4.maintenanceMode;
    const disablePayslipDownload4 = !!flags4.disablePayslipDownload;
    if (maintenanceMode4 || disablePayslipDownload4) {
      try { require('../../core/metrics').inc('maintenance_mode_hits', 1); } catch {}
      return res.status(503).json({ message: 'Service temporarily disabled' });
    }
    const id = parseInt(req.params.id, 10);
    const row = await repo.getById(id);
    if (!row) {
      return res.status(404).json({ message: 'Not found' });
    }
    if (req.user.role === 'manager') {
      const me = await userRepo.getUserById(req.user.id);
      const targetUser = await userRepo.getUserById(row.userId);
      if (!me?.departmentId || String(me.departmentId) !== String(targetUser?.departmentId)) {
        return res.status(403).json({ message: 'Forbidden: cross-department access' });
      }
    }
    const filePath = path.join(__dirname, '../../', 'uploads', 'payslips', row.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File missing' });
    }
    try {
      await auditRepo.writeLog({ userId: req.user.id, action: 'payslip_download', path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'], beforeData: JSON.stringify({ id: row.id, userId: row.userId }), afterData: null });
    } catch {}
    res.setHeader('Content-Type', 'application/pdf');
    setAttachmentFilename(res, row.original_name || row.filename);
    if (row.iv && row.auth_tag && payslipEncKey && String(row.filename || '').endsWith('.enc')) {
      const keyBuf = Buffer.from(payslipEncKey, payslipEncKey.startsWith('base64:') ? 'base64' : 'hex');
      const key = payslipEncKey.startsWith('base64:') ? keyBuf.slice(7) : keyBuf;
      const enc = fs.readFileSync(filePath);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(row.iv));
      decipher.setAuthTag(Buffer.from(row.auth_tag));
      const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
      const h = crypto.createHash('sha256').update(plain).digest('hex');
      if (row.hash && h !== row.hash) {
        return res.status(500).json({ message: 'Integrity check failed' });
      }
      return res.status(200).send(plain);
    } else {
      return res.sendFile(filePath);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
