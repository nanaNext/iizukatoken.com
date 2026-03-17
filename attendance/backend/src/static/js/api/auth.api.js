const AUTH_BASE = '/api/auth';

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function fetchJSON(url, options) {
  const csrf = getCookie('csrfToken');
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options });
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
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || (Array.isArray(j.errors) && j.errors.length ? j.errors[0].msg : msg);
    } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data; // { accessToken, refreshToken, id, username, email, role }
}

export async function me(accessToken) {
  const res = await fetch(`${AUTH_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    credentials: 'include'
  });
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

export async function refresh(refreshToken) {
  const csrf = getCookie('csrfToken');
  const res = await fetch(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
    credentials: 'include',
    body: JSON.stringify(refreshToken ? { refreshToken } : {})
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json(); // { accessToken, refreshToken }
}

export async function logout(refreshToken) {
  const csrf = getCookie('csrfToken');
  const res = await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
    credentials: 'include',
    body: JSON.stringify(refreshToken ? { refreshToken } : {})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
