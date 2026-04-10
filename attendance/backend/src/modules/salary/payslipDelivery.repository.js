const db = require('../../core/database/mysql');

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS payslip_deliveries (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      month CHAR(7) NOT NULL,
      payslip_file_id BIGINT UNSIGNED NOT NULL,
      sent_by BIGINT UNSIGNED NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_month (userId, month),
      INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await db.query(sql);
  try {
    const [fk1] = await db.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslip_deliveries' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    if (!fk1 || !fk1.length) {
      try { await db.query(`ALTER TABLE payslip_deliveries ADD CONSTRAINT fk_payslip_del_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
    }
  } catch {}
  try {
    const [fk2] = await db.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslip_deliveries' AND COLUMN_NAME = 'sent_by' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    if (!fk2 || !fk2.length) {
      try { await db.query(`ALTER TABLE payslip_deliveries ADD CONSTRAINT fk_payslip_del_sender FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL`); } catch {}
    }
  } catch {}
  try {
    const [fk3] = await db.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslip_deliveries' AND COLUMN_NAME = 'payslip_file_id' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    if (!fk3 || !fk3.length) {
      try { await db.query(`ALTER TABLE payslip_deliveries ADD CONSTRAINT fk_payslip_del_file FOREIGN KEY (payslip_file_id) REFERENCES payslip_files(id) ON DELETE CASCADE`); } catch {}
    }
  } catch {}
}

async function create({ userId, month, payslipFileId, sentBy }) {
  const sql = `
    INSERT INTO payslip_deliveries (userId, month, payslip_file_id, sent_by)
    VALUES (?, ?, ?, ?)
  `;
  const [res] = await db.query(sql, [userId, month, payslipFileId, sentBy || null]);
  return res.insertId;
}

async function list({ userId = null, month = null, limit = 200 } = {}) {
  const sql = `
    SELECT d.id, d.userId, d.month, d.payslip_file_id, d.sent_by, d.sent_at,
      u.username AS user_name, u.email AS user_email,
      s.username AS sender_name, s.email AS sender_email,
      f.original_name, f.created_at AS file_created_at
    FROM payslip_deliveries d
    JOIN users u ON u.id = d.userId
    LEFT JOIN users s ON s.id = d.sent_by
    JOIN payslip_files f ON f.id = d.payslip_file_id
    WHERE (? IS NULL OR d.userId = ?)
      AND (? IS NULL OR d.month = ?)
    ORDER BY d.sent_at DESC
    LIMIT ?
  `;
  const [rows] = await db.query(sql, [userId, userId, month, month, Math.max(1, Math.min(1000, Number(limit) || 200))]);
  return rows || [];
}

async function getById(id) {
  const sql = `
    SELECT d.id, d.userId, d.month, d.payslip_file_id, d.sent_by, d.sent_at
    FROM payslip_deliveries d
    WHERE d.id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [id]);
  return rows[0] || null;
}

async function deleteById(id) {
  const before = await getById(id);
  if (!before) return null;
  await db.query(`DELETE FROM payslip_deliveries WHERE id = ?`, [id]);
  return before;
}

module.exports = { create, list, ensureTable, getById, deleteById };
