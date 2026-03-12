const db = require('../../core/database/mysql');

module.exports = {
  async listUsers() {
    try { await db.query(`ALTER TABLE users ADD COLUMN employee_code VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_type VARCHAR(16) NOT NULL DEFAULT 'full_time'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN hire_date DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN lang VARCHAR(8) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN region VARCHAR(16) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN contract_type VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_expiry DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN insurance_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_status VARCHAR(16) NOT NULL DEFAULT 'active'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN join_date DATE NULL`); } catch {}
    const sql = `SELECT id, employee_code, username, email, role, departmentId, employment_type, address, contract_type, visa_number, visa_expiry, insurance_number, employment_status, hire_date, join_date FROM users ORDER BY id DESC`;
    const [rows] = await db.query(sql);
    return rows;
  },
  async getUserById(id) {
    try { await db.query(`ALTER TABLE users ADD COLUMN employee_code VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_type VARCHAR(16) NOT NULL DEFAULT 'full_time'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN hire_date DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN lang VARCHAR(8) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN region VARCHAR(16) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN contract_type VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_expiry DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN insurance_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_status VARCHAR(16) NOT NULL DEFAULT 'active'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN join_date DATE NULL`); } catch {}
    const sql = `SELECT id, employee_code, username, email, role, departmentId, employment_type, lang, region, timezone, address, contract_type, visa_number, visa_expiry, insurance_number, employment_status, hire_date, join_date FROM users WHERE id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  },
  async createUser({ employeeCode = null, username, email, password, role = 'employee', departmentId = null, employmentType = 'full_time', hireDate = null }) {
    try { await db.query(`ALTER TABLE users ADD COLUMN email_lower VARCHAR(255) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD UNIQUE KEY uniq_email_lower (email_lower)`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employee_code VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD UNIQUE KEY uniq_employee_code (employee_code)`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_type VARCHAR(16) NOT NULL DEFAULT 'full_time'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN hire_date DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN lang VARCHAR(8) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN region VARCHAR(16) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN contract_type VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_expiry DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN insurance_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_status VARCHAR(16) NOT NULL DEFAULT 'active'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN join_date DATE NULL`); } catch {}
    const sql = `INSERT INTO users (employee_code, username, email, email_lower, password, role, departmentId, employment_type, hire_date, lang, region, timezone, address, contract_type, visa_number, visa_expiry, insurance_number, employment_status, join_date) VALUES (?, ?, ?, LOWER(?), ?, ?, ?, ?, COALESCE(?, CURRENT_DATE), NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', COALESCE(?, CURRENT_DATE))`;
    const [res] = await db.query(sql, [employeeCode, username, email, email, password, role, departmentId, employmentType || 'full_time', hireDate, hireDate]);
    const id = res.insertId;
    if (!employeeCode) {
      const gen = 'EMP' + String(id).padStart(3, '0');
      await db.query(`UPDATE users SET employee_code = ? WHERE id = ?`, [gen, id]);
    }
    return id;
  },
  async updateUser(id, { employeeCode, username, email, role, departmentId, employmentType, hireDate, lang, region, timezone, address, contractType, visaNumber, visaExpiry, insuranceNumber, employmentStatus, joinDate }) {
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_type VARCHAR(16) NOT NULL DEFAULT 'full_time'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employee_code VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN hire_date DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN lang VARCHAR(8) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN region VARCHAR(16) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN timezone VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN contract_type VARCHAR(32) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN visa_expiry DATE NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN insurance_number VARCHAR(64) NULL`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN employment_status VARCHAR(16) NOT NULL DEFAULT 'active'`); } catch {}
    try { await db.query(`ALTER TABLE users ADD COLUMN join_date DATE NULL`); } catch {}
    const sql = `
      UPDATE users
      SET username = COALESCE(?, username),
          email = COALESCE(?, email),
          email_lower = COALESCE(LOWER(?), email_lower),
          role = COALESCE(?, role),
          departmentId = COALESCE(?, departmentId),
          employment_type = COALESCE(?, employment_type),
          employee_code = COALESCE(?, employee_code),
          hire_date = COALESCE(?, hire_date),
          lang = COALESCE(?, lang),
          region = COALESCE(?, region),
          timezone = COALESCE(?, timezone),
          address = COALESCE(?, address),
          contract_type = COALESCE(?, contract_type),
          visa_number = COALESCE(?, visa_number),
          visa_expiry = COALESCE(?, visa_expiry),
          insurance_number = COALESCE(?, insurance_number),
          employment_status = COALESCE(?, employment_status),
          join_date = COALESCE(?, join_date)
      WHERE id = ?
    `;
    await db.query(sql, [
      username || null,
      email || null,
      email || null,
      role || null,
      departmentId || null,
      employmentType || null,
      employeeCode || null,
      hireDate || null,
      lang || null,
      region || null,
      timezone || null,
      address || null,
      contractType || null,
      visaNumber || null,
      visaExpiry || null,
      insuranceNumber || null,
      employmentStatus || null,
      joinDate || null,
      id
    ]);
  },
  async deleteUser(id) {
    const sql = `DELETE FROM users WHERE id = ?`;
    await db.query(sql, [id]);
  },
  async setRole(id, role) {
    const sql = `UPDATE users SET role = ? WHERE id = ?`;
    await db.query(sql, [role, id]);
  },
  async setDepartment(id, departmentId) {
    const sql = `UPDATE users SET departmentId = ? WHERE id = ?`;
    await db.query(sql, [departmentId, id]);
  },
  async setPassword(id, hashedPassword) {
    const sql = `UPDATE users SET password = ? WHERE id = ?`;
    await db.query(sql, [hashedPassword, id]);
  },
  async getAllDepartments() {
    const sql = `SELECT * FROM departments ORDER BY name ASC`;
    const [rows] = await db.query(sql);
    return rows;
  },

  async getDepartmentById(id) {
    const sql = `SELECT * FROM departments WHERE id = ? LIMIT 1`;
    const [rows] = await db.query(sql, [id]);
    return rows[0];
  },

  async createDepartment(name) {
    const sql = `INSERT INTO departments (name) VALUES (?)`;
    const [result] = await db.query(sql, [name]);
    return result.insertId;
  },

  async updateDepartment(id, name) {
    const sql = `UPDATE departments SET name = ? WHERE id = ?`;
    await db.query(sql, [name, id]);
  },

  async deleteDepartment(id) {
    const sql = `DELETE FROM departments WHERE id = ?`;
    await db.query(sql, [id]);
  }
};
