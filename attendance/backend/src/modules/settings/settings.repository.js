const db = require('../../core/database/mysql');

module.exports = {
  async ensureFlagsSchema() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS settings (
          id INT PRIMARY KEY,
          workStart CHAR(5) NULL,
          workEnd CHAR(5) NULL,
          breakMinutes INT NULL,
          rounding VARCHAR(16) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [cols] = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() AND table_name = 'settings'
      `);
      const set = new Set((cols || []).map(c => String(c.column_name)));
      const alters = [];
      if (!set.has('MAINTENANCE_MODE')) alters.push(`ADD COLUMN MAINTENANCE_MODE TINYINT(1) DEFAULT 0`);
      if (!set.has('DISABLE_PAYSLIP_UPLOAD')) alters.push(`ADD COLUMN DISABLE_PAYSLIP_UPLOAD TINYINT(1) DEFAULT 0`);
      if (!set.has('DISABLE_PAYSLIP_DOWNLOAD')) alters.push(`ADD COLUMN DISABLE_PAYSLIP_DOWNLOAD TINYINT(1) DEFAULT 0`);
      if (!set.has('LOCK_LOGIN_EXCEPT_SUPER')) alters.push(`ADD COLUMN LOCK_LOGIN_EXCEPT_SUPER TINYINT(1) DEFAULT 0`);
      if (!set.has('REMOTE_POLICY')) alters.push(`ADD COLUMN REMOTE_POLICY VARCHAR(32) DEFAULT 'anywhere'`);
      if (!set.has('REQUIRE_GPS')) alters.push(`ADD COLUMN REQUIRE_GPS TINYINT(1) DEFAULT 1`);
      if (!set.has('MIN_ACCURACY_METERS')) alters.push(`ADD COLUMN MIN_ACCURACY_METERS INT DEFAULT 100`);
      if (!set.has('REQUIRE_NOTE_ON_REMOTE')) alters.push(`ADD COLUMN REQUIRE_NOTE_ON_REMOTE TINYINT(1) DEFAULT 0`);
      if (!set.has('COUNTRY_WHITELIST')) alters.push(`ADD COLUMN COUNTRY_WHITELIST VARCHAR(255) NULL`);
      if (!set.has('MAX_DEVICES_PER_USER')) alters.push(`ADD COLUMN MAX_DEVICES_PER_USER INT DEFAULT 5`);
      if (alters.length) {
        await db.query(`ALTER TABLE settings ${alters.join(', ')}`);
      }
      const [rows] = await db.query(`SELECT id FROM settings WHERE id = 1`);
      if (!rows || !rows.length) {
        await db.query(`INSERT INTO settings (id) VALUES (1)`);
      }
    } catch {}
  },
  async getSettings() {
    const sql = `SELECT * FROM settings LIMIT 1`;
    const [rows] = await db.query(sql);
    return rows[0];
  },

  async updateSettings(data) {
    const sql = `
      UPDATE settings 
      SET workStart = ?, workEnd = ?, breakMinutes = ?, rounding = ?
      WHERE id = 1
    `;
    await db.query(sql, [
      data.workStart,
      data.workEnd,
      data.breakMinutes,
      data.rounding
    ]);
  },
  async getFlags() {
    const [rows] = await db.query(`
      SELECT MAINTENANCE_MODE, DISABLE_PAYSLIP_UPLOAD, DISABLE_PAYSLIP_DOWNLOAD, LOCK_LOGIN_EXCEPT_SUPER,
             REMOTE_POLICY, REQUIRE_GPS, MIN_ACCURACY_METERS, REQUIRE_NOTE_ON_REMOTE, COUNTRY_WHITELIST, MAX_DEVICES_PER_USER
      FROM settings WHERE id = 1 LIMIT 1
    `);
    const r = rows && rows[0] ? rows[0] : {};
    return {
      maintenanceMode: !!Number(r.MAINTENANCE_MODE || 0),
      disablePayslipUpload: !!Number(r.DISABLE_PAYSLIP_UPLOAD || 0),
      disablePayslipDownload: !!Number(r.DISABLE_PAYSLIP_DOWNLOAD || 0),
      lockLoginExceptSuper: !!Number(r.LOCK_LOGIN_EXCEPT_SUPER || 0),
      remotePolicy: String(r.REMOTE_POLICY || 'anywhere'),
      requireGPS: !!Number(r.REQUIRE_GPS || 0),
      minAccuracyMeters: Number(r.MIN_ACCURACY_METERS || 100),
      requireNoteOnRemote: !!Number(r.REQUIRE_NOTE_ON_REMOTE || 0),
      countryWhitelist: String(r.COUNTRY_WHITELIST || ''),
      maxDevicesPerUser: Number(r.MAX_DEVICES_PER_USER || 5)
    };
  },
  async updateFlags({ maintenanceMode, disablePayslipUpload, disablePayslipDownload, lockLoginExceptSuper, remotePolicy, requireGPS, minAccuracyMeters, requireNoteOnRemote, countryWhitelist, maxDevicesPerUser }) {
    const m = maintenanceMode ? 1 : 0;
    const u = disablePayslipUpload ? 1 : 0;
    const d = disablePayslipDownload ? 1 : 0;
    const l = lockLoginExceptSuper ? 1 : 0;
    const rp = String(remotePolicy || 'anywhere');
    const rg = requireGPS ? 1 : 0;
    const acc = Number.isFinite(minAccuracyMeters) ? Number(minAccuracyMeters) : 100;
    const rn = requireNoteOnRemote ? 1 : 0;
    const cw = countryWhitelist != null ? String(countryWhitelist).slice(0, 255) : null;
    const md = Number.isFinite(maxDevicesPerUser) ? Number(maxDevicesPerUser) : 5;
    await db.query(`
      UPDATE settings 
      SET MAINTENANCE_MODE = ?, DISABLE_PAYSLIP_UPLOAD = ?, DISABLE_PAYSLIP_DOWNLOAD = ?, LOCK_LOGIN_EXCEPT_SUPER = ?,
          REMOTE_POLICY = ?, REQUIRE_GPS = ?, MIN_ACCURACY_METERS = ?, REQUIRE_NOTE_ON_REMOTE = ?, COUNTRY_WHITELIST = ?, MAX_DEVICES_PER_USER = ?
      WHERE id = 1
    `, [m, u, d, l, rp, rg, acc, rn, cw, md]);
  }
};
