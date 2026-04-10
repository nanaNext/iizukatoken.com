const AUTH_BASE = '/api/auth';

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const ms = Number(timeoutMs || 0) > 0 ? Number(timeoutMs) : 15000;
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchJSON(url, options) {
  const csrf = getCookie('csrfToken');
  const res = await fetchWithTimeout(url, { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options }, 15000);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || (Array.isArray(j.errors) && j.errors.length ? j.errors[0].msg : msg);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function login(email, password) {
  const res = await fetchWithTimeout(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  }, 15000);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || (Array.isArray(j.errors) && j.errors.length ? j.errors[0].msg : msg);
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data;
}

export async function me(accessToken) {
  const res = await fetchWithTimeout(`${AUTH_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    credentials: 'include'
  }, 15000);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function refresh() {
  const csrf = getCookie('csrfToken');
  const res = await fetchWithTimeout(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
    credentials: 'include',
    body: JSON.stringify({})
  }, 15000);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function logout() {
  const csrf = getCookie('csrfToken');
  const res = await fetchWithTimeout(`${AUTH_BASE}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
    credentials: 'include',
    body: JSON.stringify({})
  }, 15000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
