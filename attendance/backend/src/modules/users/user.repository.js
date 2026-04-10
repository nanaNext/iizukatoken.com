const db = require('../../core/database/mysql');

module.exports = {
  async listUsers() {
    const [rows] = await db.query(`SELECT * FROM users ORDER BY id DESC`);
    return rows;
  },
  async listUsersPaged({ q = '', role = null, departmentId = null, employmentStatus = null, limit = 100, offset = 0 } = {}) {
    const qq = String(q || '').trim().toLowerCase();
    const lim = Math.min(5000, Math.max(1, Number.parseInt(String(limit || '100'), 10) || 100));
    const off = Math.max(0, Number.parseInt(String(offset || '0'), 10) || 0);
    const where = [];
    const params = [];
    if (role != null && String(role || '').trim()) {
      where.push('LOWER(role) = ?');
      params.push(String(role).toLowerCase());
    }
    if (departmentId != null && String(departmentId || '').trim()) {
      where.push('departmentId = ?');
      params.push(String(departmentId));
    }
    if (employmentStatus != null && String(employmentStatus || '').trim()) {
      where.push('LOWER(employment_status) = ?');
      params.push(String(employmentStatus).toLowerCase());
    }
    if (qq) {
      where.push(`LOWER(CONCAT_WS(' ', employee_code, username, email, id)) LIKE ?`);
      params.push(`%${qq}%`);
    }
    const wsql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const [rows] = await db.query(
      `SELECT * FROM users ${wsql} ORDER BY employee_code ASC, username ASC LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );
    const [cntRows] = await db.query(
      `SELECT COUNT(*) AS total FROM users ${wsql}`,
      params
    );
    const total = Number(cntRows?.[0]?.total || 0);
    return { rows, total, limit: lim, offset: off };
  },
  async getUserById(id) {
    const [rows] = await db.query(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
    return rows[0];
  },
  async createUser({ employeeCode = null, username, email, password, role = 'employee', departmentId = null, employmentType = 'full_time', hireDate = null, level = null, managerId = null, phone = null, birthDate = null, gender = null, avatarUrl = null, probationDate = null, officialDate = null, contractEnd = null, baseSalary = null, shiftId = null, employmentStatus = null, joinDate = null }) {
    const today = new Date().toISOString().slice(0, 10);
    const cols = [
      'employee_code',
      'username',
      'email',
      'email_lower',
      'password',
      'role',
      'departmentId',
      'level',
      'manager_id',
      'employment_type',
      'hire_date',
      'birth_date',
      'gender',
      'phone',
      'avatar_url',
      'probation_date',
      'official_date',
      'contract_end',
      'base_salary',
      'shift_id',
      'employment_status',
      'join_date'
    ];
    const vals = [
      employeeCode,
      username,
      email,
      email,
      password,
      role,
      departmentId,
      level,
      managerId,
      employmentType || 'full_time',
      hireDate,
      birthDate,
      gender,
      phone,
      avatarUrl,
      probationDate,
      officialDate,
      contractEnd,
      baseSalary,
      shiftId,
      employmentStatus || 'active',
      joinDate || hireDate || today
    ];
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders})`;
    const [res] = await db.query(sql, vals);
    const id = res.insertId;
    if (!employeeCode) {
      const gen = 'EMP' + String(id).padStart(3, '0');
      await db.query(`UPDATE users SET employee_code = ? WHERE id = ?`, [gen, id]);
    }
    return id;
  },
  async updateUser(id, { employeeCode, username, email, role, departmentId, level, managerId, employmentType, hireDate, birthDate, gender, phone, avatarUrl, probationDate, officialDate, lang, region, timezone, address, contractType, visaNumber, visaExpiry, insuranceNumber, employmentStatus, contractEnd, baseSalary, shiftId, joinDate, lastLogin }) {
    const sql = `
      UPDATE users
      SET username = COALESCE(?, username),
          email = COALESCE(?, email),
          email_lower = COALESCE(LOWER(?), email_lower),
          role = COALESCE(?, role),
          departmentId = COALESCE(?, departmentId),
          level = COALESCE(?, level),
          manager_id = COALESCE(?, manager_id),
          employment_type = COALESCE(?, employment_type),
          employee_code = COALESCE(?, employee_code),
          hire_date = COALESCE(?, hire_date),
          birth_date = COALESCE(?, birth_date),
          gender = COALESCE(?, gender),
          phone = COALESCE(?, phone),
          avatar_url = COALESCE(?, avatar_url),
          probation_date = COALESCE(?, probation_date),
          official_date = COALESCE(?, official_date),
          lang = COALESCE(?, lang),
          region = COALESCE(?, region),
          timezone = COALESCE(?, timezone),
          address = COALESCE(?, address),
          contract_type = COALESCE(?, contract_type),
          visa_number = COALESCE(?, visa_number),
          visa_expiry = COALESCE(?, visa_expiry),
          insurance_number = COALESCE(?, insurance_number),
          employment_status = COALESCE(?, employment_status),
          contract_end = COALESCE(?, contract_end),
          base_salary = COALESCE(?, base_salary),
          shift_id = COALESCE(?, shift_id),
          join_date = COALESCE(?, join_date)
          ${'' /* keep last_login separate to avoid MySQL syntax issues */}
          , last_login = COALESCE(?, last_login)
      WHERE id = ?
    `;
    await db.query(sql, [
      username || null,
      email || null,
      email || null,
      role || null,
      departmentId || null,
      level || null,
      managerId || null,
      employmentType || null,
      employeeCode || null,
      hireDate || null,
      birthDate || null,
      gender || null,
      phone || null,
      avatarUrl || null,
      probationDate || null,
      officialDate || null,
      lang || null,
      region || null,
      timezone || null,
      address || null,
      contractType || null,
      visaNumber || null,
      visaExpiry || null,
      insuranceNumber || null,
      employmentStatus || null,
      contractEnd || null,
      baseSalary || null,
      shiftId || null,
      joinDate || null,
      lastLogin || null,
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
  },

  async touchLastActive(id, at = null) {
    try { await db.query(`ALTER TABLE users ADD COLUMN last_active_at DATETIME NULL`); } catch {}
    const sql = `UPDATE users SET last_active_at = COALESCE(?, NOW()) WHERE id = ?`;
    await db.query(sql, [at ? String(at).slice(0, 19).replace('T', ' ') : null, id]);
  }
};
