const db = require('../../core/database/mysql');

module.exports = {
  async ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT UNSIGNED NULL,
        action VARCHAR(64) NOT NULL,
        path VARCHAR(255),
        method VARCHAR(16),
        ip VARCHAR(64),
        userAgent VARCHAR(255),
        beforeData TEXT,
        afterData TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (userId),
        INDEX idx_action (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },
  async writeLog(data) {
    await this.ensureTable();
    const sql = `
      INSERT INTO audit_logs (userId, action, path, method, ip, userAgent, beforeData, afterData)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.query(sql, [
      data.userId,
      data.action,
      data.path,
      data.method,
      data.ip,
      data.userAgent,
      data.beforeData,
      data.afterData
    ]);
  },
  async listLogs({ userId, action, from, to, page = 1, pageSize = 50 }) {
    await this.ensureTable();
    const where = [];
    const params = [];
    if (userId) { where.push('userId = ?'); params.push(userId); }
    if (action) { where.push('action = ?'); params.push(action); }
    if (from) { where.push('created_at >= ?'); params.push(from + ' 00:00:00'); }
    if (to) { where.push('created_at <= ?'); params.push(to + ' 23:59:59'); }
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.max(1, parseInt(pageSize, 10) || 50);
    const offset = (p - 1) * ps;
    const sql = `
      SELECT id, userId, action, path, method, ip, userAgent, created_at
      FROM audit_logs
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [...params, ps, offset]);
    const [[{ total } = { total: 0 }]] = await db.query(`
      SELECT COUNT(*) AS total FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    `, params);
    return { data: rows, page: p, pageSize: ps, total, pages: Math.ceil(total / ps) };
  }
};
