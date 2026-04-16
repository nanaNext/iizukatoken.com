function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatMySQLDateTimeUTC(date) {
  const base = date ? new Date(date) : new Date();
  const y = base.getUTCFullYear();
  const m = pad(base.getUTCMonth() + 1);
  const d = pad(base.getUTCDate());
  const H = pad(base.getUTCHours());
  const M = pad(base.getUTCMinutes());
  const S = pad(base.getUTCSeconds());
  return `${y}-${m}-${d} ${H}:${M}:${S}`;
}

function formatMySQLDateTimeJST(date) {
  const base = date ? new Date(date) : new Date();
  const jst = new Date(base.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = pad(jst.getUTCMonth() + 1);
  const d = pad(jst.getUTCDate());
  const H = pad(jst.getUTCHours());
  const M = pad(jst.getUTCMinutes());
  const S = pad(jst.getUTCSeconds());
  return `${y}-${m}-${d} ${H}:${M}:${S}`;
}

function nowUTCMySQL() {
  return formatMySQLDateTimeUTC();
}

function nowJSTMySQL() {
  return formatMySQLDateTimeJST();
}

function formatInputToMySQLUTC(input) {
  return formatMySQLDateTimeUTC(input);
}

function formatInputToMySQLJST(input) {
  return formatMySQLDateTimeJST(input);
}

function parseMySQLUTCToDate(str) {
  const [date, time] = str.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [H, M, S] = time.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, H, M, S);
  return new Date(utcMs);
}

function parseMySQLJSTToDate(str) {
  const [date, time] = str.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [H, M, S] = time.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, H - 9, M, S);
  return new Date(utcMs);
}

module.exports = {
  // UTC-first storage
  nowUTCMySQL,
  formatInputToMySQLUTC,
  formatMySQLDateTimeUTC,
  parseMySQLUTCToDate,
  // Legacy JST helpers (display/compat)
  nowJSTMySQL,
  formatInputToMySQLJST,
  formatMySQLDateTimeJST,
  parseMySQLJSTToDate
};
