const db = require('../../core/database/mysql');
module.exports = {
  async searchByName(q, limit = 20) {
    const term = String(q || '').trim();
    if (!term) return [];
    const like = `%${term}%`;
    const [rows] = await db.query(
      `SELECT id, station_name AS name, line_name 
       FROM stations 
       WHERE station_name LIKE ? 
       ORDER BY station_name ASC 
       LIMIT ?`, [like, Math.max(1, Math.min(50, Number(limit) || 20))]
    );
    return rows || [];
  }
};
module.exports.ensureTable = async function() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS stations (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      station_name VARCHAR(255) NOT NULL,
      line_name VARCHAR(255) NULL,
      location_lat DECIMAL(10,6) NULL,
      location_long DECIMAL(10,6) NULL,
      INDEX idx_station_name (station_name),
      INDEX idx_line_name (line_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};
