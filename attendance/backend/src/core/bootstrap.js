const db = require('../core/database/mysql');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../config/env');

async function ensureUsersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      employee_code VARCHAR(32) NULL,
      username VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      email_lower VARCHAR(255) NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'employee',
      departmentId BIGINT NULL,
      employment_type VARCHAR(16) NOT NULL DEFAULT 'full_time',
      hire_date DATE NULL,
      lang VARCHAR(8) NULL,
      region VARCHAR(16) NULL,
      timezone VARCHAR(64) NULL,
      address VARCHAR(255) NULL,
      contract_type VARCHAR(32) NULL,
      visa_number VARCHAR(64) NULL,
      visa_expiry DATE NULL,
      insurance_number VARCHAR(64) NULL,
      employment_status VARCHAR(16) NOT NULL DEFAULT 'active',
      join_date DATE NULL,
      login_fail_count INT DEFAULT 0,
      locked_until DATETIME NULL,
      token_version INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_employee_code (employee_code),
      UNIQUE KEY uniq_email_lower (email_lower)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const username = process.env.SUPER_ADMIN_NAME || 'Super Admin';
  if (!email || !password) return;
  const [rows] = await db.query(`SELECT id FROM users WHERE email_lower = LOWER(?) LIMIT 1`, [email]);
  if (rows && rows.length) return;
  const hashed = /^\$2[aby]\$\d+\$/.test(password) ? password : bcrypt.hashSync(password, bcryptRounds);
  await db.query(
    `INSERT INTO users (employee_code, username, email, email_lower, password, role, employment_type, employment_status, hire_date, join_date)
     VALUES (NULL, ?, ?, LOWER(?), ?, 'admin', 'full_time', 'active', CURRENT_DATE, CURRENT_DATE)`,
    [username, email, email, hashed]
  );
}

async function init() {
  await ensureUsersTable();
  await ensureSuperAdmin();
}

module.exports = { init };
