const repo = require('./attendance.repository');
const settingsService = require('../settings/settings.service');
const { nowUTCMySQL, formatInputToMySQLUTC, nowJSTMySQL, formatInputToMySQLJST, parseMySQLUTCToDate, parseMySQLJSTToDate } = require('../../utils/dateTime');
const rules = require('./attendance.rules');

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad((lat2 ?? 0) - (lat1 ?? 0));
  const dLon = toRad((lon2 ?? 0) - (lon1 ?? 0));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1 ?? 0)) * Math.cos(toRad(lat2 ?? 0)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeLabelsForCheckIn(flags, loc) {
  const labels = [];
  if (loc?.accuracy != null && Number(loc.accuracy) > Number(flags.minAccuracyMeters || 100)) labels.push('low_accuracy');
  const cw = String(flags.countryWhitelist || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const cc = String(loc?.countryCode || '').toUpperCase();
  if (cc && cc !== 'JP' && !cw.includes(cc)) labels.push('out_of_jp');
  if (String(loc?.locationSource || '') === 'ip') labels.push('ip_fallback');
  return labels;
}

function computeLabelsForCheckOut(open, tsJST, loc) {
  const labels = [];
  const inDate = parseMySQLJSTToDate(open.checkIn);
  const outDate = parseMySQLJSTToDate(tsJST);
  const minutes = Math.max(0, Math.round((outDate.getTime() - inDate.getTime()) / 60000));
  const km = haversineKm(open.in_latitude, open.in_longitude, loc?.latitude, loc?.longitude);
  if (km > 300 && minutes < 120) labels.push('fast_travel');
  if (km > 900 && minutes < 180) labels.push('impossible_travel');
  return labels;
}

async function checkIn(userId, time, loc) {
  const flags = await settingsService.getFlags();
  const ts = time ? formatInputToMySQLJST(time) : nowJSTMySQL();
  const labels = computeLabelsForCheckIn(flags, loc);
  const wt = String(arguments[3] || '').trim();
  const workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
  const id = await repo.createCheckInTx(userId, ts, loc, labels.join(','), workType);
  if (!id) {
    return null;
  }
  return { id, userId, checkIn: ts, labels, workType };
}

async function checkOut(userId, time, loc) {
  const open = await repo.getOpenAttendanceForUser(userId);
  if (!open) {
    return null;
  }
  const ts = time ? formatInputToMySQLJST(time) : nowJSTMySQL();
  const labels = computeLabelsForCheckOut(open, ts, loc);
  await repo.setCheckOut(open.id, ts, loc, labels.join(','));
  return { id: open.id, userId, checkIn: open.checkIn, checkOut: ts, labels };
}

module.exports = { checkIn, checkOut };
async function timesheet(userId, fromDate, toDate) {
  const rows = await repo.listByUserBetween(userId, fromDate, toDate);
  const res = await rules.computeRange(rows);
  return res;
}
module.exports.timesheet = timesheet;
