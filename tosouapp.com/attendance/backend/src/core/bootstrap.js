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
      },
      {
        id: '20260323_01_notices_target_user',
        up: async () => {
          await conn.query(`
            CREATE TABLE IF NOT EXISTS notices (
              id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              target_user_id BIGINT UNSIGNED NULL,
              target_date DATE NULL,
              target_month CHAR(7) NULL,
              message TEXT NOT NULL,
              created_by BIGINT UNSIGNED NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_target_user_id (target_user_id),
              INDEX idx_target_date (target_date),
              INDEX idx_target_month (target_month),
              INDEX idx_created_at (created_at),
              INDEX idx_created_by (created_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);
          try { await conn.query(`ALTER TABLE notices ADD COLUMN target_user_id BIGINT UNSIGNED NULL`); } catch {}
          try { await conn.query(`CREATE INDEX idx_target_user_id ON notices (target_user_id)`); } catch {}
        }
      },
      {
        id: '20260323_02_notice_reads',
        up: async () => {
          await conn.query(`
            CREATE TABLE IF NOT EXISTS notice_reads (
              notice_id BIGINT UNSIGNED NOT NULL,
              user_id BIGINT UNSIGNED NOT NULL,
              read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (notice_id, user_id),
              INDEX idx_user_id (user_id),
              INDEX idx_read_at (read_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);
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

async function ensureModuleTables() {
  const attendanceRepo = require('../modules/attendance/attendance.repository');
  const auditRepo = require('../modules/audit/audit.repository');
  const authRepo = require('../modules/auth/auth.repository');
  const refreshRepo = require('../modules/auth/refresh.repository');
  const passwordResetRepo = require('../modules/auth/password_reset.repository');
  const leaveRepo = require('../modules/leave/leave.repository');
  const workReportsRepo = require('../modules/workReports/workReports.repository');
  const calendarRepo = require('../modules/calendar/calendar.repository');
  const settingsRepo = require('../modules/settings/settings.repository');
  const salaryInputRepo = require('../modules/salary/salaryInput.repository');
  const payslipDeliveryRepo = require('../modules/salary/payslipDelivery.repository');
  const documentsRepo = require('../modules/documents/documents.repository');
  const payslipRepo = require('../modules/payslip/payslip.repository');
  const adjustRepo = require('../modules/adjust/adjust.repository');
  const expensesRepo = require('../modules/expenses/expenses.repository');
  const stationsRepo = require('../modules/stations/stations.repository');
  const expenseTypesRepo = require('../modules/expenses/expenseTypes.repository');  const chatbotRepo = require('../modules/chatbot/chatbot.repository');
  const salaryRepo = require('../modules/salary/salary.repository');
  const requestsRepo = require('../modules/requests/requests.repository');
  const webauthnRepo = require('../modules/webauthn/webauthn.repository');
  const faqRepo = require('../modules/faq/faq.repository');
  await attendanceRepo.ensureAttendanceTables();
  await auditRepo.ensureTable();
  await authRepo.ensureUserSecurityColumns();
  await refreshRepo.ensureTable();
  await passwordResetRepo.ensureTable();
  await leaveRepo.ensureSchema();
  await workReportsRepo.ensureSchema();
  await workReportsRepo.ensureMonthClosureSchema();
  await calendarRepo.ensureTable();
  await settingsRepo.ensureFlagsSchema();
  await salaryInputRepo.ensureTable();
  await payslipDeliveryRepo.ensureTable();
  await documentsRepo.ensureTable();
  await payslipRepo.ensureTable();
  await adjustRepo.ensureSchema();
  await expensesRepo.ensureTable();
  await expenseTypesRepo.ensureTable();
  await stationsRepo.ensureTable();  await webauthnRepo.ensureTable();
  await requestsRepo.ensureTable();  await faqRepo.ensureTable();
  try {
    await faqRepo.seedIfEmpty();
    await chatbotRepo.init();
    await chatbotRepo.ensureSeedCategories();
    await chatbotRepo.ensureSeedFaqs();
  } catch {}
  try {
    await salaryRepo.listHistory({ page: 1, pageSize: 1 });
  } catch {}
}

let initPromise = null;

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureUsersTable();
      await runMigrations();
      await ensureModuleTables();
      await ensureSuperAdmin();
    })();
  }
  return initPromise;
}

module.exports = { init };
