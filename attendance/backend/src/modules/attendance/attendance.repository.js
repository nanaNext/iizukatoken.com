const db = require('../../core/database/mysql');
async function ensureAttendanceSchema() {
  try {
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
    if (alters.length) {
      await db.query(`ALTER TABLE attendance ${alters.join(', ')}`);
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
    return new Set();
  }
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
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
      if (!set.has('start_date')) alters.push(`ADD COLUMN start_date DATE NOT NULL`);
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
        try { await db.query(`ALTER TABLE user_shift_assignments ADD INDEX idx_user_date (userId, start_date, end_date)`); } catch {}
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
        { name: 'day_8_17', s: '08:00', e: '17:00', b: 60 },
        { name: 'day_9_17', s: '09:00', e: '17:00', b: 60 },
        { name: 'part_9_14', s: '09:00', e: '14:00', b: 0 }
      ];
      for (const d of defs) {
        const start = d.s.split(':').map(Number);
        const end = d.e.split(':').map(Number);
        const std = Math.max(0, (end[0]*60+end[1]) - (start[0]*60+start[1]) - d.b);
        await db.query(`
          INSERT INTO shift_definitions (name, start_time, end_time, break_minutes, standard_minutes)
          VALUES (?, ?, ?, ?, ?)
        `, [d.name, d.s, d.e, d.b, std]);
      }
    }
  },
  async upsertShiftDefinition({ name, start_time, end_time, break_minutes }) {
    await this.ensureShiftTables();
    const s = String(start_time || '').split(':').map(Number);
    const e = String(end_time || '').split(':').map(Number);
    const std = Math.max(0, (e[0]*60+e[1]) - (s[0]*60+s[1]) - (break_minutes || 0));
    await db.query(`
      INSERT INTO shift_definitions (name, start_time, end_time, break_minutes, standard_minutes)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), break_minutes = VALUES(break_minutes), standard_minutes = VALUES(standard_minutes)
    `, [name, start_time, end_time, break_minutes || 0, std]);
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
    const shiftCol = set.has('shiftId') ? 'shiftId' : (set.has('shift') ? 'shift' : 'shiftId');
    const startCol = set.has('start_date') ? 'start_date' : (set.has('date') ? 'date' : 'start_date');
    const cols = ['userId', shiftCol, startCol];
    const vals = [userId, shiftId, startDate];
    if (set.has('end_date')) {
      cols.push('end_date');
      vals.push(endDate || null);
    }
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO user_shift_assignments (${cols.join(', ')}) VALUES (${placeholders})`;
    await db.query(sql, vals);
    return { ok: true };
  },
  async getActiveAssignment(userId, dateStr) {
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const startCol = set.has('start_date') ? 'start_date' : (set.has('date') ? 'date' : 'start_date');
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
  async backfillShiftIdForUserRange(userId, fromDate, toDate) {
    await ensureAttendanceSchema();
    await this.ensureShiftTables();
    const set = await getUSAColumnSet();
    const startCol = set.has('start_date') ? 'start_date' : (set.has('date') ? 'date' : 'start_date');
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
  async createCheckIn(userId, time, loc, labels) {
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
    const sql = `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders})`;
    const [result] = await db.query(sql, vals);
    return result.insertId;
  },
  async createCheckInTx(userId, time, loc, labels) {
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
      const startCol = setUSA.has('start_date') ? 'start_date' : (setUSA.has('date') ? 'date' : 'start_date');
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
      const sql = `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders})`;
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
        AND checkIn >= ? AND checkOut IS NOT NULL AND checkOut <= ?
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
  async updateTimes(attendanceId, checkIn, checkOut) {
    const sql = `
      UPDATE attendance
      SET checkIn = COALESCE(?, checkIn),
          checkOut = COALESCE(?, checkOut)
      WHERE id = ?
    `;
    await db.query(sql, [checkIn || null, checkOut || null, attendanceId]);
  },
  async ensureAttendanceSchemaPublic() {
    await ensureAttendanceSchema();
    return listColumns();
  },
  async listColumns() {
    return listColumns();
  }
};
