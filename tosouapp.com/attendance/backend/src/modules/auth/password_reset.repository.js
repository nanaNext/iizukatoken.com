const db = require('../../core/database/mysql');
const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      user_agent VARCHAR(255),
      ip VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (userId),
      INDEX idx_expires (expires_at),
      INDEX idx_used (used_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await db.query(sql);
  try {
    const [fk] = await db.query(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'password_reset_tokens' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    if (!fk || !fk.length) {
      try { await db.query(`ALTER TABLE password_reset_tokens ADD CONSTRAINT fk_password_reset_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
    }
  } catch {}
}

module.exports = {
  ensureTable,
  async createReset({ userId, token, expiresAt, userAgent, ip }) {
    const tokenHash = hashToken(token);
    const sql = `
      INSERT INTO password_reset_tokens (userId, token_hash, expires_at, user_agent, ip)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE userId = VALUES(userId), expires_at = VALUES(expires_at), user_agent = VALUES(user_agent), ip = VALUES(ip), used_at = NULL
    `;
    await db.query(sql, [userId, tokenHash, expiresAt, userAgent || null, ip || null]);
    return { ok: true };
  },
  async revokeUnsedForUser(userId) {
    const sql = `DELETE FROM password_reset_tokens WHERE userId = ? AND used_at IS NULL`;
    await db.query(sql, [userId]);
  },
  async findValid(token) {
    const tokenHash = hashToken(token);
    const sql = `
      SELECT id, userId, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ?
      LIMIT 1
    `;
    const [rows] = await db.query(sql, [tokenHash]);
    return rows[0];
  },
  async consume(token) {
    const tokenHash = hashToken(token);
    const sql = `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE token_hash = ? AND used_at IS NULL
    `;
    const [res] = await db.query(sql, [tokenHash]);
    return res?.affectedRows > 0;
  },
  async cleanupExpired() {
    const sql = `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL`;
    const [result] = await db.query(sql);
    return { deleted: result?.affectedRows || 0 };
  }
};
