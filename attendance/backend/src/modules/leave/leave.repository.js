const db = require('../../core/database/mysql');

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      startDate DATE NOT NULL,
      endDate DATE NOT NULL,
      type VARCHAR(32) NOT NULL,
      reason VARCHAR(255) NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (userId),
      INDEX idx_status (status),
      INDEX idx_type (type),
      INDEX idx_period (startDate, endDate),
      CONSTRAINT fk_leave_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    const [idx] = await db.query(`
      SELECT index_name
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'leave_requests'
    `);
    const idxSet = new Set((idx || []).map(i => String(i.index_name)));
    if (!idxSet.has('idx_user_status')) {
      try { await db.query(`ALTER TABLE leave_requests ADD INDEX idx_user_status (userId, status)`); } catch {}
    }
    if (!idxSet.has('idx_status_period')) {
      try { await db.query(`ALTER TABLE leave_requests ADD INDEX idx_status_period (status, startDate, endDate)`); } catch {}
    }
  } catch {}
  try {
    const [tbls] = await db.query(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN ('paid_leave_grants','leave_grants')
    `);
    const set = new Set((tbls || []).map(t => String(t.name)));
    const grantsTable = set.has('paid_leave_grants') ? 'paid_leave_grants' : 'leave_grants';
    if (!set.has('paid_leave_grants') && !set.has('leave_grants')) {
      await db.query(`
        CREATE TABLE paid_leave_grants (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          userId BIGINT UNSIGNED NOT NULL,
          type VARCHAR(32) NOT NULL DEFAULT 'paid',
          grantDate DATE NOT NULL,
          daysGranted INT NOT NULL,
          expiryDate DATE NOT NULL,
          daysUsed INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_grant (userId, type, grantDate),
          INDEX idx_user_expiry (userId, expiryDate),
          CONSTRAINT fk_leave_grant_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } else {
      const [cols] = await db.query(`
        SELECT COLUMN_NAME AS name, COLUMN_TYPE AS ctype
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
      `, [grantsTable]);
      const colSet = new Set((cols || []).map(c => String(c.name)));
      if (!colSet.has('userId')) {
        await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN userId BIGINT UNSIGNED NOT NULL`);
      } else {
        const userCol = (cols || []).find(c => String(c.name) === 'userId');
        if (userCol && !/bigint\(\d+\)\s+unsigned/i.test(String(userCol.ctype))) {
          try {
            const [fks] = await db.query(`
              SELECT CONSTRAINT_NAME 
              FROM information_schema.KEY_COLUMN_USAGE
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
            `, [grantsTable]);
            for (const fk of (fks || [])) {
              try { await db.query(`ALTER TABLE ${grantsTable} DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`); } catch {}
            }
          } catch {}
          await db.query(`ALTER TABLE ${grantsTable} MODIFY COLUMN userId BIGINT UNSIGNED NOT NULL`);
        }
      }
      if (!colSet.has('type')) await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN type VARCHAR(32) NOT NULL DEFAULT 'paid'`);
      if (!colSet.has('grantDate')) await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN grantDate DATE NOT NULL`);
      if (!colSet.has('daysGranted')) await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN daysGranted INT NOT NULL`);
      if (!colSet.has('expiryDate')) await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN expiryDate DATE NOT NULL`);
      if (!colSet.has('daysUsed')) await db.query(`ALTER TABLE ${grantsTable} ADD COLUMN daysUsed INT NOT NULL DEFAULT 0`);
      const [idx] = await db.query(`
        SELECT index_name 
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = ?
      `, [grantsTable]);
      const idxSet = new Set((idx || []).map(i => String(i.index_name)));
      if (!idxSet.has('uniq_user_grant')) {
        try { await db.query(`ALTER TABLE ${grantsTable} ADD UNIQUE KEY uniq_user_grant (userId, type, grantDate)`); } catch {}
      }
      if (!idxSet.has('idx_user_expiry')) {
        try { await db.query(`ALTER TABLE ${grantsTable} ADD INDEX idx_user_expiry (userId, expiryDate)`); } catch {}
      }
      const [fk] = await db.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [grantsTable]);
      if (!fk || !fk.length) {
        try { await db.query(`ALTER TABLE ${grantsTable} ADD CONSTRAINT fk_leave_grant_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
      }
    }
  } catch {}
}

module.exports = {
  async create({ userId, startDate, endDate, type, reason }) {
    await ensureSchema();
    const sql = `
      INSERT INTO leave_requests (userId, startDate, endDate, type, reason)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [res] = await db.query(sql, [userId, startDate, endDate, type, reason || null]);
    return res.insertId;
  },
  async listMine(userId) {
    await ensureSchema();
    const sql = `
      SELECT * FROM leave_requests
      WHERE userId = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
  },
  async listByUser(userId) {
    await ensureSchema();
    const sql = `
      SELECT * FROM leave_requests
      WHERE userId = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
  },
  async listAllPending() {
    await ensureSchema();
    const sql = `
      SELECT * FROM leave_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
  },
  async updateStatus(id, status) {
    await ensureSchema();
    const sql = `
      UPDATE leave_requests
      SET status = ?
      WHERE id = ?
    `;
    await db.query(sql, [status, id]);
  },
  async upsertGrant({ userId, type = 'paid', grantDate, daysGranted, expiryDate }) {
    await ensureSchema();
    const [[row]] = await db.query(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN ('paid_leave_grants','leave_grants')
      ORDER BY CASE table_name WHEN 'paid_leave_grants' THEN 0 ELSE 1 END
      LIMIT 1
    `);
    const table = row ? String(row.name) : 'paid_leave_grants';
    const sql = `
      INSERT INTO ${table} (userId, type, grantDate, daysGranted, expiryDate)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE daysGranted = VALUES(daysGranted), expiryDate = VALUES(expiryDate)
    `;
    await db.query(sql, [userId, type, grantDate, daysGranted, expiryDate]);
  },
  async listGrants(userId, type = 'paid') {
    await ensureSchema();
    const [[row]] = await db.query(`
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name IN ('paid_leave_grants','leave_grants')
      ORDER BY CASE table_name WHEN 'paid_leave_grants' THEN 0 ELSE 1 END
      LIMIT 1
    `);
    const table = row ? String(row.name) : 'paid_leave_grants';
    const [rows] = await db.query(`
      SELECT * FROM ${table}
      WHERE userId = ? AND type = ?
      ORDER BY grantDate ASC
    `, [userId, type]);
    return rows;
  },
  async listApprovedPaidLeaves(userId, fromDate, toDate) {
    await ensureSchema();
    const [rows] = await db.query(`
      SELECT id, userId, startDate, endDate, type, status
      FROM leave_requests
      WHERE userId = ? 
        AND type = 'paid' 
        AND status = 'approved'
        AND endDate >= ? AND startDate <= ?
      ORDER BY startDate ASC
    `, [userId, fromDate, toDate]);
    return rows;
  }
};
