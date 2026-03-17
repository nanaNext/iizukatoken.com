const db = require('../../core/database/mysql');

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_reports (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      attendanceId BIGINT UNSIGNED NULL,
      site VARCHAR(120) NOT NULL,
      work TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_date (userId, date),
      INDEX idx_date (date),
      INDEX idx_user (userId),
      CONSTRAINT fk_work_report_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    const [fk] = await db.query(`
      SELECT CONSTRAINT_NAME AS name
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'work_reports'
        AND COLUMN_NAME = 'attendanceId'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      LIMIT 1
    `);
    if (!fk || !fk.length) {
      try {
        await db.query(`
          ALTER TABLE work_reports
          ADD CONSTRAINT fk_work_report_attendance
          FOREIGN KEY (attendanceId) REFERENCES attendance(id)
          ON DELETE SET NULL
        `);
      } catch {}
    }
  } catch {}
}

async function ensureMonthClosureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS work_report_month_closures (
      month CHAR(7) PRIMARY KEY,
      closed_by BIGINT UNSIGNED NULL,
      closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_closed_by (closed_by),
      CONSTRAINT fk_wr_close_user FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

module.exports = {
  ensureSchema,
  ensureMonthClosureSchema,
  async isMonthClosed(month) {
    await ensureMonthClosureSchema();
    const [[row]] = await db.query(`
      SELECT month
      FROM work_report_month_closures
      WHERE month = ?
      LIMIT 1
    `, [month]);
    return !!row;
  },
  async closeMonth(month, closedBy) {
    await ensureMonthClosureSchema();
    await db.query(`
      INSERT INTO work_report_month_closures (month, closed_by)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE closed_by = closed_by
    `, [month, closedBy || null]);
    return { month, closed: true };
  },
  async upsert({ userId, date, attendanceId, site, work }) {
    await ensureSchema();
    const sql = `
      INSERT INTO work_reports (userId, date, attendanceId, site, work)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        attendanceId = COALESCE(VALUES(attendanceId), attendanceId),
        site = VALUES(site),
        work = VALUES(work)
    `;
    const [res] = await db.query(sql, [userId, date, attendanceId || null, site, work]);
    return res.insertId || null;
  },
  async getByUserDate(userId, date) {
    await ensureSchema();
    const [[row]] = await db.query(`
      SELECT *
      FROM work_reports
      WHERE userId = ? AND date = ?
      LIMIT 1
    `, [userId, date]);
    return row || null;
  },
  async listByUserMonth(userId, month) {
    await ensureSchema();
    const [y, m] = String(month || '').split('-').map(n => parseInt(n, 10));
    const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const [rows] = await db.query(`
      SELECT *
      FROM work_reports
      WHERE userId = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `, [userId, start, end]);
    return rows || [];
  },
  async listByMonth(month) {
    await ensureSchema();
    const [y, m] = String(month || '').split('-').map(n => parseInt(n, 10));
    const start = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
    const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const [rows] = await db.query(`
      SELECT *
      FROM work_reports
      WHERE date >= ? AND date <= ?
      ORDER BY date ASC, updated_at DESC
    `, [start, end]);
    return rows || [];
  },
  async listByDate(date) {
    await ensureSchema();
    const [rows] = await db.query(`
      SELECT *
      FROM work_reports
      WHERE date = ?
      ORDER BY updated_at DESC
    `, [date]);
    return rows || [];
  }
};
