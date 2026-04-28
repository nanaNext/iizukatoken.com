require('../src/config/loadEnv');

const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function jfetch(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body == null ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

function todayJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

async function getSmokeUserAndToken() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'attendance_db'
  });
  try {
    const roleFilter = String(process.env.SMOKE_ROLE || 'admin').toLowerCase();
    const [rows] = await db.query(
      `SELECT id, email, role, COALESCE(token_version, 1) AS token_version
       FROM users
       WHERE role = ?
       ORDER BY id ASC
       LIMIT 1`,
      [roleFilter]
    );
    const u = rows && rows[0] ? rows[0] : null;
    if (!u) throw new Error(`No user found for role=${roleFilter}`);
    const secret = process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET;
    if (!secret) throw new Error('Missing JWT secret');
    const token = jwt.sign(
      { id: u.id, role: u.role, v: Number(u.token_version || 1) },
      secret,
      { expiresIn: Number(process.env.ACCESS_TOKEN_EXPIRES || 1800) }
    );
    return { user: u, token };
  } finally {
    await db.end();
  }
}

async function main() {
  console.log('BASE=', BASE);
  const ping = await jfetch('/ping');
  console.log('GET /ping', ping.status, ping.ok ? 'OK' : 'FAIL');
  if (!ping.ok) throw new Error('Ping failed');

  const { user, token } = await getSmokeUserAndToken();
  const date = todayJST();
  const [year, month] = date.split('-');
  console.log('SMOKE_USER=', { id: user.id, email: user.email, role: user.role, date });

  const st0 = await jfetch(`/api/attendance/status?date=${encodeURIComponent(date)}`, { token });
  console.log('GET /api/attendance/status', st0.status, st0.ok ? 'OK' : 'FAIL', 'open=', st0.json?.open);
  if (!st0.ok) throw new Error(`status failed: ${st0.text}`);

  if (st0.json?.open) {
    const closeBefore = await jfetch('/api/attendance/checkout', {
      method: 'POST',
      token,
      body: { note: 'smoke-close-before' }
    });
    console.log('POST /api/attendance/checkout (pre-close)', closeBefore.status, closeBefore.ok ? 'OK' : 'FAIL');
    if (!closeBefore.ok) throw new Error(`pre-close failed: ${closeBefore.text}`);
  }

  const ci = await jfetch('/api/attendance/checkin', {
    method: 'POST',
    token,
    body: { workType: 'remote', note: 'smoke-checkin' }
  });
  console.log('POST /api/attendance/checkin', ci.status, ci.ok ? 'OK' : 'FAIL');
  if (!ci.ok) throw new Error(`checkin failed: ${ci.text}`);

  const co = await jfetch('/api/attendance/checkout', {
    method: 'POST',
    token,
    body: { note: 'smoke-checkout' }
  });
  console.log('POST /api/attendance/checkout', co.status, co.ok ? 'OK' : 'FAIL');
  if (!co.ok) throw new Error(`checkout failed: ${co.text}`);

  const day = await jfetch(`/api/attendance/date/${encodeURIComponent(date)}`, { token });
  console.log('GET /api/attendance/date/:date', day.status, day.ok ? 'OK' : 'FAIL');
  if (!day.ok) throw new Error(`day failed: ${day.text}`);

  const detail = await jfetch(
    `/api/attendance/month/detail?year=${encodeURIComponent(year)}&month=${encodeURIComponent(Number(month))}&userId=${encodeURIComponent(user.id)}`,
    { token }
  );
  console.log('GET /api/attendance/month/detail', detail.status, detail.ok ? 'OK' : 'FAIL');
  if (!detail.ok) throw new Error(`month detail failed: ${detail.text}`);

  const days = Array.isArray(detail.json?.days) ? detail.json.days : [];
  const row = days.find((d) => String(d?.date || '').slice(0, 10) === date) || null;
  const segs = Array.isArray(row?.segments) ? row.segments : [];
  const hasClosed = segs.some((s) => String(s?.checkIn || '').startsWith(date) && String(s?.checkOut || '').startsWith(date));
  console.log('VERIFY', { date, segments: segs.length, hasClosed });
  if (!hasClosed) throw new Error('Closed segment not reflected in month/detail');

  console.log('ALL_OK_E2E');
}

main().catch((e) => {
  console.error('SMOKE_E2E_FAIL:', e?.message || e);
  process.exitCode = 1;
});
