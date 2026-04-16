const repo = require('./settings.repository');
let cache = null;
let cachedAt = 0;
const TTL_MS = 5000;

module.exports = {
  async getFlags() {
    const now = Date.now();
    if (!cache || now - cachedAt > TTL_MS) {
      cache = await repo.getFlags();
      cachedAt = now;
    }
    return cache;
  },
  async setFlags(payload) {
    await repo.updateFlags({
      maintenanceMode: String(payload.MAINTENANCE_MODE || payload.maintenanceMode || '').toLowerCase() === 'true',
      disablePayslipUpload: String(payload.DISABLE_PAYSLIP_UPLOAD || payload.disablePayslipUpload || '').toLowerCase() === 'true',
      disablePayslipDownload: String(payload.DISABLE_PAYSLIP_DOWNLOAD || payload.disablePayslipDownload || '').toLowerCase() === 'true',
      lockLoginExceptSuper: String(payload.LOCK_LOGIN_EXCEPT_SUPER || payload.lockLoginExceptSuper || '').toLowerCase() === 'true',
      remotePolicy: String(payload.REMOTE_POLICY || payload.remotePolicy || 'anywhere'),
      requireGPS: String(payload.REQUIRE_GPS || payload.requireGPS || 'true').toLowerCase() === 'true',
      minAccuracyMeters: Number(payload.MIN_ACCURACY_METERS || payload.minAccuracyMeters || 100),
      requireNoteOnRemote: String(payload.REQUIRE_NOTE_ON_REMOTE || payload.requireNoteOnRemote || 'false').toLowerCase() === 'true',
      countryWhitelist: payload.COUNTRY_WHITELIST != null ? String(payload.COUNTRY_WHITELIST) : (payload.countryWhitelist != null ? String(payload.countryWhitelist) : null),
      maxDevicesPerUser: Number(payload.MAX_DEVICES_PER_USER || payload.maxDevicesPerUser || 5)
    });
    cache = await repo.getFlags();
    cachedAt = Date.now();
    return cache;
  },
  async reload() {
    cache = await repo.getFlags();
    cachedAt = Date.now();
    return cache;
  }
};
