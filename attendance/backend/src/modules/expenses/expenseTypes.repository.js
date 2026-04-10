const db = require('../../core/database/mysql');
module.exports = {
  async list() {
    const [rows] = await db.query(`SELECT id, code, name_ja AS nameJa, is_distance_based AS isDistanceBased FROM expense_types ORDER BY id ASC`);
    return rows || [];
  }
};
module.exports.ensureTable = async function() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expense_types (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) NOT NULL UNIQUE,
      name_ja VARCHAR(64) NOT NULL,
      is_distance_based TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  const defaults = [
    ['TRAIN', '電車', 0],
    ['BUS', 'バス', 0],
    ['TAXI', 'タクシー', 0],
    ['PRIVATE_CAR', '自家用車', 1],
    ['PARKING', '駐車場代', 0],
    ['HIGHWAY', '高速代', 0]
  ];
  for (const [code, name, dist] of defaults) {
    try { await db.query(`INSERT IGNORE INTO expense_types (code, name_ja, is_distance_based) VALUES (?, ?, ?)`, [code, name, dist ? 1 : 0]); } catch {}
  }
};
