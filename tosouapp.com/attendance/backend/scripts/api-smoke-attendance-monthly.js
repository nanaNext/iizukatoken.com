require('../src/config/loadEnv');

const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const jwt = require('jsonwebtoken');
const db = require('../src/core/database/mysql');

async function jfetch(path, { method = 'GET', body, token } = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    cache: 'no-store'
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function getToken() {
  const email = process.env.SMOKE_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SMOKE_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

  if (email && password) {
    const login = await jfetch('/api/auth/login', { method: 'POST', body: { email, password } });
    console.log('POST /api/auth/login', login.status, login.ok ? 'OK' : 'FAIL');
    if (!login.ok) {
      console.log('login error:', login.text);
      return null;
    }
    return login.json?.accessToken || null;
  }

  const secret = process.env.JWT_SECRET_CURRENT || process.env.JWT_SECRET;
  if (!secret) {
    console.log('Missing JWT_SECRET to generate token');
    return null;
  }
  if (!email) {
    console.log('Missing SUPER_ADMIN_EMAIL to pick user for token');
    return null;
  }
  const [rows] = await db.query(
    `SELECT id, role, token_version FROM users WHERE email_lower = LOWER(?) OR email = ? LIMIT 1`,
    [email, email]
  );
  const u = rows && rows[0] ? rows[0] : null;
  if (!u?.id) {
    console.log('Cannot find user by SUPER_ADMIN_EMAIL in users table');
    return null;
  }
  const payload = { id: u.id, role: u.role || 'admin', v: u.token_version || 1 };
  const token = jwt.sign(payload, secret, { expiresIn: Number(process.env.ACCESS_TOKEN_EXPIRES || 1800) });
  console.log('Auth: generated JWT from env secret (no password)');
  return token;
}

async function main() {
  console.log('BASE=', BASE);
  const ping = await jfetch('/ping').catch((e) => ({ ok: false, status: 0, text: String(e?.message || e) }));
  console.log('GET /ping', ping.status, ping.ok ? 'OK' : 'FAIL');
  if (!ping.ok) {
    console.log('Ping response:', ping.text);
    process.exitCode = 2;
    return;
  }

  const token = await getToken();
  if (!token) {
    console.log('Missing auth token (login or JWT generation failed)');
    process.exitCode = 1;
    return;
  }

  const me = await jfetch('/api/auth/me', { token });
  console.log('GET /api/auth/me', me.status, me.ok ? 'OK' : 'FAIL');
  if (!me.ok) {
    console.log('me error:', me.text);
    process.exitCode = 1;
    return;
  }

  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const ym = now.toISOString().slice(0, 7);
  const year = ym.slice(0, 4);
  const month = String(parseInt(ym.slice(5, 7), 10));

  let targetUserId = null;
  const users = await jfetch('/api/admin/users', { token });
  console.log('GET /api/admin/users', users.status, users.ok ? 'OK' : 'SKIP');
  if (users.ok && Array.isArray(users.json) && users.json.length) {
    const pick = users.json.find((u) => String(u.role || '').toLowerCase() === 'employee') || users.json[0];
    targetUserId = pick?.id || null;
  }
  if (!targetUserId) {
    targetUserId = me.json?.id;
  }

  const qUser = targetUserId ? `&userId=${encodeURIComponent(targetUserId)}` : '';
  const detail = await jfetch(`/api/attendance/month/detail?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}${qUser}`, { token });
  console.log('GET /api/attendance/month/detail', detail.status, detail.ok ? 'OK' : 'FAIL');
  if (!detail.ok) {
    console.log('detail error:', detail.text);
    process.exitCode = 1;
    return;
  }

  const summary = await jfetch(`/api/attendance/month?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}${qUser}`, { token });
  console.log('GET /api/attendance/month', summary.status, summary.ok ? 'OK' : 'FAIL');
  if (!summary.ok) {
    console.log('summary error:', summary.text);
    process.exitCode = 1;
    return;
  }

  const testDate = `${ym}-20`;
  const dailyUpdates = [
    {
      date: testDate,
      workType: 'remote',
      location: 'smoke-test',
      reason: 'other',
      memo: `smoke-${Date.now()}`,
      breakMinutes: 60,
      nightBreakMinutes: 0
    }
  ];
  const updates = [
    {
      checkIn: `${testDate} 08:00:00`,
      checkOut: `${testDate} 17:00:00`,
      workType: 'remote'
    }
  ];
  const bulk = await jfetch('/api/attendance/month/bulk', { method: 'PUT', token, body: { year: parseInt(year, 10), month: parseInt(month, 10), userId: targetUserId, updates, dailyUpdates } });
  console.log('PUT /api/attendance/month/bulk', bulk.status, bulk.ok ? 'OK' : 'FAIL');
  if (!bulk.ok) {
    console.log('bulk error:', bulk.text);
    process.exitCode = 1;
    return;
  }

  const detail2 = await jfetch(`/api/attendance/month/detail?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}${qUser}`, { token });
  console.log('GET /api/attendance/month/detail (after save)', detail2.status, detail2.ok ? 'OK' : 'FAIL');
  if (!detail2.ok) {
    console.log('detail2 error:', detail2.text);
    process.exitCode = 1;
    return;
  }

  const days = Array.isArray(detail2.json?.days) ? detail2.json.days : [];
  const dRow = days.find((d) => String(d?.date || '') === testDate);
  const hasSegment = Array.isArray(dRow?.segments) && dRow.segments.some((s) => String(s?.checkIn || '').startsWith(testDate));
  const hasDaily = !!dRow?.daily;
  console.log('verify:', { testDate, hasSegment, hasDaily });
  if (!hasSegment || !hasDaily) {
    console.log('verify_fail_detail_day=', JSON.stringify(dRow || null));
    process.exitCode = 1;
    return;
  }

  console.log('ALL_OK');
}

main().catch((e) => {
  console.error('SMOKE_FATAL:', e?.stack || e?.message || e);
  process.exitCode = 1;
});

process.on('beforeExit', async () => {
  try {
    await db.end();
  } catch {}
});
