const db = require('../../core/database/mysql');
async function ensureAttendanceSchema() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT UNSIGNED NOT NULL,
        checkIn DATETIME NULL,
        checkOut DATETIME NULL,
        work_type VARCHAR(24) NULL,
        labels VARCHAR(255) NULL,
        shiftId BIGINT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_checkin (userId, checkIn),
        INDEX idx_user_checkout (userId, checkOut),
        INDEX idx_checkin (checkIn),
        INDEX idx_shift (shiftId),
        CONSTRAINT fk_attendance_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const [cols] = await db.query(`
      SELECT COLUMN_NAME AS name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'attendance'
    `);
    const set = new Set((cols || []).map(c => String(c.name)));
    const alters = [];
    if (!set.has('in_latitude')) alters.push(`ADD COLUMN in_latitude DECIMAL(9,6) NULL`);
    if (!set.has('in_longitude')) alters.push(`ADD COLUMN in_longitude DECIMAL(9,6) NULL`);
    if (!set.has('in_accuracy')) alters.push(`ADD COLUMN in_accuracy INT NULL`);
    if (!set.has('in_locationSource')) alters.push(`ADD COLUMN in_locationSource ENUM('gps','ip') NULL`);
    if (!set.has('in_countryCode')) alters.push(`ADD COLUMN in_countryCode CHAR(2) NULL`);
    if (!set.has('in_note')) alters.push(`ADD COLUMN in_note VARCHAR(255) NULL`);
    if (!set.has('in_deviceId')) alters.push(`ADD COLUMN in_deviceId VARCHAR(64) NULL`);
    if (!set.has('in_tzOffset')) alters.push(`ADD COLUMN in_tzOffset INT NULL`);
    if (!set.has('out_latitude')) alters.push(`ADD COLUMN out_latitude DECIMAL(9,6) NULL`);
    if (!set.has('out_longitude')) alters.push(`ADD COLUMN out_longitude DECIMAL(9,6) NULL`);
    if (!set.has('out_accuracy')) alters.push(`ADD COLUMN out_accuracy INT NULL`);
    if (!set.has('out_locationSource')) alters.push(`ADD COLUMN out_locationSource ENUM('gps','ip') NULL`);
    if (!set.has('out_countryCode')) alters.push(`ADD COLUMN out_countryCode CHAR(2) NULL`);
    if (!set.has('out_note')) alters.push(`ADD COLUMN out_note VARCHAR(255) NULL`);
    if (!set.has('out_deviceId')) alters.push(`ADD COLUMN out_deviceId VARCHAR(64) NULL`);
    if (!set.has('out_tzOffset')) alters.push(`ADD COLUMN out_tzOffset INT NULL`);
    if (!set.has('labels')) alters.push(`ADD COLUMN labels VARCHAR(255) NULL`);
    if (!set.has('work_type')) alters.push(`ADD COLUMN work_type VARCHAR(24) NULL`);
    if (!set.has('is_anomaly')) alters.push(`ADD COLUMN is_anomaly TINYINT(1) NOT NULL DEFAULT 0`);
    if (!set.has('anomaly_type')) alters.push(`ADD COLUMN anomaly_type VARCHAR(64) NULL`);
    
    if (alters.length) {
      await db.query(`ALTER TABLE attendance ${alters.join(', ')}`);
    }

    // UNIQUE INDEX (userId, checkIn) - Chặn rủi ro Double Submit (Ưu tiên 1)
    const [indexes] = await db.query(`SHOW INDEX FROM attendance WHERE Key_name = 'unique_user_checkin'`);
    if (!indexes.length) {
      try {
        await db.query(`ALTER TABLE attendance ADD CONSTRAINT unique_user_checkin UNIQUE (userId, checkIn)`);
      } catch (err) {
        try {
          console.warn('⚠️ Could not add unique constraint, maybe duplicates already exist:', err.message);
          // Deduplicate: keep the smallest id per (userId, checkIn)
          await db.query(`
            DELETE a FROM attendance a
            JOIN (
              SELECT userId, checkIn, MIN(id) AS keep_id, COUNT(*) AS cnt
              FROM attendance
              WHERE checkIn IS NOT NULL
              GROUP BY userId, checkIn
              HAVING cnt > 1
            ) d
              ON d.userId = a.userId AND d.checkIn = a.checkIn AND a.id <> d.keep_id
          `);
          await db.query(`ALTER TABLE attendance ADD CONSTRAINT unique_user_checkin UNIQUE (userId, checkIn)`);
          console.warn('[repair] duplicate attendance rows cleaned and unique index added');
        } catch (e2) {
          console.warn('⚠️ Unique constraint still not added:', e2.message);
        }
      }
    }
    const [idx] = await db.query(`
      SELECT index_name 
      FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'attendance'
    `);
    const idxSet = new Set((idx || []).map(i => String(i.index_name)));
    if (!idxSet.has('idx_user_checkin')) {
      try { await db.query(`ALTER TABLE attendance ADD INDEX idx_user_checkin (userId, checkIn)`); } catch {}
    }
    if (!idxSet.has('idx_user_checkout')) {
      try { await db.query(`ALTER TABLE attendance ADD INDEX idx_user_checkout (userId, checkOut)`); } catch {}
    }
    if (!idxSet.has('idx_checkin')) {
      try { await db.query(`ALTER TABLE attendance ADD INDEX idx_checkin (checkIn)`); } catch {}
    }
    try {
      const [cols2] = await db.query(`
        SELECT COLUMN_NAME AS name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = 'attendance'
      `);
      const set2 = new Set((cols2 || []).map(c => String(c.name)));
      if (!set2.has('shiftId')) {
        await db.query(`ALTER TABLE attendance ADD COLUMN shiftId BIGINT UNSIGNED NULL`);
        try { await db.query(`ALTER TABLE attendance ADD INDEX idx_shift (shiftId)`); } catch {}
      }
    } catch {}
  } catch {}
}

