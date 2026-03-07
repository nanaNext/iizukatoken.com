const AUTH_BASE = '/api/auth';

async function fetchJSON(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, credentials: 'include', ...options });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export async function login(email, password) {
  const data = await fetchJSON(`${AUTH_BASE}/login`, { method: 'POST', body: JSON.stringify({ email, password }) });
  return data; // { accessToken, refreshToken, id, username, email, role }
}

export async function me(accessToken) {
  const res = await fetch(`${AUTH_BASE}/me`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function refresh(csrfToken) {
  const res = await fetch(`${AUTH_BASE}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
    credentials: 'include',
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json(); // { accessToken, refreshToken }
}

export async function logout(csrfToken) {
  const res = await fetch(`${AUTH_BASE}/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
    credentials: 'include',
    body: JSON.stringify({})
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
