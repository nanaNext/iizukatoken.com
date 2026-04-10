const db = require('../../core/database/mysql');

module.exports = {
  async ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS employee_requests (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        request_no VARCHAR(32) NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL DEFAULT '申請済み',
        record_type VARCHAR(64) NOT NULL,
        detail TEXT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        office VARCHAR(128) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_status (status),
        INDEX idx_type (record_type),
        CONSTRAINT fk_emp_req_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },
  async listByUser(userId, { q = '', limit = 50, offset = 0 } = {}) {
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    const query = String(q || '').trim();
    const where = ['user_id = ?'];
    const params = [userId];
    if (query) {
      where.push(`(request_no LIKE ? OR record_type LIKE ? OR status LIKE ? OR detail LIKE ? OR office LIKE ?)`);
      const like = `%${query}%`;
      params.push(like, like, like, like, like);
    }
    const wsql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const [rows] = await db.query(
      `SELECT id, request_no, status, record_type, detail, office, created_at, updated_at
       FROM employee_requests ${wsql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );
    return rows;
  },
  async create({ userId, recordType, detail, office, status = '申請済み' }) {
    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1000);
    const requestNo = `R-${ts.toString().slice(-7)}${String(rand).padStart(3, '0')}`;
    const sql = `
      INSERT INTO employee_requests (request_no, status, record_type, detail, user_id, office)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [res] = await db.query(sql, [requestNo, status, recordType, detail || null, userId, office || null]);
    return { id: res.insertId, requestNo };
  }
};