async function ensureAttendanceDailySchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_daily (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      kubun VARCHAR(24) NULL,
      kubun_confirmed TINYINT(1) NOT NULL DEFAULT 0,
      work_type VARCHAR(24) NULL,
      location VARCHAR(120) NULL,
      reason VARCHAR(32) NULL,
      memo VARCHAR(255) NULL,
      break_minutes INT NULL,
      night_break_minutes INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_date (userId, date),
      INDEX idx_user_date (userId, date),
      CONSTRAINT fk_attendance_daily_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME AS name
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'attendance_daily'
    `);
    const set = new Set((cols || []).map((c) => String(c.name)));
    const alters = [];
    if (!set.has('kubun')) alters.push(`ADD COLUMN kubun VARCHAR(24) NULL`);
    if (!set.has('kubun_confirmed')) alters.push(`ADD COLUMN kubun_confirmed TINYINT(1) NOT NULL DEFAULT 0`);
    if (!set.has('work_type')) alters.push(`ADD COLUMN work_type VARCHAR(24) NULL`);
    if (!set.has('location')) alters.push(`ADD COLUMN location VARCHAR(120) NULL`);
    if (!set.has('reason')) alters.push(`ADD COLUMN reason VARCHAR(32) NULL`);
    if (!set.has('memo')) alters.push(`ADD COLUMN memo VARCHAR(255) NULL`);
    if (!set.has('break_minutes')) alters.push(`ADD COLUMN break_minutes INT NULL`);
    if (!set.has('night_break_minutes')) alters.push(`ADD COLUMN night_break_minutes INT NULL`);
    if (!set.has('created_at')) alters.push(`ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    if (!set.has('updated_at')) alters.push(`ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    if (alters.length) {
      try { await db.query(`ALTER TABLE attendance_daily ${alters.join(', ')}`); } catch {}
    }
  } catch {}
}

async function ensureAttendanceMonthStatusSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_month_status (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      year INT NOT NULL,
      month INT NOT NULL,
      status ENUM('draft','submitted','approved','unlocked') NOT NULL DEFAULT 'draft',
      submitted_at DATETIME NULL,
      submitted_by BIGINT UNSIGNED NULL,
      approved_at DATETIME NULL,
      approved_by BIGINT UNSIGNED NULL,
      unlocked_at DATETIME NULL,
      unlocked_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_year_month (userId, year, month),
      INDEX idx_year_month (year, month),
      INDEX idx_status (status),
      CONSTRAINT fk_ams_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureWorkDetailsSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_work_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NULL,
      company_name VARCHAR(120) NULL,
      work_place_address VARCHAR(255) NULL,
      work_content VARCHAR(255) NULL,
      role_title VARCHAR(80) NULL,
      responsibility_level VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_date (userId, start_date, end_date),
      CONSTRAINT fk_uwd_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureAttendanceMonthSummarySchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_month_summary (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      year INT NOT NULL,
      month INT NOT NULL,
      summary_all TEXT NULL,
      summary_inhouse TEXT NULL,
      updated_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_year_month (userId, year, month),
      INDEX idx_year_month (year, month),
      CONSTRAINT fk_amsum_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
async function getAttendanceColumnSet() {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME AS name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'attendance'
    `);
    return new Set((cols || []).map(c => String(c.name)));
  } catch {
    return new Set();
  }
}
async function listColumns() {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME AS name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'attendance'
    `);
    return (cols || []).map(c => String(c.name));
  } catch {
    return [];
  }
}
async function getUSAColumnSet() {
  try {
    const [cols] = await db.query(`
      SELECT COLUMN_NAME AS name 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() AND table_name = 'user_shift_assignments'
    `);
    return new Set((cols || []).map(c => String(c.name)));
  } catch {
    try {
      const [cols2] = await db.query(`SHOW COLUMNS FROM user_shift_assignments`);
      return new Set((cols2 || []).map(c => String(c.Field)));
    } catch {
      return new Set();
    }
  }
}

function getUSAStartCol(set) {
  if (set && set.has && set.has('date')) return 'date';
  if (set && set.has && set.has('start_date')) return 'start_date';
  return 'start_date';
}

module.exports = {
  async ensureShiftTables() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS shift_definitions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(64) NOT NULL UNIQUE,
        start_time CHAR(5) NOT NULL,
        end_time CHAR(5) NOT NULL,
        break_minutes INT NOT NULL DEFAULT 0,
        standard_minutes INT NOT NULL,
        working_days VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    // Add working_days column if not exists
    try {
      const [cols] = await db.query(`SHOW COLUMNS FROM shift_definitions`);
      const set = new Set((cols || []).map(c => String(c.Field)));
      if (!set.has('working_days')) {
        await db.query(`ALTER TABLE shift_definitions ADD COLUMN working_days VARCHAR(255) NULL`);
      }
    } catch {}
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_shift_assignments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT UNSIGNED NOT NULL,
        shiftId BIGINT UNSIGNED NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_date (userId, start_date, end_date),
        INDEX idx_shift (shiftId),
        CONSTRAINT fk_usa_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_usa_shift FOREIGN KEY (shiftId) REFERENCES shift_definitions(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      const [cols] = await db.query(`
        SELECT COLUMN_NAME AS name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = 'user_shift_assignments'
      `);
      const set = new Set((cols || []).map(c => String(c.name)));
      const alters = [];
      if (!set.has('userId')) alters.push(`ADD COLUMN userId BIGINT UNSIGNED NOT NULL`);
      if (!set.has('shiftId')) alters.push(`ADD COLUMN shiftId BIGINT UNSIGNED NOT NULL`);
      if (!set.has('start_date') && !set.has('date')) alters.push(`ADD COLUMN start_date DATE NOT NULL`);
      if (!set.has('end_date')) alters.push(`ADD COLUMN end_date DATE NULL`);
      if (alters.length) {
        await db.query(`ALTER TABLE user_shift_assignments ${alters.join(', ')}`);
      }
      const [idx] = await db.query(`
        SELECT index_name 
        FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'user_shift_assignments'
      `);
      const idxSet = new Set((idx || []).map(i => String(i.index_name)));
      if (!idxSet.has('idx_user_date')) {
        const startCol = set.has('date') ? 'date' : 'start_date';
        try { await db.query(`ALTER TABLE user_shift_assignments ADD INDEX idx_user_date (userId, ${startCol}, end_date)`); } catch {}
      }
      if (!idxSet.has('idx_shift')) {
        try { await db.query(`ALTER TABLE user_shift_assignments ADD INDEX idx_shift (shiftId)`); } catch {}
      }
      try {
        const [fkUser] = await db.query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_shift_assignments' AND COLUMN_NAME = 'userId' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        if (!fkUser || !fkUser.length) {
          try { await db.query(`ALTER TABLE user_shift_assignments ADD CONSTRAINT fk_usa_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`); } catch {}
        }
        const [fkShift] = await db.query(`
          SELECT CONSTRAINT_NAME 
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_shift_assignments' AND COLUMN_NAME = 'shiftId' AND REFERENCED_TABLE_NAME IS NOT NULL
        `);
        if (!fkShift || !fkShift.length) {
          try { await db.query(`ALTER TABLE user_shift_assignments ADD CONSTRAINT fk_usa_shift FOREIGN KEY (shiftId) REFERENCES shift_definitions(id) ON DELETE RESTRICT`); } catch {}
        }
      } catch {}
    } catch {}
    const [rows] = await db.query(`SELECT COUNT(*) AS c FROM shift_definitions`);
    const c = rows && rows[0] ? Number(rows[0].c) : 0;
    if (c === 0) {
      const defs = [
        { name: 'day_8_17', s: '08:00', e: '17:00', b: 60, w: 'mon-fri-sat' },
        { name: 'day_9_17', s: '09:00', e: '17:00', b: 60, w: 'mon-fri' },
        { name: 'baito_flex', s: '09:00', e: '14:00', b: 0, w: 'flexible' }
      ];
      for (const d of defs) {
        const start = d.s.split(':').map(Number);
        const end = d.e.split(':').map(Number);
        const std = Math.max(0, (end[0]*60+end[1]) - (start[0]*60+start[1]) - d.b);
        await db.query(`
          INSERT INTO shift_definitions (name, start_time, end_time, break_minutes, standard_minutes, working_days)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [d.name, d.s, d.e, d.b, std, d.w]);
      }
    }
  },
  async ensureAttendanceTables() {
    await ensureAttendanceSchema();
    await ensureAttendanceDailySchema();
    await ensureAttendanceMonthStatusSchema();
    await this.ensureShiftTables();
    return { ok: true };
  },
  async ensureMonthStatusTable() {
    await ensureAttendanceMonthStatusSchema();
    return { ok: true };
  },
  async getMonthStatus(userId, year, month) {
    await ensureAttendanceMonthStatusSchema();
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (!userId || !y || !m) return null;
    const [rows] = await db.query(
      `
      SELECT ams.*, u.username AS approved_by_name
      FROM attendance_month_status ams
      LEFT JOIN users u ON u.id = ams.approved_by
      WHERE ams.userId = ? AND ams.year = ? AND ams.month = ?
      LIMIT 1
      `,
      [userId, y, m]
    );
    return rows && rows[0] ? rows[0] : null;
  },
  async getMonthStatusBulk(userIds, year, month) {
    await ensureAttendanceMonthStatusSchema();
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (!Array.isArray(userIds) || !userIds.length || !y || !m) return [];
    const [rows] = await db.query(
      `
      SELECT ams.*, u.username AS approved_by_name
      FROM attendance_month_status ams
      LEFT JOIN users u ON u.id = ams.approved_by
      WHERE ams.userId IN (?) AND ams.year = ? AND ams.month = ?
      `,
      [userIds, y, m]
    );
    return rows || [];
  },
  async setMonthStatus(userId, year, month, status, actorId) {
    await ensureAttendanceMonthStatusSchema();
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    const st = String(status || '').trim();
    if (!userId || !y || !m) return { ok: false };
    const allowed = new Set(['draft','submitted','approved','unlocked']);
    if (!allowed.has(st)) return { ok: false };
    const actor = actorId != null ? parseInt(String(actorId), 10) : null;
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const fmt = (d) => {
      const z = (n) => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}`;
    };
    const submittedAt = st === 'submitted' ? fmt(now) : null;
    const approvedAt = st === 'approved' ? fmt(now) : null;
    const unlockedAt = st === 'unlocked' ? fmt(now) : null;
    const [res] = await db.query(
      `
        INSERT INTO attendance_month_status (userId, year, month, status, submitted_at, submitted_by, approved_at, approved_by, unlocked_at, unlocked_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          submitted_at = COALESCE(VALUES(submitted_at), submitted_at),
          submitted_by = COALESCE(VALUES(submitted_by), submitted_by),
          approved_at = COALESCE(VALUES(approved_at), approved_at),
          approved_by = COALESCE(VALUES(approved_by), approved_by),
          unlocked_at = COALESCE(VALUES(unlocked_at), unlocked_at),
          unlocked_by = COALESCE(VALUES(unlocked_by), unlocked_by)
      `,
      [
        userId,
        y,
        m,
        st,
        submittedAt,
        st === 'submitted' ? actor : null,
        approvedAt,
        st === 'approved' ? actor : null,
        unlockedAt,
        st === 'unlocked' ? actor : null
      ]
    );
    return { ok: true, affectedRows: Number(res?.affectedRows || 0) };
  },
  async upsertDaily(userId, dateStr, daily) {
    await ensureAttendanceDailySchema();
    const date = String(dateStr).slice(0, 10);
    const incoming = daily && typeof daily === 'object' ? daily : {};
    const existing = await this.getDaily(userId, date);

    let kubun = existing?.kubun ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'kubun')) {
      const k = String(incoming.kubun || '').trim();
      const allowed = new Set(['', '出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日', '休日', '休日出勤', '代替出勤']);
      kubun = allowed.has(k) ? (k || null) : kubun;
    }

    let kubunConfirmed = existing?.kubun_confirmed ?? 0;
    if (Object.prototype.hasOwnProperty.call(incoming, 'kubunConfirmed')) {
      kubunConfirmed = Number(incoming.kubunConfirmed || 0) ? 1 : 0;
    } else if (kubun != null && kubun !== '') {
      // Nếu FE chưa gửi cờ xác nhận nhưng kubun đã có giá trị, mặc định coi là xác nhận
      kubunConfirmed = 1;
    }

    let workType = existing?.work_type ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'workType')) {
      const wt = String(incoming.workType || '').trim();
      workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
    }

    let location = existing?.location ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'location')) {
      location = incoming.location != null ? String(incoming.location).slice(0, 120) : null;
    }

    let reason = existing?.reason ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'reason')) {
      reason = incoming.reason != null ? String(incoming.reason).slice(0, 32) : null;
    }

    let memo = existing?.memo ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'memo')) {
      memo = incoming.memo != null ? String(incoming.memo).slice(0, 255) : null;
    }

    let breakMin = existing?.break_minutes ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'breakMinutes')) {
      breakMin = incoming.breakMinutes == null ? null : Number(incoming.breakMinutes);
    }

    let nightBreakMin = existing?.night_break_minutes ?? null;
    if (Object.prototype.hasOwnProperty.call(incoming, 'nightBreakMinutes')) {
      nightBreakMin = incoming.nightBreakMinutes == null ? null : Number(incoming.nightBreakMinutes);
    }
    const sameValue = (a, b) => {
      if (a == null && b == null) return true;
      return String(a ?? '') === String(b ?? '');
    };
    if (existing) {
      const unchanged =
        sameValue(existing.kubun, kubun) &&
        Number(existing.kubun_confirmed || 0) === Number(kubunConfirmed || 0) &&
        sameValue(existing.work_type, workType) &&
        sameValue(existing.location, location) &&
        sameValue(existing.reason, reason) &&
        sameValue(existing.memo, memo) &&
        String(existing.break_minutes ?? '') === String(breakMin ?? '') &&
        String(existing.night_break_minutes ?? '') === String(nightBreakMin ?? '');
      if (unchanged) return { ok: true, affectedRows: 0 };
    }
    const [res] = await db.query(
      `
        INSERT INTO attendance_daily (userId, date, kubun, kubun_confirmed, work_type, location, reason, memo, break_minutes, night_break_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          kubun = VALUES(kubun),
          kubun_confirmed = VALUES(kubun_confirmed),
          work_type = VALUES(work_type),
          location = VALUES(location),
          reason = VALUES(reason),
          memo = VALUES(memo),
          break_minutes = VALUES(break_minutes),
          night_break_minutes = VALUES(night_break_minutes)
      `,
      [
        userId,
        date,
        kubun,
        kubunConfirmed,
        workType,
        location,
        reason,
        memo,
        Number.isFinite(breakMin) ? breakMin : null,
        Number.isFinite(nightBreakMin) ? nightBreakMin : null
      ]
    );
    return { ok: true, affectedRows: Number(res?.affectedRows || 0) };
  },
  async getDaily(userId, dateStr) {
    await ensureAttendanceDailySchema();
    const [rows] = await db.query(
      `SELECT * FROM attendance_daily WHERE userId = ? AND date = ? LIMIT 1`,
      [userId, String(dateStr).slice(0, 10)]
    );
    return rows && rows[0] ? rows[0] : null;
  },
  async listDailyBetween(userId, fromDate, toDate) {
    await ensureAttendanceDailySchema();
    const sql = `
      SELECT *
      FROM attendance_daily
      WHERE userId = ?
        AND date >= ? AND date <= ?
      ORDER BY date ASC
    `;
    const [rows] = await db.query(sql, [userId, String(fromDate).slice(0, 10), String(toDate).slice(0, 10)]);
    return rows;
  },
  async setWorkTypeForUserDate(userId, dateStr, workType) {
    await ensureAttendanceSchema();
    const set = await getAttendanceColumnSet();
    if (!set.has('work_type')) return { updated: 0 };
    const sql = `
      UPDATE attendance
      SET work_type = ?
      WHERE userId = ?
        AND DATE(checkIn) = ?
      ORDER BY checkIn DESC
      LIMIT 1
    `;
    const [res] = await db.query(sql, [workType || null, userId, String(dateStr).slice(0, 10)]);
    return { updated: Number(res?.affectedRows || 0) };
  },
  async setWorkTypeById(attendanceId, workType) {
    await ensureAttendanceSchema();
    const set = await getAttendanceColumnSet();
    if (!set.has('work_type')) return { updated: 0 };
    const [res] = await db.query(`UPDATE attendance SET work_type = ? WHERE id = ?`, [workType || null, attendanceId]);
    return { updated: Number(res?.affectedRows || 0) };
  },
  async upsertShiftDefinition({ name, start_time, end_time, break_minutes, working_days }) {
    await this.ensureShiftTables();
    const s = String(start_time || '').split(':').map(Number);
    const e = String(end_time || '').split(':').map(Number);
    const std = Math.max(0, (e[0]*60+e[1]) - (s[0]*60+s[1]) - (break_minutes || 0));
    await db.query(`
      INSERT INTO shift_definitions (name, start_time, end_time, break_minutes, standard_minutes, working_days)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), break_minutes = VALUES(break_minutes), standard_minutes = VALUES(standard_minutes), working_days = VALUES(working_days)
    `, [name, start_time, end_time, break_minutes || 0, std, working_days || null]);
    const [rows] = await db.query(`SELECT * FROM shift_definitions WHERE name = ? LIMIT 1`, [name]);
    return rows[0];
  },
  async listShiftDefinitions() {
    await this.ensureShiftTables();
    const [rows] = await db.query(`SELECT * FROM shift_definitions ORDER BY id ASC`);
    return rows;
  },
  async getShiftById(id) {
    await this.ensureShiftTables();
    const [rows] = await db.query(`SELECT * FROM shift_definitions WHERE id = ? LIMIT 1`, [id]);
    return rows[0];
  },
  async assignShiftToUser(userId, shiftId, startDate, endDate) {
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const hasShiftId = set.has('shiftId');
    const hasShiftName = set.has('shift');
    const startCol = getUSAStartCol(set);
    const hasDateCol = set.has('date');
    const hasStartDateCol = set.has('start_date');
    const hasEndDateCol = set.has('end_date');

    let shiftName = null;
    try {
      const def = await this.getShiftById(shiftId);
      shiftName = def?.name ? String(def.name) : null;
    } catch {}

    const cols = ['userId'];
    const vals = [userId];

    if (hasDateCol) {
      cols.push('date');
      vals.push(startDate);
    }
    if (hasStartDateCol) {
      cols.push('start_date');
      vals.push(startDate);
    }
    if (!hasDateCol && !hasStartDateCol) {
      cols.push(startCol);
      vals.push(startDate);
    }
    if (hasEndDateCol) {
      cols.push('end_date');
      vals.push(endDate || null);
    }
    if (hasShiftId) {
      cols.push('shiftId');
      vals.push(shiftId);
    }
    if (hasShiftName) {
      cols.push('shift');
      vals.push(shiftName || null);
    }

    const placeholders = cols.map(() => '?').join(', ');
    const upd = [];
    if (hasShiftId) upd.push(`shiftId = VALUES(shiftId)`);
    if (hasShiftName) upd.push(`shift = VALUES(shift)`);
    if (hasStartDateCol) upd.push(`start_date = VALUES(start_date)`);
    if (hasEndDateCol) upd.push(`end_date = VALUES(end_date)`);
    if (hasDateCol) upd.push(`date = VALUES(date)`);

    const sql = upd.length
      ? `INSERT INTO user_shift_assignments (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${upd.join(', ')}`
      : `INSERT INTO user_shift_assignments (${cols.join(', ')}) VALUES (${placeholders})`;

    try {
      await db.query(sql, vals);
    } catch (e) {
      const msg = String(e?.message || '');
      const needDate = msg.includes("Field 'date'") && hasDateCol === false;
      const needStartDate = msg.includes("Field 'start_date'") && hasStartDateCol === false;
      if (needDate || needStartDate) {
        const cols2 = cols.slice();
        const vals2 = vals.slice();
        const upd2 = upd.slice();
        if (needDate) { cols2.push('date'); vals2.push(startDate); upd2.push(`date = VALUES(date)`); }
        if (needStartDate) { cols2.push('start_date'); vals2.push(startDate); upd2.push(`start_date = VALUES(start_date)`); }
        const placeholders2 = cols2.map(() => '?').join(', ');
        const sql2 = upd2.length
          ? `INSERT INTO user_shift_assignments (${cols2.join(', ')}) VALUES (${placeholders2}) ON DUPLICATE KEY UPDATE ${upd2.join(', ')}`
          : `INSERT INTO user_shift_assignments (${cols2.join(', ')}) VALUES (${placeholders2})`;
        await db.query(sql2, vals2);
      } else {
        throw e;
      }
    }
    return { ok: true };
  },
  async updateShiftAssignment(id, userId, patch) {
    await this.ensureShiftTables();
    const xid = parseInt(String(id), 10);
    const uid = parseInt(String(userId), 10);
    if (!xid || !uid) return { ok: false, updated: 0 };
    const set = await getUSAColumnSet();
    const shiftCol = set.has('shiftId') ? 'shiftId' : (set.has('shift') ? 'shift' : 'shiftId');
    const startCol = getUSAStartCol(set);
    const hasEnd = set.has('end_date');
    const p = patch && typeof patch === 'object' ? patch : {};
    const fields = [];
    const vals = [];
    if (Object.prototype.hasOwnProperty.call(p, 'shiftId')) {
      const v = p.shiftId == null ? null : parseInt(String(p.shiftId), 10);
      fields.push(`${shiftCol} = ?`);
      vals.push(v);
    }
    if (Object.prototype.hasOwnProperty.call(p, 'startDate')) {
      const v = String(p.startDate || '').slice(0, 10);
      fields.push(`${startCol} = ?`);
      vals.push(v);
      if (set.has('date') && startCol !== 'date') { fields.push(`date = ?`); vals.push(v); }
      if (set.has('start_date') && startCol !== 'start_date') { fields.push(`start_date = ?`); vals.push(v); }
    }
    if (hasEnd && Object.prototype.hasOwnProperty.call(p, 'endDate')) {
      const v = p.endDate == null || p.endDate === '' ? null : String(p.endDate).slice(0, 10);
      fields.push(`end_date = ?`);
      vals.push(v);
    }
    if (!fields.length) return { ok: false, updated: 0 };
    vals.push(xid, uid);
    const [res] = await db.query(
      `UPDATE user_shift_assignments SET ${fields.join(', ')} WHERE id = ? AND userId = ?`,
      vals
    );
    return { ok: true, updated: Number(res?.affectedRows || 0) };
  },
  async deleteShiftAssignment(id, userId) {
    await this.ensureShiftTables();
    const xid = parseInt(String(id), 10);
    const uid = parseInt(String(userId), 10);
    if (!xid || !uid) return { ok: false, deleted: 0 };
    const [res] = await db.query(`DELETE FROM user_shift_assignments WHERE id = ? AND userId = ?`, [xid, uid]);
    return { ok: true, deleted: Number(res?.affectedRows || 0) };
  },
  async getActiveAssignment(userId, dateStr) {
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const startCol = getUSAStartCol(set);
    const hasEnd = set.has('end_date');
    const whereEnd = hasEnd ? 'AND (a.end_date IS NULL OR a.end_date >= ?)' : '';
    const orderCol = startCol;
    const sql = `
      SELECT a.*
      FROM user_shift_assignments a
      WHERE a.userId = ? AND a.${startCol} <= ? ${whereEnd}
      ORDER BY a.${orderCol} DESC
      LIMIT 1
    `;
    const params = hasEnd ? [userId, dateStr, dateStr] : [userId, dateStr];
    const [rows] = await db.query(sql, params);
    return rows[0];
  },
  async listShiftAssignmentsBetween(userId, fromDate, toDate) {
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const startCol = getUSAStartCol(set);
    const hasEnd = set.has('end_date');
    const hasShiftId = set.has('shiftId');
    const hasShiftName = set.has('shift');
    const whereEnd = hasEnd ? 'AND (a.end_date IS NULL OR a.end_date >= ?)' : '';
    const sql = `
      SELECT
        a.id,
        a.userId,
        ${hasShiftId ? 'a.shiftId' : 'NULL'} AS shiftId,
        ${hasShiftName ? 'a.shift' : 'NULL'} AS shift,
        a.${startCol} AS start_date,
        ${hasEnd ? 'a.end_date' : 'NULL'} AS end_date
      FROM user_shift_assignments a
      WHERE a.userId = ?
        AND a.${startCol} <= ?
        ${whereEnd}
      ORDER BY a.${startCol} ASC, a.id ASC
    `;
    const params = hasEnd ? [userId, String(toDate).slice(0, 10), String(fromDate).slice(0, 10)] : [userId, String(toDate).slice(0, 10)];
    const [rows] = await db.query(sql, params);
    return rows || [];
  },
  async backfillShiftIdForUserRange(userId, fromDate, toDate) {
    await ensureAttendanceSchema();
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const startCol = getUSAStartCol(set);
    const hasEnd = set.has('end_date');
    const endCond = hasEnd ? 'AND (s.end_date IS NULL OR DATE(a.checkIn) <= s.end_date)' : '';
    const hasShiftName = set.has('shift');
    const joinDef = hasShiftName ? 'LEFT JOIN shift_definitions d ON d.name = s.shift' : '';
    const setExpr = hasShiftName ? 'COALESCE(s.shiftId, d.id)' : 's.shiftId';
    const sql = `
      UPDATE attendance a
      JOIN user_shift_assignments s
        ON s.userId = a.userId
       AND DATE(a.checkIn) >= s.${startCol}
       ${endCond}
      ${joinDef}
      SET a.shiftId = ${setExpr}
      WHERE a.userId = ? 
        AND DATE(a.checkIn) >= ? 
        AND DATE(a.checkIn) <= ?
    `;
    await db.query(sql, [userId, fromDate, toDate]);
    return { ok: true };
  },
  async createCheckIn(userId, time, loc, labels, workType) {
    await ensureAttendanceSchema();
    await this.ensureShiftTables();
    const dateStr = String(time).slice(0, 10);
    const assign = await this.getActiveAssignment(userId, dateStr);
    const set = await getAttendanceColumnSet();
    const cols = ['userId', 'checkIn'];
    const vals = [userId, time];
    let assignedShiftId = assign?.shiftId || null;
    if (!assignedShiftId && assign && Object.prototype.hasOwnProperty.call(assign, 'shift')) {
      const [defs] = await db.query(`SELECT id FROM shift_definitions WHERE name = ? LIMIT 1`, [assign.shift]);
      assignedShiftId = defs && defs[0] ? defs[0].id : null;
    }
    if (set.has('shiftId')) { cols.push('shiftId'); vals.push(assignedShiftId); }
    if (set.has('work_type')) { cols.push('work_type'); vals.push(workType || null); }
    if (set.has('in_latitude')) { cols.push('in_latitude'); vals.push(loc?.latitude ?? null); }
    if (set.has('in_longitude')) { cols.push('in_longitude'); vals.push(loc?.longitude ?? null); }
    if (set.has('in_accuracy')) { cols.push('in_accuracy'); vals.push(loc?.accuracy ?? null); }
    if (set.has('in_locationSource')) { cols.push('in_locationSource'); vals.push(loc?.locationSource ?? null); }
    if (set.has('in_countryCode')) { cols.push('in_countryCode'); vals.push(loc?.countryCode ?? null); }
    if (set.has('in_note')) { cols.push('in_note'); vals.push(loc?.note ?? null); }
    if (set.has('in_deviceId')) { cols.push('in_deviceId'); vals.push(loc?.deviceId ?? null); }
    if (set.has('in_tzOffset')) { cols.push('in_tzOffset'); vals.push(loc?.tzOffset ?? null); }
    if (set.has('labels')) { cols.push('labels'); vals.push(labels || null); }
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`;
    const [result] = await db.query(sql, vals);
    return result.insertId;
  },
  async createCheckInTx(userId, time, loc, labels, workType) {
    await ensureAttendanceSchema();
    await this.ensureShiftTables();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`SELECT id FROM users WHERE id = ? FOR UPDATE`, [userId]);
      const [openRows] = await conn.query(`SELECT id FROM attendance WHERE userId = ? AND checkOut IS NULL AND checkIn >= CURDATE() AND checkIn < DATE_ADD(CURDATE(), INTERVAL 1 DAY) LIMIT 1`, [userId]);
      if (openRows && openRows.length) {
        await conn.rollback();
        return null;
      }
      const dateStr = String(time).slice(0, 10);
      const setUSA = await getUSAColumnSet();
      const startCol = getUSAStartCol(setUSA);
      const hasEnd = setUSA.has('end_date');
      const whereEnd = hasEnd ? 'AND (a.end_date IS NULL OR a.end_date >= ?)' : '';
      const orderCol = startCol;
      const hasShiftName = setUSA.has('shift');
      const sqlAssign = hasShiftName
        ? `
        SELECT COALESCE(a.shiftId, d.id) AS sid
        FROM user_shift_assignments a
        LEFT JOIN shift_definitions d ON d.name = a.shift
        WHERE a.userId = ? AND a.${startCol} <= ? ${whereEnd}
        ORDER BY a.${orderCol} DESC
        LIMIT 1
      `
        : `
        SELECT a.shiftId AS sid
        FROM user_shift_assignments a
        WHERE a.userId = ? AND a.${startCol} <= ? ${whereEnd}
        ORDER BY a.${orderCol} DESC
        LIMIT 1
      `;
      const paramsAssign = hasEnd ? [userId, dateStr, dateStr] : [userId, dateStr];
      const [assignRows] = await conn.query(sqlAssign, paramsAssign);
      const assignedShiftId = assignRows && assignRows[0] ? assignRows[0].sid : null;
      const set = await getAttendanceColumnSet();
      const cols = ['userId', 'checkIn'];
      const vals = [userId, time];
      if (set.has('shiftId')) { cols.push('shiftId'); vals.push(assignedShiftId); }
      if (set.has('work_type')) { cols.push('work_type'); vals.push(workType || null); }
      if (set.has('in_latitude')) { cols.push('in_latitude'); vals.push(loc?.latitude ?? null); }
      if (set.has('in_longitude')) { cols.push('in_longitude'); vals.push(loc?.longitude ?? null); }
      if (set.has('in_accuracy')) { cols.push('in_accuracy'); vals.push(loc?.accuracy ?? null); }
      if (set.has('in_locationSource')) { cols.push('in_locationSource'); vals.push(loc?.locationSource ?? null); }
      if (set.has('in_countryCode')) { cols.push('in_countryCode'); vals.push(loc?.countryCode ?? null); }
      if (set.has('in_note')) { cols.push('in_note'); vals.push(loc?.note ?? null); }
      if (set.has('in_deviceId')) { cols.push('in_deviceId'); vals.push(loc?.deviceId ?? null); }
      if (set.has('in_tzOffset')) { cols.push('in_tzOffset'); vals.push(loc?.tzOffset ?? null); }
      if (set.has('labels')) { cols.push('labels'); vals.push(labels || null); }
      const placeholders = cols.map(() => '?').join(', ');
      const sql = `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`;
      const [result] = await conn.query(sql, vals);
      await conn.commit();
      return result.insertId;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  },
  async getOpenAttendanceForUser(userId) {
    const sql = `SELECT * FROM attendance WHERE userId = ? AND checkOut IS NULL AND checkIn >= CURDATE() AND checkIn < DATE_ADD(CURDATE(), INTERVAL 1 DAY) ORDER BY checkIn DESC LIMIT 1`;
    const [rows] = await db.query(sql, [userId]);
    return rows[0];
  },
  async setCheckOut(attendanceId, time, loc, labels) {
    await ensureAttendanceSchema();
    const set = await getAttendanceColumnSet();
    const updates = ['checkOut = ?'];
    const vals = [time];
    if (set.has('out_latitude')) { updates.push('out_latitude = ?'); vals.push(loc?.latitude ?? null); }
    if (set.has('out_longitude')) { updates.push('out_longitude = ?'); vals.push(loc?.longitude ?? null); }
    if (set.has('out_accuracy')) { updates.push('out_accuracy = ?'); vals.push(loc?.accuracy ?? null); }
    if (set.has('out_locationSource')) { updates.push('out_locationSource = ?'); vals.push(loc?.locationSource ?? null); }
    if (set.has('out_countryCode')) { updates.push('out_countryCode = ?'); vals.push(loc?.countryCode ?? null); }
    if (set.has('out_note')) { updates.push('out_note = ?'); vals.push(loc?.note ?? null); }
    if (set.has('out_deviceId')) { updates.push('out_deviceId = ?'); vals.push(loc?.deviceId ?? null); }
    if (set.has('out_tzOffset')) { updates.push('out_tzOffset = ?'); vals.push(loc?.tzOffset ?? null); }
    if (set.has('labels')) { updates.push('labels = ?'); vals.push(labels || null); }
    const sql = `UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`;
    vals.push(attendanceId);
    await db.query(sql, vals);
  },
  async listByUserBetween(userId, fromDate, toDate) {
    const sql = `
      SELECT * FROM attendance
      WHERE userId = ?
        AND checkIn >= ? AND checkIn <= ?
      ORDER BY checkIn ASC
    `;
    const [rows] = await db.query(sql, [userId, fromDate + ' 00:00:00', toDate + ' 23:59:59']);
    return rows;
  },
  async findCheckInByTime(userId, time) {
    const sql = `SELECT id FROM attendance WHERE userId = ? AND checkIn = ? LIMIT 1`;
    const [rows] = await db.query(sql, [userId, time]);
    return rows[0];
  },
  async findCheckOutByTime(userId, time) {
    const sql = `SELECT id FROM attendance WHERE userId = ? AND checkOut = ? LIMIT 1`;
    const [rows] = await db.query(sql, [userId, time]);
    return rows[0];
  },
  async getById(attendanceId) {
    const [rows] = await db.query(`SELECT * FROM attendance WHERE id = ? LIMIT 1`, [attendanceId]);
    return rows[0];
  },
  async updateTimes(attendanceId, checkIn, checkOut) {
    const inV = checkIn ? String(checkIn) : '';
    const outV = checkOut ? String(checkOut) : '';
    if (!inV && !outV) return;
    if (!inV && outV) {
      throw new Error('Missing checkIn');
    }
    const sql = `
      UPDATE attendance
      SET checkIn = ?,
          checkOut = ?
      WHERE id = ?
    `;
    await db.query(sql, [inV, outV || null, attendanceId]);
  },
  async getMonthSummary(userId, year, month) {
    await ensureAttendanceMonthSummarySchema();
    const uid = parseInt(String(userId), 10);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (!uid || !y || !m) return null;
    const [rows] = await db.query(
      `SELECT * FROM attendance_month_summary WHERE userId = ? AND year = ? AND month = ? LIMIT 1`,
      [uid, y, m]
    );
    return rows && rows[0] ? rows[0] : null;
  },
  async upsertMonthSummary(userId, year, month, summaryAll, summaryInhouse, actorId) {
    await ensureAttendanceMonthSummarySchema();
    const uid = parseInt(String(userId), 10);
    const y = parseInt(String(year), 10);
    const m = parseInt(String(month), 10);
    if (!uid || !y || !m) return { ok: false };
    const allStr = summaryAll == null ? null : JSON.stringify(summaryAll);
    const ihStr = summaryInhouse == null ? null : JSON.stringify(summaryInhouse);
    const actor = actorId != null ? parseInt(String(actorId), 10) : null;
    const [res] = await db.query(
      `
        INSERT INTO attendance_month_summary (userId, year, month, summary_all, summary_inhouse, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          summary_all = VALUES(summary_all),
          summary_inhouse = VALUES(summary_inhouse),
          updated_by = VALUES(updated_by)
      `,
      [uid, y, m, allStr, ihStr, actor]
    );
    return { ok: true, affectedRows: Number(res?.affectedRows || 0) };
  },
  async ensureWorkDetailsSchemaPublic() {
    await ensureWorkDetailsSchema();
    return { ok: true };
  },
  async listWorkDetailsBetween(userId, fromDate, toDate) {
    await ensureWorkDetailsSchema();
    const uid = parseInt(String(userId), 10);
    const from = String(fromDate || '').slice(0, 10);
    const to = String(toDate || '').slice(0, 10);
    if (!uid) return [];
    const whereFromTo = (from && to) ? `AND d.start_date <= ? AND (d.end_date IS NULL OR d.end_date >= ?)` : '';
    const params = [uid];
    if (from && to) { params.push(to, from); }
    const [rows] = await db.query(`
      SELECT *
      FROM user_work_details d
      WHERE d.userId = ?
      ${whereFromTo}
      ORDER BY d.start_date ASC, d.id ASC
    `, params);
    return rows || [];
  },
  async getWorkDetailById(id) {
    await ensureWorkDetailsSchema();
    const xid = parseInt(String(id), 10);
    if (!xid) return null;
    const [rows] = await db.query(`SELECT * FROM user_work_details WHERE id = ? LIMIT 1`, [xid]);
    return rows && rows[0] ? rows[0] : null;
  },
  async createWorkDetail(userId, data) {
    await ensureWorkDetailsSchema();
    const uid = parseInt(String(userId), 10);
    if (!uid) return null;
    const d = data && typeof data === 'object' ? data : {};
    const startDate = String(d.startDate || d.start_date || '').slice(0, 10);
    const endDate = d.endDate == null || d.endDate === '' ? null : String(d.endDate).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const company = d.companyName != null ? String(d.companyName).slice(0, 120) : null;
    const addr = d.workPlaceAddress != null ? String(d.workPlaceAddress).slice(0, 255) : null;
    const content = d.workContent != null ? String(d.workContent).slice(0, 255) : null;
    const roleTitle = d.roleTitle != null ? String(d.roleTitle).slice(0, 80) : null;
    const resp = d.responsibilityLevel != null ? String(d.responsibilityLevel).slice(0, 80) : null;
    const [res] = await db.query(`
      INSERT INTO user_work_details (userId, start_date, end_date, company_name, work_place_address, work_content, role_title, responsibility_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [uid, startDate, endDate, company, addr, content, roleTitle, resp]);
    return res?.insertId || null;
  },
  async updateWorkDetail(id, userId, data) {
    await ensureWorkDetailsSchema();
    const xid = parseInt(String(id), 10);
    const uid = parseInt(String(userId), 10);
    if (!xid || !uid) return { ok: false, updated: 0 };
    const d = data && typeof data === 'object' ? data : {};
    const fields = [];
    const vals = [];
    if (Object.prototype.hasOwnProperty.call(d, 'startDate') || Object.prototype.hasOwnProperty.call(d, 'start_date')) {
      fields.push(`start_date = ?`);
      vals.push(String(d.startDate || d.start_date).slice(0, 10));
    }
    if (Object.prototype.hasOwnProperty.call(d, 'endDate') || Object.prototype.hasOwnProperty.call(d, 'end_date')) {
      fields.push(`end_date = ?`);
      vals.push(d.endDate == null || d.endDate === '' ? null : String(d.endDate).slice(0, 10));
    }
    if (Object.prototype.hasOwnProperty.call(d, 'companyName')) { fields.push(`company_name = ?`); vals.push(d.companyName); }
    if (Object.prototype.hasOwnProperty.call(d, 'workPlaceAddress')) { fields.push(`work_place_address = ?`); vals.push(d.workPlaceAddress); }
    if (Object.prototype.hasOwnProperty.call(d, 'workContent')) { fields.push(`work_content = ?`); vals.push(d.workContent); }
    if (Object.prototype.hasOwnProperty.call(d, 'roleTitle')) { fields.push(`role_title = ?`); vals.push(d.roleTitle); }
    if (Object.prototype.hasOwnProperty.call(d, 'responsibilityLevel')) { fields.push(`responsibility_level = ?`); vals.push(d.responsibilityLevel); }
    if (!fields.length) return { ok: true, updated: 0 };
    vals.push(xid, uid);
    const [res] = await db.query(`UPDATE user_work_details SET ${fields.join(', ')} WHERE id = ? AND userId = ?`, vals);
    return { ok: true, updated: res?.affectedRows || 0 };
  },

  /**
   * TRANSACTIONAL BULK UPSERT (Ưu tiên 1)
   * Xử lý cả attendance_daily và attendance segments trong 1 transaction.
   */
  async bulkUpsertAttendance(userId, { updates, dailyUpdates }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      let dailySaved = 0;
      let segCreated = 0;
      let segUpdated = 0;
      const createdIds = [];

      // 1. Xử lý dailyUpdates
      if (Array.isArray(dailyUpdates)) {
        for (const d of dailyUpdates) {
          const date = String(d?.date || '').slice(0, 10);
          if (!date) continue;

          // Reuse logic upsertDaily nhưng dùng connection của transaction
          await conn.query(
            `
            INSERT INTO attendance_daily (userId, date, kubun, kubun_confirmed, work_type, location, reason, memo, break_minutes, night_break_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              kubun = VALUES(kubun),
              kubun_confirmed = VALUES(kubun_confirmed),
              work_type = VALUES(work_type),
              location = VALUES(location),
              reason = VALUES(reason),
              memo = VALUES(memo),
              break_minutes = VALUES(break_minutes),
              night_break_minutes = VALUES(night_break_minutes)
          `,
            [
              userId,
              date,
              d.kubun || null,
              d.kubunConfirmed ? 1 : 0,
              d.workType || null,
              d.location || null,
              d.reason || null,
              d.memo || null,
              d.breakMinutes || null,
              d.nightBreakMinutes || null
            ]
          );
          dailySaved++;
        }
      }

      // 2. Xử lý updates (segments)
      if (Array.isArray(updates)) {
        for (const u of updates) {
          if (u.id) {
            if (u.delete === true) {
              await conn.query(`DELETE FROM attendance WHERE id = ? AND userId = ?`, [u.id, userId]);
              segUpdated++;
              continue;
            }
            // Update existing segment
            const fields = ['checkIn = ?', 'checkOut = ?', 'work_type = ?'];
            const vals = [u.checkIn || null, u.checkOut || null, u.workType || null, u.id, userId];
            await conn.query(`UPDATE attendance SET ${fields.join(', ')} WHERE id = ? AND userId = ?`, vals);
            segUpdated++;
          } else if (u.checkIn) {
            // Create or Update new segment (Handle Double Submit race condition)
            try {
              // Thử chèn mới trước
              const [res] = await conn.query(
                `INSERT INTO attendance (userId, checkIn, checkOut, work_type) VALUES (?, ?, ?, ?)`,
                [userId, u.checkIn, u.checkOut || null, u.workType || null]
              );
              segCreated++;
              if (u.clientId) {
                createdIds.push({ clientId: u.clientId, id: res.insertId, checkIn: u.checkIn, checkOut: u.checkOut || null });
              }
            } catch (err) {
              if (err.code === 'ER_DUP_ENTRY') {
                // Nếu trùng (Double Submit), chúng ta CẬP NHẬT lại dữ liệu mới nhất (Ưu tiên 1)
                // Điều này cực kỳ quan trọng khi người dùng sửa giờ nhanh trước khi nhận được ID
                await conn.query(
                  `UPDATE attendance SET checkOut = ?, work_type = ? WHERE userId = ? AND checkIn = ?`,
                  [u.checkOut || null, u.workType || null, userId, u.checkIn]
                );
                
                const [existing] = await conn.query(
                  `SELECT id FROM attendance WHERE userId = ? AND checkIn = ?`,
                  [userId, u.checkIn]
                );
                if (existing && existing[0]) {
                  createdIds.push({ clientId: u.clientId, id: existing[0].id, checkIn: u.checkIn, checkOut: u.checkOut || null });
                  segUpdated++;
                }
                continue;
              }
              throw err;
            }
          }
        }
      }

      await conn.commit();
      return { 
        ok: true, 
        saved: { daily: dailySaved, segmentsCreated: segCreated, segmentsUpdated: segUpdated },
        created: createdIds
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
  async deleteWorkDetail(id, userId) {
    await ensureWorkDetailsSchema();
    const xid = parseInt(String(id), 10);
    const uid = parseInt(String(userId), 10);
    if (!xid || !uid) return { ok: false, deleted: 0 };
    const [res] = await db.query(`DELETE FROM user_work_details WHERE id = ? AND userId = ?`, [xid, uid]);
    return { ok: true, deleted: Number(res?.affectedRows || 0) };
  },
  async ensureAttendanceSchemaPublic() {
    await ensureAttendanceSchema();
    return listColumns();
  },
  async listColumns() {
    return listColumns();
  }
};
