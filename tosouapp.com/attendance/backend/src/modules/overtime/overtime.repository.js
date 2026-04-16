const db = require('../../core/database/mysql');

module.exports = {
  async requestOvertime(userId, date, minutes) {
    const sql = `INSERT INTO overtime (userId, date, requestedMinutes) VALUES (?, ?, ?)`;
    await db.query(sql, [userId, date, minutes]);
  }
};
