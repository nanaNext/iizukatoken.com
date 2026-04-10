const db = require('../../core/database/mysql');
const crypto = require('crypto');

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      user_agent VARCHAR(255),
      ip VARCHAR(64),
      revoked_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (userId),
      INDEX idx_expires (expires_at),
      INDEX idx_revoked (revoked_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await db.query(sql);
  try {
    const [fk] = await db.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'refresh_tokens' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    if (!fk || !fk.length) {
      try { await db.query(`ALTER TABLE refresh_tokens ADD CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
    }
  } catch {}
  try {
    const [cols] = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'refresh_tokens'
    `);
    const set = new Set((cols || []).map(c => String(c.column_name)));
    if (!set.has('token_hash')) {
      await db.query(`ALTER TABLE refresh_tokens ADD COLUMN token_hash VARCHAR(64) NULL`);
      if (set.has('token')) {
        try { await db.query(`ALTER TABLE refresh_tokens MODIFY COLUMN token VARCHAR(255) NULL DEFAULT NULL`); } catch {}
        await db.query(`UPDATE refresh_tokens SET token_hash = LOWER(SHA2(token, 256)) WHERE token IS NOT NULL AND token_hash IS NULL`);
      }
      await db.query(`ALTER TABLE refresh_tokens MODIFY COLUMN token_hash VARCHAR(64) NOT NULL`);
      try { await db.query(`ALTER TABLE refresh_tokens ADD UNIQUE KEY uniq_token_hash (token_hash)`); } catch {}
      if (set.has('token')) {
        try { await db.query(`ALTER TABLE refresh_tokens DROP COLUMN token`); } catch {}
      }
    }
  } catch {}
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
  ensureTable,
  async createToken({ userId, token, expiresAt, userAgent, ip }) {
    const tokenHash = hashToken(token);
    const sql = `
      INSERT INTO refresh_tokens (userId, token_hash, expires_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE userId = VALUES(userId), expires_at = VALUES(expires_at), user_agent = VALUES(user_agent), ip = VALUES(ip), revoked_at = NULL
    `;
    await db.query(sql, [userId, tokenHash, expiresAt, userAgent || null, ip || null]);
    return { ok: true };
  },

  async findToken(token) {
    const tokenHash = hashToken(token);
    const sql = `
      SELECT id, userId, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = ? AND (revoked_at IS NULL)
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [tokenHash]);
    return rows[0];
  },

  async findAnyToken(token) {
    const tokenHash = hashToken(token);
    const sql = `
      SELECT id, userId, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [tokenHash]);
    return rows[0];
  },

  async revokeToken(token) {
    const tokenHash = hashToken(token);
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ?
    `;
    await db.query(sql, [tokenHash]);
  },

  async deleteUserTokens(userId) {
    const sql = `DELETE FROM refresh_tokens WHERE userId = ?`;
    await db.query(sql, [userId]);
  },
 
  async cleanupExpired() {
    const sql = `DELETE FROM refresh_tokens WHERE expires_at < NOW()`;
    const [result] = await db.query(sql);
    return { deleted: result?.affectedRows || 0 };
  },
 
   async deleteAllTokens() {
     const sql = `DELETE FROM refresh_tokens`;
     const [result] = await db.query(sql);
     return { deleted: result?.affectedRows || 0 };
   },

  async listByUser(userId, { page = 1, pageSize = 20 } = {}) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 20);
    const offset = (p - 1) * ps;
    const sql = `
      SELECT id, userId, expires_at, user_agent, ip, revoked_at, created_at
      FROM refresh_tokens
      WHERE userId = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [userId, ps, offset]);
    const [[{ total } = { total: 0 }]] = await db.query(`SELECT COUNT(*) AS total FROM refresh_tokens WHERE userId = ?`, [userId]);
    return { data: rows, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) };
  }
};
