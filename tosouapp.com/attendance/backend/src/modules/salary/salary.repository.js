const db = require('../../core/database/mysql');

async function getConfigByYear(year) {
  try {
    const sql = `SELECT * FROM salary_config WHERE year = ? LIMIT 1`;
    const [rows] = await db.query(sql, [year]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function getUserCompensation(userId) {
  try {
    const sql = `SELECT base_salary, allowance_transport FROM users WHERE id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [userId]);
    return rows[0] || null;
  } catch {
    return null;
  }
}

async function ensureHistoryTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS salary_history (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      month CHAR(7) NOT NULL,
      payload JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_month (userId, month),
      INDEX idx_user (userId),
      INDEX idx_month (month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await db.query(sql);
}

async function saveHistory(userId, month, payload) {
  await ensureHistoryTable();
  const sql = `
    INSERT INTO salary_history (userId, month, payload)
    VALUES (?, ?, CAST(? AS JSON))
    ON DUPLICATE KEY UPDATE payload = VALUES(payload)
  `;
  await db.query(sql, [userId, month, JSON.stringify(payload)]);
}

async function listHistory({ userId, month, page = 1, pageSize = 20 }) {
  await ensureHistoryTable();
  const where = [];
  const params = [];
  if (userId) { where.push('userId = ?'); params.push(userId); }
  if (month) { where.push('month = ?'); params.push(month); }
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, parseInt(pageSize, 10) || 20);
  const offset = (p - 1) * ps;
  const sql = `
    SELECT id, userId, month, JSON_EXTRACT(payload, '$') AS payload, created_at
    FROM salary_history
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await db.query(sql, [...params, ps, offset]);
  const [[{ total } = { total: 0 }]] = await db.query(`
    SELECT COUNT(*) AS total FROM salary_history ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
  `, params);
  return { data: rows, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) };
}

module.exports = { getConfigByYear, getUserCompensation, saveHistory, listHistory }; 
