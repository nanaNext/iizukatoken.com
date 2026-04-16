const db = require('../../core/database/mysql');

async function ensureDepartmentsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try { await db.query(`ALTER TABLE departments ADD COLUMN code VARCHAR(32) NULL`); } catch {}
  try { await db.query(`ALTER TABLE departments ADD UNIQUE KEY uniq_departments_code (code)`); } catch {}
}

module.exports = {
  async getAllDepartments() {
    await ensureDepartmentsTable();
    const sql = `SELECT id, name, code FROM departments ORDER BY name ASC`;
    const [rows] = await db.query(sql);
    return rows;
  },

  async getDepartmentById(id) {
    await ensureDepartmentsTable();
    const sql = `SELECT id, name, code FROM departments WHERE id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  },

  async createDepartment(name, code = null) {
    await ensureDepartmentsTable();
    const sql = `INSERT INTO departments (name, code) VALUES (?, ?)`;
    const [result] = await db.query(sql, [name, code]);
    return result.insertId;
  },

  async updateDepartment(id, name, code = null) {
    await ensureDepartmentsTable();
    const sql = `UPDATE departments SET name = COALESCE(?, name), code = COALESCE(?, code) WHERE id = ?`;
    await db.query(sql, [name || null, code || null, id]);
  },

  async deleteDepartment(id) {
    await ensureDepartmentsTable();
    const sql = `DELETE FROM departments WHERE id = ?`;
    await db.query(sql, [id]);
  },

  async createMany(names) {
    await ensureDepartmentsTable();
    const createdIds = [];
    for (const n of (names || [])) {
      if (!n || !String(n).trim()) continue;
      const [rows] = await db.query(`SELECT id FROM departments WHERE name = ? LIMIT 1`, [n]);
      if (Array.isArray(rows) && rows.length) {
        createdIds.push(rows[0].id);
        continue;
      }
      const [result] = await db.query(`INSERT INTO departments (name) VALUES (?)`, [n]);
      createdIds.push(result.insertId);
    }
    return createdIds;
  }
};
