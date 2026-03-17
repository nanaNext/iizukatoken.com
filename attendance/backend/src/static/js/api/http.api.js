import { refresh } from './auth.api.js';
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
};

let redirecting = false;
function redirectToLoginOnce() {
  if (redirecting) return;
  redirecting = true;
  try {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {}
  try { window.location.href = '/ui/login'; } catch {}
}

export async function fetchJSONAuth(url, options) {
  const tok = sessionStorage.getItem('accessToken') || '';
  const csrf = getCookie('csrfToken');
  let res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': tok ? `Bearer ${tok}` : '',
      'X-CSRF-Token': csrf || ''
    },
    credentials: 'include',
    ...options
  });
  if (!res.ok && (res.status === 401 || res.status === 403 || res.status === 500)) {
    try {
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      const r = await refresh(rt || undefined);
      sessionStorage.setItem('accessToken', r.accessToken);
      try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
      const csrf2 = getCookie('csrfToken');
      res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${r.accessToken}`,
          'X-CSRF-Token': csrf2 || ''
        },
        credentials: 'include',
        ...options
      });
    } catch {}
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || (Array.isArray(j.errors) && j.errors.length ? j.errors[0].msg : msg);
    } catch {}
    const m = String(msg || '').toLowerCase();
    if (res.status === 401 || res.status === 403) {
      if (m.includes('invalid or expired token') || m.includes('no token provided') || m.includes('missing refreshtoken') || m.includes('invalid refresh token') || m.includes('unauthorized')) {
        redirectToLoginOnce();
      }
    }
    throw new Error(msg);
  }
  try { return await res.json(); } catch { return null; }
}
