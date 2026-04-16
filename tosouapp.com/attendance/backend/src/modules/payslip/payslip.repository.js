const db = require('../../core/database/mysql');
// cái này là để tạo bảng payslip files nếu chưa có 
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS payslip_files (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      month CHAR(7) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      uploaded_by BIGINT UNSIGNED NOT NULL,
      iv VARBINARY(16) NULL,
      auth_tag VARBINARY(16) NULL,
      key_version VARCHAR(32) NULL,
      hash VARCHAR(64) NULL,
      version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_month (userId, month),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await db.query(sql);
  try {
    const [cols] = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'payslip_files'
    `);
    const set = new Set((cols || []).map(c => String(c.column_name)));
    if (!set.has('iv')) {
      await db.query(`ALTER TABLE payslip_files ADD COLUMN iv VARBINARY(16) NULL`);
    }
    if (!set.has('auth_tag')) {
      await db.query(`ALTER TABLE payslip_files ADD COLUMN auth_tag VARBINARY(16) NULL`);
    }
    if (!set.has('key_version')) {
      await db.query(`ALTER TABLE payslip_files ADD COLUMN key_version VARCHAR(32) NULL`);
    }
    if (!set.has('hash')) {
      await db.query(`ALTER TABLE payslip_files ADD COLUMN hash VARCHAR(64) NULL`);
    }
    if (!set.has('version')) {
      try {
        await db.query(`ALTER TABLE payslip_files ADD COLUMN version INT NOT NULL DEFAULT 1`);
      } catch {}
    }
    const [idx] = await db.query(`
      SELECT index_name, non_unique
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'payslip_files'
    `);
    const idxSet = new Set((idx || []).map(i => String(i.index_name)));
    if (!idxSet.has('uniq_user_month')) {
      try {
        await db.query(`ALTER TABLE payslip_files ADD CONSTRAINT uniq_user_month UNIQUE (userId, month)`);
      } catch {}
    }
    if (idxSet.has('idx_user_month')) {
      try {
        await db.query(`ALTER TABLE payslip_files DROP INDEX idx_user_month`);
      } catch {}
    }
    try {
      const [fk1] = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslip_files' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      if (!fk1 || !fk1.length) {
        try { await db.query(`ALTER TABLE payslip_files ADD CONSTRAINT fk_payslip_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
      }
      const [fk2] = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payslip_files' AND COLUMN_NAME = 'uploaded_by' AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      if (!fk2 || !fk2.length) {
        try { await db.query(`ALTER TABLE payslip_files ADD CONSTRAINT fk_payslip_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL`); } catch {}
      }
    } catch {}
  } catch {}
}

async function create({ userId, month, filename, originalName, uploadedBy, iv, authTag, keyVersion, hash, version = 1 }) {
  const sql = `
    INSERT INTO payslip_files (userId, month, filename, original_name, uploaded_by, iv, auth_tag, key_version, hash, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const [res] = await db.query(sql, [userId, month, filename, originalName, uploadedBy, iv || null, authTag || null, keyVersion || null, hash || null, version || 1]);
  return res.insertId;
}

async function listByUserMonth(userId, month) {
  const sql = `
    SELECT id, userId, month, filename, original_name, uploaded_by, created_at
    FROM payslip_files
    WHERE userId = ? AND ( ? IS NULL OR month = ? )
    ORDER BY created_at DESC
  `;
  const [rows] = await db.query(sql, [userId, month || null, month || null]);
  return rows;
}

async function getById(id) {
  const sql = `SELECT * FROM payslip_files WHERE id = ? LIMIT 1`;
  const [rows] = await db.query(sql, [id]);
  return rows[0];
}

async function deleteById(id) {
  const before = await getById(id);
  if (!before) return null;
  const sql = `DELETE FROM payslip_files WHERE id = ?`;
  await db.query(sql, [id]);
  return before;
}

async function updateFile(id, filename, originalName, uploadedBy, iv, authTag, keyVersion, hash, version = null) {
  const sql = `
    UPDATE payslip_files
    SET filename = ?, original_name = ?, uploaded_by = ?, iv = ?, auth_tag = ?, key_version = ?, hash = ?, version = COALESCE(?, version)
    WHERE id = ?
  `;
  await db.query(sql, [filename, originalName, uploadedBy, iv || null, authTag || null, keyVersion || null, hash || null, version, id]);
  return getById(id);
}

async function listByUserBetween(userId, fromMonth, toMonth) {
  let sql = `
    SELECT id, userId, month, filename, original_name, uploaded_by, created_at
    FROM payslip_files
    WHERE userId = ?
  `;
  const params = [userId];
  if (fromMonth && toMonth) {
    sql += ` AND month >= ? AND month <= ?`;
    params.push(fromMonth, toMonth);
  } else if (fromMonth) {
    sql += ` AND month >= ?`;
    params.push(fromMonth);
  } else if (toMonth) {
    sql += ` AND month <= ?`;
    params.push(toMonth);
  }
  sql += ` ORDER BY month DESC, created_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows;
}

async function findLatestByUserMonth(userId, month) {
  const sql = `
    SELECT id, userId, month, filename, original_name, uploaded_by, created_at
    FROM payslip_files
    WHERE userId = ? AND month = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [userId, month]);
  return rows[0];
}

module.exports = { ensureTable, create, listByUserMonth, getById, deleteById, updateFile, listByUserBetween, findLatestByUserMonth };
