const db = require('../../core/database/mysql');

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      credential_id VARCHAR(255) NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT UNSIGNED NOT NULL DEFAULT 0,
      transports VARCHAR(128) NULL,
      aaguid VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      CONSTRAINT fk_user_passkeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function listUserPasskeys(userId) {
  const [rows] = await db.query(`SELECT id, credential_id, public_key, counter, transports, aaguid FROM user_passkeys WHERE user_id = ?`, [userId]);
  return rows || [];
}

async function findByCredentialId(credentialId) {
  const [rows] = await db.query(`SELECT id, user_id, credential_id, public_key, counter, transports, aaguid FROM user_passkeys WHERE credential_id = ? LIMIT 1`, [credentialId]);
  return rows && rows[0] ? rows[0] : null;
}

async function createPasskey({ userId, credentialId, publicKey, counter, transports, aaguid }) {
  await db.query(
    `INSERT INTO user_passkeys (user_id, credential_id, public_key, counter, transports, aaguid) VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, credentialId, publicKey, counter || 0, transports || null, aaguid || null]
  );
}

async function updateCounter(credentialId, counter) {
  await db.query(`UPDATE user_passkeys SET counter = ? WHERE credential_id = ?`, [counter, credentialId]);
}

module.exports = {
  ensureTable,
  listUserPasskeys,
  findByCredentialId,
  createPasskey,
  updateCounter
};
