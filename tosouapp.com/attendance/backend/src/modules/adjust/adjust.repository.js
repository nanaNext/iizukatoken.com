const db = require('../../core/database/mysql');
// Repository yêu cầu sửa giờ
module.exports = {
  async create({ userId, attendanceId, requestedCheckIn, requestedCheckOut, reason }) {
    const sql = `
      INSERT INTO time_adjust_requests (userId, attendanceId, requestedCheckIn, requestedCheckOut, reason)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [res] = await db.query(sql, [userId, attendanceId || null, requestedCheckIn || null, requestedCheckOut || null, reason || null]);
    return res.insertId;
  },
  async listMine(userId) {
    const sql = `
      SELECT * FROM time_adjust_requests
      WHERE userId = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
  },
  async listByUser(userId) {
    const sql = `
      SELECT * FROM time_adjust_requests
      WHERE userId = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await db.query(sql, [userId]);
    return rows;
  },
  async updateStatus(id, status) {
    const sql = `UPDATE time_adjust_requests SET status = ? WHERE id = ?`;
    await db.query(sql, [status, id]);
  },
  // Lấy detail adjust request
  async getById(id) {
    const sql = `SELECT * FROM time_adjust_requests WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  }
  // Xóa adjust request theo id
  ,
  async deleteById(id) {
    const sql = `DELETE FROM time_adjust_requests WHERE id = ?`;
    const [res] = await db.query(sql, [id]);
    return Number(res?.affectedRows || 0);
  }
  ,
  async updateFields(id, { requestedCheckIn, requestedCheckOut, reason }) {
    const sql = `
      UPDATE time_adjust_requests
      SET requestedCheckIn = ?, requestedCheckOut = ?, reason = ?
      WHERE id = ?
    `;
    const [res] = await db.query(sql, [
      requestedCheckIn || null,
      requestedCheckOut || null,
      reason || null,
      id
    ]);
    return Number(res?.affectedRows || 0);
  }
};
// Lấy tất cả adjust requests cho admin
module.exports.listAll = async function() {
  const sql = `
    SELECT r.*, u.username, u.email
    FROM time_adjust_requests r
    LEFT JOIN users u ON r.userId = u.id
    ORDER BY r.created_at DESC
  `;
  const [rows] = await db.query(sql);
  return rows;
};

module.exports.ensureSchema = async function() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS time_adjust_requests (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      attendanceId BIGINT UNSIGNED NULL,
      requestedCheckIn DATETIME NULL,
      requestedCheckOut DATETIME NULL,
      reason TEXT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_userId (userId),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

// Xóa tất cả requests của admin (cleanup test data)
module.exports.deleteAdminRequests = async function() {
  const sql = `
    DELETE r FROM time_adjust_requests r
    INNER JOIN users u ON r.userId = u.id
    WHERE u.role = 'admin'
  `;
  const [result] = await db.query(sql);
  return result.affectedRows;
};
