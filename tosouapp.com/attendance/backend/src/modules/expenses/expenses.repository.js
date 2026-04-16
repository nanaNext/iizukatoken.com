const db = require('../../core/database/mysql');
module.exports = {
  async create({ userId, date, origin, via, destination, amount, memo, type, purpose, teiki, receiptUrl, km, category, tripType, tripCount, unitPricePerKm, commuterPass, clientToken }) {
    const sql = `
      INSERT IGNORE INTO expense_claims (userId, date, origin, via, destination, amount, memo, type, purpose, teiki_flag, receipt_url, distance_km, unit_price_per_km, trip_type, trip_count, category, status, approver_id, approved_at, commuter_pass, client_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
    `;
    const [res] = await db.query(sql, [
      userId,
      date,
      origin || null,
      via || null,
      destination || null,
      amount || 0,
      memo || null,
      type || null,
      purpose || null,
      teiki ? 1 : 0,
      receiptUrl || null,
      km == null ? null : Number(km),
      unitPricePerKm == null ? null : Number(unitPricePerKm),
      tripType || null,
      tripCount == null ? 1 : Number(tripCount),
      category || null,
      commuterPass ? 1 : 0,
      clientToken || null
    ]);
    if (res.insertId && res.insertId > 0) return res.insertId;
    if (clientToken) {
      const [rows] = await db.query(`SELECT id FROM expense_claims WHERE client_token = ? LIMIT 1`, [clientToken]);
      const r = rows && rows[0] ? rows[0] : null;
      if (r && r.id) return r.id;
    }
    const [rows] = await db.query(
      `SELECT id FROM expense_claims WHERE userId = ? AND date = ? AND origin <=> ? AND via <=> ? AND destination <=> ? AND amount = ? ORDER BY id DESC LIMIT 1`,
      [userId, date, origin || null, via || null, destination || null, amount || 0]
    );
    return (rows && rows[0] && rows[0].id) ? rows[0].id : 0;
  },
  async listMine(userId, month) {
    if (month && /^\d{4}-\d{2}$/.test(String(month))) {
      const [rows] = await db.query(
        `SELECT * FROM expense_claims WHERE userId = ? AND DATE_FORMAT(date,'%Y-%m') = ? ORDER BY date DESC, created_at DESC`,
        [userId, String(month)]
      );
      return rows;
    }
    const [rows] = await db.query(
      `SELECT * FROM expense_claims WHERE userId = ? ORDER BY date DESC, created_at DESC`,
      [userId]
    );
    return rows;
  },
  async listMineAdvanced({ userId, month, status, type }) {
    const where = [`userId = ?`];
    const args = [userId];
    if (month && /^\d{4}-\d{2}$/.test(String(month))) { where.push(`DATE_FORMAT(date,'%Y-%m') = ?`); args.push(String(month)); }
    if (status) {
      const st = String(status).toLowerCase();
      const map = { '未申請':'draft', '申請中':'applied', '承認済み':'approved', '差戻し':'rejected', 'pending':'draft' };
      const st2 = map[status] || st;
      where.push(`status = ?`); args.push(st2);
    }
    if (type) {
      where.push(`category = ?`); args.push(String(type).toLowerCase());
    }
    const sql = `SELECT ec.*, 
      (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = COALESCE(ec.approver_id, ec.approved_by)) AS approver_name,
      (SELECT ef.file_path FROM expense_files ef WHERE ef.expense_id = ec.id ORDER BY ef.id ASC LIMIT 1) AS first_file_path,
      (SELECT COUNT(*) FROM expense_files ef WHERE ef.expense_id = ec.id) AS file_count
      FROM expense_claims ec WHERE ${where.join(' AND ')} ORDER BY ec.date DESC, ec.created_at DESC`;
    const [rows] = await db.query(sql, args);
    return rows;
  },
  async getById(id) {
    const [rows] = await db.query(`SELECT * FROM expense_claims WHERE id = ?`, [id]);
    return rows[0] || null;
  },
  async listAll(month) {
    if (month && /^\d{4}-\d{2}$/.test(String(month))) {
      const [rows] = await db.query(
        `SELECT ec.*, 
          (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = COALESCE(ec.approver_id, ec.approved_by)) AS approver_name,
          (SELECT ef.file_path FROM expense_files ef WHERE ef.expense_id = ec.id ORDER BY ef.id ASC LIMIT 1) AS first_file_path,
          (SELECT COUNT(*) FROM expense_files ef WHERE ef.expense_id = ec.id) AS file_count
         FROM expense_claims ec WHERE DATE_FORMAT(ec.date,'%Y-%m') = ? ORDER BY ec.date DESC, ec.created_at DESC`,
        [String(month)]
      );
      return rows;
    }
    const [rows] = await db.query(
      `SELECT ec.*, 
        (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = COALESCE(ec.approver_id, ec.approved_by)) AS approver_name,
        (SELECT ef.file_path FROM expense_files ef WHERE ef.expense_id = ec.id ORDER BY ef.id ASC LIMIT 1) AS first_file_path,
        (SELECT COUNT(*) FROM expense_files ef WHERE ef.expense_id = ec.id) AS file_count
       FROM expense_claims ec ORDER BY ec.date DESC, ec.created_at DESC`
    );
    return rows;
  },
  async updateStatus(id, status, note, managerId) {
    const st = String(status || '').toLowerCase();
    if (!['draft','pending','applied','approved','rejected'].includes(st)) throw new Error('Invalid status');
    const sql = `
      UPDATE expense_claims
      SET
        status = ?,
        manager_note = ?,
        approved_by = CASE WHEN ? IN ('approved','rejected') THEN ? ELSE approved_by END,
        approver_id = CASE WHEN ? IN ('approved','rejected') THEN ? ELSE approver_id END,
        applied_at = CASE WHEN ? = 'applied' THEN CURRENT_TIMESTAMP ELSE applied_at END,
        approved_at = CASE WHEN ? IN ('approved','rejected') THEN CURRENT_TIMESTAMP ELSE approved_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [res] = await db.query(sql, [st, note || null, st, managerId || null, st, managerId || null, st, st, id]);
    return res.affectedRows > 0;
  },
  async setEmployeeReplyAndApply(id, userId, note) {
    const [rows] = await db.query(`SELECT id, userId FROM expense_claims WHERE id = ?`, [id]);
    const r = rows && rows[0] ? rows[0] : null;
    if (!r || String(r.userId) !== String(userId)) return false;
    const sql = `
      UPDATE expense_claims
      SET employee_note = ?, reply_at = CURRENT_TIMESTAMP, status = 'applied', applied_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [res] = await db.query(sql, [note || null, id]);
    return res.affectedRows > 0;
  },
  async addFiles(id, files) {
    if (!Array.isArray(files) || !files.length) return [];
    const rows = [];
    for (const f of files) {
      const [res] = await db.query(
        `INSERT INTO expense_files (expense_id, file_path, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)`,
        [id, f.path, f.originalName || null, f.mimeType || null, Number(f.size || 0)]
      );
      rows.push({ id: res.insertId, path: f.path });
    }
    return rows;
  },
  async listFiles(id) {
    const [rows] = await db.query(`SELECT id, file_path AS path, original_name AS name, mime_type AS mime, size FROM expense_files WHERE expense_id = ? ORDER BY id ASC`, [id]);
    return rows || [];
  },
  async deleteFile(fileId, userId) {
    const [rows] = await db.query(`SELECT ef.*, ec.userId FROM expense_files ef JOIN expense_claims ec ON ec.id = ef.expense_id WHERE ef.id = ?`, [fileId]);
    const r = rows && rows[0] ? rows[0] : null;
    if (!r) return { ok:false, path:null };
    if (String(r.userId) !== String(userId)) return { ok:false, path:null };
    const p = r.file_path || null;
    const [res] = await db.query(`DELETE FROM expense_files WHERE id = ?`, [fileId]);
    return { ok: res.affectedRows > 0, path: p };
  },
  async deleteMine(id) {
    const [res] = await db.query(`DELETE FROM expense_claims WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }
};
module.exports.updateMine = async function(id, userId, payload) {
  const [rows] = await db.query(`SELECT * FROM expense_claims WHERE id = ?`, [id]);
  const r = rows && rows[0] ? rows[0] : null;
  if (!r || String(r.userId) !== String(userId)) return false;
  const f = payload || {};
  const origin = f.origin ?? r.origin;
  const via = f.via ?? r.via;
  const destination = f.destination ?? r.destination;
  const memo = f.memo ?? r.memo;
  const type = f.type ?? r.type;
  const purpose = f.purpose ?? r.purpose;
  const teiki = f.teiki_flag != null ? (f.teiki_flag ? 1 : 0) : r.teiki_flag;
  const distance_km = f.distance_km != null ? Number(f.distance_km) : r.distance_km;
  const unit_price_per_km = f.unit_price_per_km != null ? Number(f.unit_price_per_km) : r.unit_price_per_km;
  const trip_type = f.trip_type ?? r.trip_type;
  const trip_count = f.trip_count != null ? Number(f.trip_count) : r.trip_count;
  const category = f.category ?? r.category;
  const commuter_pass = f.commuter_pass != null ? (f.commuter_pass ? 1 : 0) : r.commuter_pass;
  const date = f.date ?? r.date;
  let amount = f.amount != null ? Number(f.amount) : r.amount;
  if (String(category || '').toLowerCase() === 'private_car') {
    const base = (distance_km || 0) * (unit_price_per_km || 0);
    const rt = String(trip_type || '').toLowerCase() === 'round_trip' ? 2 : 1;
    const cnt = trip_count || 1;
    amount = Math.round(base * rt * cnt);
  }
  const sql = `
    UPDATE expense_claims
    SET origin = ?, via = ?, destination = ?, memo = ?, type = ?, purpose = ?, teiki_flag = ?, distance_km = ?, unit_price_per_km = ?, trip_type = ?, trip_count = ?, category = ?, commuter_pass = ?, date = ?, amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const [res] = await db.query(sql, [origin || null, via || null, destination || null, memo || null, type || null, purpose || null, teiki, distance_km == null ? null : distance_km, unit_price_per_km == null ? null : unit_price_per_km, trip_type || null, trip_count || 1, category || null, commuter_pass, date, amount || 0, id]);
  return res.affectedRows > 0;
};
module.exports.updateByAdmin = async function(id, payload) {
  const [rows] = await db.query(`SELECT * FROM expense_claims WHERE id = ?`, [id]);
  const r = rows && rows[0] ? rows[0] : null;
  if (!r) return false;
  const f = payload || {};
  const origin = f.origin ?? r.origin;
  const via = f.via ?? r.via;
  const destination = f.destination ?? r.destination;
  const memo = f.memo ?? r.memo;
  const type = f.type ?? r.type;
  const purpose = f.purpose ?? r.purpose;
  const teiki = f.teiki_flag != null ? (f.teiki_flag ? 1 : 0) : r.teiki_flag;
  const distance_km = f.distance_km != null ? Number(f.distance_km) : r.distance_km;
  const unit_price_per_km = f.unit_price_per_km != null ? Number(f.unit_price_per_km) : r.unit_price_per_km;
  const trip_type = f.trip_type ?? r.trip_type;
  const trip_count = f.trip_count != null ? Number(f.trip_count) : r.trip_count;
  const category = f.category ?? r.category;
  const commuter_pass = f.commuter_pass != null ? (f.commuter_pass ? 1 : 0) : r.commuter_pass;
  const date = f.date ?? r.date;
  let amount = f.amount != null ? Number(f.amount) : r.amount;
  if (String(category || '').toLowerCase() === 'private_car') {
    const base = (distance_km || 0) * (unit_price_per_km || 0);
    const rt = String(trip_type || '').toLowerCase() === 'round_trip' ? 2 : 1;
    const cnt = trip_count || 1;
    amount = Math.round(base * rt * cnt);
  }
  const sql = `
    UPDATE expense_claims
    SET origin = ?, via = ?, destination = ?, memo = ?, type = ?, purpose = ?, teiki_flag = ?, distance_km = ?, unit_price_per_km = ?, trip_type = ?, trip_count = ?, category = ?, commuter_pass = ?, date = ?, amount = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const [res] = await db.query(sql, [origin || null, via || null, destination || null, memo || null, type || null, purpose || null, teiki, distance_km == null ? null : distance_km, unit_price_per_km == null ? null : unit_price_per_km, trip_type || null, trip_count || 1, category || null, commuter_pass, date, amount || 0, id]);
  return res.affectedRows > 0;
};
module.exports.ensureTable = async function() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expense_claims (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      date DATE NOT NULL,
      origin VARCHAR(255) NULL,
      via VARCHAR(255) NULL,
      destination VARCHAR(255) NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      memo VARCHAR(255) NULL,
      type VARCHAR(16) NULL,
      purpose VARCHAR(255) NULL,
      teiki_flag TINYINT(1) NOT NULL DEFAULT 0,
      receipt_url VARCHAR(255) NULL,
      distance_km DECIMAL(10,2) NULL,
      unit_price_per_km DECIMAL(12,2) NULL,
      trip_type VARCHAR(16) NULL,
      trip_count INT NOT NULL DEFAULT 1,
      category VARCHAR(32) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      manager_note VARCHAR(255) NULL,
      approved_by BIGINT UNSIGNED NULL,
      approver_id BIGINT UNSIGNED NULL,
      approved_at DATETIME NULL,
      applied_at DATETIME NULL,
      employee_note VARCHAR(255) NULL,
      reply_at DATETIME NULL,
      commuter_pass TINYINT(1) NOT NULL DEFAULT 0,
      client_token VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_userId (userId),
      INDEX idx_date (date),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN type VARCHAR(16) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN purpose VARCHAR(255) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN teiki_flag TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN receipt_url VARCHAR(255) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN distance_km DECIMAL(10,2) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN unit_price_per_km DECIMAL(12,2) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN trip_type VARCHAR(16) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN trip_count INT NOT NULL DEFAULT 1`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN category VARCHAR(32) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'pending'`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN manager_note VARCHAR(255) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN approved_by BIGINT UNSIGNED NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN approver_id BIGINT UNSIGNED NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN approved_at DATETIME NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN applied_at DATETIME NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN via VARCHAR(255) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN commuter_pass TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN client_token VARCHAR(64) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN employee_note VARCHAR(255) NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD COLUMN reply_at DATETIME NULL`); } catch {}
  try { await db.query(`ALTER TABLE expense_claims ADD UNIQUE KEY uniq_client_token (client_token)`); } catch {}
  try { await db.query(`CREATE INDEX idx_status ON expense_claims (status)`); } catch {}
  await db.query(`
    CREATE TABLE IF NOT EXISTS expense_files (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      expense_id BIGINT UNSIGNED NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NULL,
      mime_type VARCHAR(128) NULL,
      size INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
      INDEX idx_expense_id (expense_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS expense_months (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      userId BIGINT UNSIGNED NOT NULL,
      month CHAR(7) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      is_active TINYINT(1) NOT NULL DEFAULT 0,
      applied_at DATETIME NULL,
      approved_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_user_month (userId, month),
      INDEX idx_user_active (userId, is_active),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS expense_messages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      expense_id BIGINT UNSIGNED NOT NULL,
      sender_user_id BIGINT UNSIGNED NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (expense_id) REFERENCES expense_claims(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_expense_id (expense_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};
module.exports.getActiveMonth = async function(userId) {
  const [rows] = await db.query(`SELECT * FROM expense_months WHERE userId = ? AND is_active = 1 LIMIT 1`, [userId]);
  return rows && rows[0] ? rows[0] : null;
};
module.exports.startMonth = async function(userId, month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) throw new Error('Invalid month');
  await db.query(`UPDATE expense_months SET is_active = 0 WHERE userId = ?`, [userId]);
  await db.query(`
    INSERT INTO expense_months (userId, month, status, is_active)
    VALUES (?, ?, 'draft', 1)
    ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP
  `, [userId, String(month)]);
  const [rows] = await db.query(`SELECT * FROM expense_months WHERE userId = ? AND month = ? LIMIT 1`, [userId, String(month)]);
  return rows && rows[0] ? rows[0] : null;
};
module.exports.getLatestAppliedMonthStats = async function(userId) {
  const [rows] = await db.query(`
    SELECT DATE_FORMAT(date,'%Y-%m') AS month, COUNT(*) AS cnt, MAX(applied_at) AS last_applied
    FROM expense_claims
    WHERE userId = ? AND status = 'applied'
    GROUP BY DATE_FORMAT(date,'%Y-%m')
    ORDER BY last_applied DESC
    LIMIT 1
  `, [userId]);
  const r = rows && rows[0] ? rows[0] : null;
  return r ? { month: r.month, count: Number(r.cnt || 0) } : null;
};
module.exports.addMessage = async function({ expenseId, userId, message }) {
  const [res] = await db.query(
    `INSERT INTO expense_messages (expense_id, sender_user_id, message) VALUES (?, ?, ?)`,
    [expenseId, userId, String(message)]
  );
  return res.insertId || 0;
};
module.exports.listMessages = async function(expenseId) {
  const [rows] = await db.query(
    `SELECT em.id, em.expense_id, em.sender_user_id, em.message, em.created_at,
            (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = em.sender_user_id) AS sender_name
     FROM expense_messages em
     WHERE em.expense_id = ?
     ORDER BY em.created_at ASC, em.id ASC`,
    [expenseId]
  );
  return rows || [];
};
module.exports.listRecentMessagesForAdmin = async function(month) {
  if (month && /^\d{4}-\d{2}$/.test(String(month))) {
    const [rows] = await db.query(
      `SELECT em.id, em.expense_id, em.sender_user_id, em.message, em.created_at,
              ec.userId AS employee_id,
              (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = em.sender_user_id) AS sender_name,
              (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = ec.userId) AS employee_name,
              ec.date, ec.origin, ec.via, ec.destination, ec.purpose, ec.memo, ec.manager_note, ec.status
       FROM expense_messages em
       JOIN expense_claims ec ON ec.id = em.expense_id
       WHERE DATE_FORMAT(ec.date,'%Y-%m') = ?
       ORDER BY em.created_at DESC
       LIMIT 50`,
      [String(month)]
    );
    return rows || [];
  }
  const [rows] = await db.query(
    `SELECT em.id, em.expense_id, em.sender_user_id, em.message, em.created_at,
            ec.userId AS employee_id,
            (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = em.sender_user_id) AS sender_name,
            (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = ec.userId) AS employee_name,
            ec.date, ec.origin, ec.via, ec.destination, ec.purpose, ec.memo, ec.manager_note, ec.status
     FROM expense_messages em
     JOIN expense_claims ec ON ec.id = em.expense_id
     ORDER BY em.created_at DESC
     LIMIT 50`
  );
  return rows || [];
};
module.exports.listRecentMessagesForUser = async function(userId, month) {
  const args = [userId];
  let whereMonth = '';
  if (month && /^\d{4}-\d{2}$/.test(String(month))) { whereMonth = ' AND DATE_FORMAT(ec.date,\'%Y-%m\') = ? '; args.push(String(month)); }
  const [rows] = await db.query(
    `SELECT em.id, em.expense_id, em.sender_user_id, em.message, em.created_at,
            (SELECT COALESCE(u.username, u.email) FROM users u WHERE u.id = em.sender_user_id) AS sender_name,
            ec.date, ec.origin, ec.via, ec.destination, ec.purpose, ec.manager_note
     FROM expense_messages em
     JOIN expense_claims ec ON ec.id = em.expense_id
     WHERE ec.userId = ? ${whereMonth}
     ORDER BY em.created_at DESC
     LIMIT 20`,
    args
  );
  return rows || [];
};
