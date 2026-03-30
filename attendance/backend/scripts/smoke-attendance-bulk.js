#!/usr/bin/env node
const fetch = global.fetch || require('node-fetch');
require('../src/config/loadEnv');

async function jfetch(path, { method='GET', body, token } = {}) {
  const base = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = base + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

(async () => {
  const email = process.env.SMOKE_EMAIL || process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SMOKE_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
  const login = await jfetch('/api/auth/login', { method: 'POST', body: { email, password } });
  if (!login.ok) {
    console.error('login failed', login.status, login.text);
    process.exit(1);
  }
  const token = login.json?.accessToken;
  const year = Number(process.env.SMOKE_YEAR || new Date().getFullYear());
  const month = Number(process.env.SMOKE_MONTH || (new Date().getMonth() + 1));
  const userId = Number(process.env.SMOKE_USER_ID || 3);
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const day = String(process.env.SMOKE_DAY || '05').padStart(2, '0');
  const date = `${yyyy}-${mm}-${day}`;

  // 1) Save kubun=休日 (daily)
  const payload = {
    year, month, userId,
    updates: [],
    dailyUpdates: [{ date, kubun: '休日', kubunConfirmed: 1 }]
  };
  const put = await jfetch('/api/attendance/month/bulk', { method: 'PUT', token, body: payload });
  console.log('PUT bulk', put.status, put.json || put.text);
  if (!put.ok) process.exit(2);

  // 2) Load month and assert day has kubun=休日
  const get = await jfetch(`/api/attendance/month/detail?year=${year}&month=${month}&userId=${userId}`, { token });
  if (!get.ok) {
    console.error('detail failed', get.status, get.text);
    process.exit(3);
  }
  const days = Array.isArray(get.json?.days) ? get.json.days : [];
  const d = days.find(x => String(x?.date || '').slice(0,10) === date);
  console.log('Day', d?.date, d?.daily?.kubun, d?.daily?.kubunConfirmed);
  if (!d || d?.daily?.kubun !== '休日') {
    console.error('assertion failed: daily.kubun not set to 休日');
    process.exit(4);
  }
  console.log('smoke OK');
})(); 
