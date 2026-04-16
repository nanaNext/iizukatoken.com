const db = require('../../core/database/mysql');
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_documents (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(256),
      description TEXT,
      filename VARCHAR(256) NOT NULL,
      mime VARCHAR(128),
      size BIGINT,
      uploaded_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_type (type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
async function listFiltered({ userId, types, from, to, owner, page, pageSize }) {
  const where = [];
  const params = [];
  if (userId) {
    where.push('user_id = ?');
    params.push(parseInt(userId, 10));
  }
  if (Array.isArray(types) && types.length > 0) {
    where.push(`type IN (${types.map(() => '?').join(',')})`);
    params.push(...types.map(String));
  }
  if (from) {
    where.push('DATE(created_at) >= DATE(?)');
    params.push(from);
  }
  if (to) {
    where.push('DATE(created_at) <= DATE(?)');
    params.push(to);
  }
  if (owner) {
    where.push('uploaded_by = ?');
    params.push(parseInt(owner, 10));
  }
  const p = Math.max(1, parseInt(page || 1, 10));
  const ps = Math.max(1, parseInt(pageSize || 20, 10));
  const offset = (p - 1) * ps;
  const sqlBase = `
    SELECT id, user_id as userId, type, title, description, filename, mime, size, uploaded_by as uploadedBy, created_at as createdAt
    FROM employee_documents
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC, id DESC
  `;
  const [countRows] = await db.query(`SELECT COUNT(*) as c FROM (${sqlBase}) t`, params);
  const total = (countRows && countRows[0] && countRows[0].c) ? parseInt(countRows[0].c, 10) : 0;
  const [rows] = await db.query(sqlBase + ` LIMIT ? OFFSET ?`, [...params, ps, offset]);
  return { rows, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) };
}
async function getById(id) {
  const [rows] = await db.query(
    `SELECT id, user_id as userId, type, title, description, filename, mime, size, uploaded_by as uploadedBy, created_at as createdAt
     FROM employee_documents WHERE id = ? LIMIT 1`,
    [parseInt(id, 10)]
  );
  return rows && rows[0] ? rows[0] : null;
}
module.exports = { ensureTable, listFiltered, getById };
