const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { rateLimit, rateLimitNamed } = require('../../core/middleware/rateLimit');
const controller = require('./manager.controller');
const db = require('../../core/database/mysql');
const upload = require('../../core/middleware/upload');
const userRepo = require('../users/user.repository');
const uploadEmployeePhotos = (req, res, next) => {
  upload.array('files', 12)(req, res, (err) => {
    if (!err) return next();
    const msg = String(err?.message || 'Upload failed');
    const code = /file too large/i.test(msg) ? 413 : 400;
    return res.status(code).json({ message: msg });
  });
};
router.get('/report', authenticate, authorize('manager','admin'), controller.groupReport);
router.post('/shifts',
  rateLimitNamed('manager_shifts', { windowMs: 60_000, max: 20 }),
  authenticate, authorize('manager','admin'), controller.assignShift);
router.get('/users', authenticate, authorize('manager','admin'), controller.listMyDepartment);
router.patch('/users/:id',
  rateLimitNamed('manager_users_update', { windowMs: 60_000, max: 30 }),
  authenticate, authorize('manager','admin'), controller.updateEmployeeInfo);
router.get('/departments', authenticate, authorize('manager','admin'), controller.listDepartments);
router.get('/salary/preview', authenticate, authorize('manager','admin'), controller.salaryPreviewDepartment);
router.post('/users/:id/resign',
  rateLimitNamed('manager_users_resign', { windowMs: 60_000, max: 5 }),
  authenticate, authorize('manager','admin'), controller.resignEmployee);
router.get('/profile-change/pending', authenticate, authorize('manager','admin'), controller.listProfileChangePending);
router.get('/profile-change/:id', authenticate, authorize('manager','admin'), controller.getProfileChange);
router.patch('/profile-change/:id/status',
  rateLimitNamed('manager_profile_change_status', { windowMs: 60_000, max: 10 }),
  authenticate, authorize('manager','admin'), controller.approveProfileChange);

async function ensureEmployeeProfilePhotosSchema() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS employee_profile_photos (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT UNSIGNED NOT NULL,
        url VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NULL,
        mime_type VARCHAR(100) NULL,
        size_bytes BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_created (userId, created_at),
        CONSTRAINT fk_employee_profile_photos_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch {}
}

async function ensureManagerDepartmentScope(req, targetUserId) {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin') return true;
  if (role !== 'manager') return false;
  if (String(process.env.MANAGER_STRICT_DEPT || '').toLowerCase() !== 'true') return true;
  const me = await userRepo.getUserById(req.user.id);
  const target = await userRepo.getUserById(targetUserId);
  if (!me?.departmentId || !target?.departmentId) return false;
  return String(me.departmentId) === String(target.departmentId);
}

router.get('/employees/:id/photos', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    await ensureEmployeeProfilePhotosSchema();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!(await ensureManagerDepartmentScope(req, id))) return res.status(403).json({ message: 'Forbidden' });
    const [rows] = await db.query(
      `SELECT id, userId, url, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt
       FROM employee_profile_photos
       WHERE userId = ?
       ORDER BY created_at DESC, id DESC`,
      [id]
    );
    res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/employees/:id/photos', authenticate, authorize('manager','admin'), uploadEmployeePhotos, async (req, res) => {
  try {
    await ensureEmployeeProfilePhotosSchema();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    if (!(await ensureManagerDepartmentScope(req, id))) return res.status(403).json({ message: 'Forbidden' });
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) return res.status(400).json({ message: 'No files uploaded' });
    const items = [];
    for (const f of files) {
      const url = `/uploads/${f.filename}`;
      await db.query(
        `INSERT INTO employee_profile_photos (userId, url, original_name, mime_type, size_bytes)
         VALUES (?, ?, ?, ?, ?)`,
        [id, url, String(f.originalname || ''), String(f.mimetype || ''), Number(f.size || 0)]
      );
      items.push({ url, originalName: f.originalname, mimeType: f.mimetype, sizeBytes: f.size });
    }
    res.status(201).json({ id, count: items.length, items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/employees/:id/photos/:photoId', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    await ensureEmployeeProfilePhotosSchema();
    const id = parseInt(req.params.id, 10);
    const photoId = parseInt(req.params.photoId, 10);
    if (!id || !photoId) return res.status(400).json({ message: 'Missing id/photoId' });
    if (!(await ensureManagerDepartmentScope(req, id))) return res.status(403).json({ message: 'Forbidden' });
    const [[row]] = await db.query(
      `SELECT id, userId, url FROM employee_profile_photos WHERE id = ? AND userId = ? LIMIT 1`,
      [photoId, id]
    );
    if (!row) return res.status(404).json({ message: 'Photo not found' });
    await db.query(`DELETE FROM employee_profile_photos WHERE id = ? AND userId = ?`, [photoId, id]);
    res.status(200).json({ ok: true, id, photoId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
module.exports = router;
