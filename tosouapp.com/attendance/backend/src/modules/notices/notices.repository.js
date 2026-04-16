const db = require('../../core/database/mysql');

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));

async function ensureNoticeReadsSchema() {
  await db.query(`
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

async function ensureNoticesSchema() {
  await db.query(`
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
  try { await db.query(`ALTER TABLE notices ADD COLUMN target_user_id BIGINT UNSIGNED NULL`); } catch {}
  try { await db.query(`CREATE INDEX idx_target_user_id ON notices (target_user_id)`); } catch {}
  try {
    const [cols] = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'notices'
    `);
    const set = new Set((cols || []).map(c => String(c.column_name)));
    const alters = [];
    if (!set.has('target_user_id')) alters.push(`ADD COLUMN target_user_id BIGINT UNSIGNED NULL`);
    if (!set.has('target_date')) alters.push(`ADD COLUMN target_date DATE NULL`);
    if (!set.has('target_month')) alters.push(`ADD COLUMN target_month CHAR(7) NULL`);
    if (!set.has('message')) alters.push(`ADD COLUMN message TEXT NOT NULL`);
    if (!set.has('created_by')) alters.push(`ADD COLUMN created_by BIGINT UNSIGNED NULL`);
    if (!set.has('created_at')) alters.push(`ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    if (alters.length) {
      try { await db.query(`ALTER TABLE notices ${alters.join(', ')}`); } catch {}
    }
  } catch {}
}

module.exports = {
  ensureNoticesSchema,
  ensureNoticeReadsSchema,
  async createNotice({ targetUserId, targetDate, targetMonth, message, createdBy }) {
    await ensureNoticesSchema();
    const tu = Number.isFinite(parseInt(String(targetUserId || ''), 10)) ? parseInt(String(targetUserId), 10) : null;
    const date = isISODate(targetDate) ? String(targetDate) : null;
    const month = isYM(targetMonth) ? String(targetMonth) : null;
    const msg = String(message || '').trim();
    if (!msg) throw Object.assign(new Error('Missing message'), { status: 400 });
    const [res] = await db.query(
      `INSERT INTO notices (target_user_id, target_date, target_month, message, created_by) VALUES (?, ?, ?, ?, ?)`,
      [tu, date, month, msg, createdBy || null]
    );
    const id = Number(res?.insertId || 0);
    const [rows] = await db.query(`SELECT * FROM notices WHERE id = ? LIMIT 1`, [id]);
    return rows && rows[0] ? rows[0] : { id };
  },
  async listForDate({ date, month, limit, userId }) {
    await ensureNoticesSchema();
    await ensureNoticeReadsSchema();
    const d = isISODate(date) ? String(date) : null;
    const m = isYM(month) ? String(month) : (d ? String(d).slice(0, 7) : null);
    const lim = Math.min(50, Math.max(1, parseInt(String(limit || 10), 10) || 10));
    const uid = parseInt(String(userId || 0), 10) || 0;
    const [rows] = await db.query(
      `
        SELECT n.id, n.target_user_id, n.target_date, n.target_month, n.message, n.created_by, n.created_at,
               r.read_at
        FROM notices n
        LEFT JOIN notice_reads r
          ON r.notice_id = n.id AND r.user_id = ?
        WHERE (n.target_user_id IS NULL OR n.target_user_id = ?)
          AND (
            (n.target_date IS NULL AND n.target_month IS NULL)
            OR (n.target_date IS NOT NULL AND n.target_date = ?)
            OR (n.target_month IS NOT NULL AND n.target_month = ?)
          )
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ?
      `,
      [uid, uid, d, m, lim]
    );
    return rows || [];
  },
  async listAdmin({ from, to, limit }) {
    await ensureNoticesSchema();
    await ensureNoticeReadsSchema();
    const f = isISODate(from) ? String(from) : null;
    const t = isISODate(to) ? String(to) : null;
    const lim = Math.min(200, Math.max(1, parseInt(String(limit || 50), 10) || 50));
    const where = [];
    const args = [];
    if (f) { where.push(`n.created_at >= ?`); args.push(`${f} 00:00:00`); }
    if (t) { where.push(`n.created_at <= ?`); args.push(`${t} 23:59:59`); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(
      `
        SELECT n.id, n.target_user_id, n.target_date, n.target_month, n.message, n.created_by, n.created_at,
               u.username AS target_username, u.employee_code AS target_employee_code, u.email AS target_email,
               rr.read_at AS target_read_at,
               COALESCE(rc.read_count, 0) AS read_count
        FROM notices n
        LEFT JOIN users u ON u.id = n.target_user_id
        LEFT JOIN notice_reads rr ON rr.notice_id = n.id AND rr.user_id = n.target_user_id
        LEFT JOIN (
          SELECT notice_id, COUNT(*) AS read_count
          FROM notice_reads
          GROUP BY notice_id
        ) rc ON rc.notice_id = n.id
        ${w}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `,
      [...args, lim]
    );
    return rows || [];
  },
  async markRead({ noticeIds, userId }) {
    await ensureNoticesSchema();
    await ensureNoticeReadsSchema();
    const uid = parseInt(String(userId || 0), 10) || 0;
    if (!uid) throw Object.assign(new Error('Missing userId'), { status: 400 });
    const ids = Array.isArray(noticeIds) ? noticeIds : [];
    const cleaned = [];
    for (const x of ids) {
      const n = parseInt(String(x || 0), 10);
      if (n) cleaned.push(n);
    }
    const unique = Array.from(new Set(cleaned)).slice(0, 50);
    if (!unique.length) return { marked: 0 };
    for (const nid of unique) {
      await db.query(
        `INSERT INTO notice_reads (notice_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE read_at = read_at`,
        [nid, uid]
      );
    }
    return { marked: unique.length };
  },
  async deleteNotice(id) {
    await ensureNoticesSchema();
    const nid = parseInt(String(id || 0), 10);
    if (!nid) throw Object.assign(new Error('Missing id'), { status: 400 });
    const [res] = await db.query(`DELETE FROM notices WHERE id = ?`, [nid]);
    return { deleted: Number(res?.affectedRows || 0) };
  }
};
