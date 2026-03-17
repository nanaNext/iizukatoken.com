const db = require('../core/database/mysql');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../config/env');

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function runMigrations() {
  const conn = await db.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const [rows] = await conn.query(`SELECT id FROM schema_migrations`);
    const applied = new Set((rows || []).map(r => String(r.id)));
    const migrations = [
      {
        id: '20260316_01_users_extended_columns',
        up: async () => {
          try { await conn.query(`ALTER TABLE users ADD COLUMN birth_date DATE NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN gender VARCHAR(16) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(32) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN probation_date DATE NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN official_date DATE NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN manager_id BIGINT UNSIGNED NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN level VARCHAR(32) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN contract_end DATE NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN base_salary DECIMAL(12,2) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN shift_id BIGINT UNSIGNED NULL`); } catch {}
          try { await conn.query(`ALTER TABLE users ADD COLUMN last_login DATETIME NULL`); } catch {}
        }
      },
      {
        id: '20260316_02_departments_code_column',
        up: async () => {
          await conn.query(`
            CREATE TABLE IF NOT EXISTS departments (
              id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(255) NOT NULL UNIQUE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);
          try { await conn.query(`ALTER TABLE departments ADD COLUMN code VARCHAR(32) NULL`); } catch {}
          try { await conn.query(`ALTER TABLE departments ADD UNIQUE KEY uniq_departments_code (code)`); } catch {}
        }
      }
    ];
    for (const m of migrations) {
      if (applied.has(m.id)) continue;
      await m.up();
      await conn.query(`INSERT INTO schema_migrations (id) VALUES (?)`, [m.id]);
    }
  } finally {
    conn.release();
  }
}

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
      birth_date DATE NULL,
      gender VARCHAR(16) NULL,
      phone VARCHAR(32) NULL,
      avatar_url VARCHAR(255) NULL,
      probation_date DATE NULL,
      official_date DATE NULL,
      manager_id BIGINT UNSIGNED NULL,
      level VARCHAR(32) NULL,
      contract_end DATE NULL,
      base_salary DECIMAL(12,2) NULL,
      shift_id BIGINT UNSIGNED NULL,
      last_login DATETIME NULL,
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
  await runMigrations();
  await ensureSuperAdmin();
}

module.exports = { init };
