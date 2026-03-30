import { refresh } from './auth.api.js';
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
};

let refreshInFlight = null;
let refreshCooldownUntil = 0;
async function refreshCached(refreshToken) {
  const now = Date.now();
  if (now < refreshCooldownUntil) throw new Error('Too many requests');
  if (refreshInFlight) return refreshInFlight;
  const rt = String(refreshToken || '').trim();
  refreshInFlight = (async () => {
    try {
      return await refresh(rt || undefined);
    } catch (e) {
      const msg = String((e && e.message) ? e.message : '');
      if (msg.includes('HTTP 429') || msg.toLowerCase().includes('too many requests')) {
        refreshCooldownUntil = Date.now() + 60000;
      }
      throw e;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

let redirecting = false;
function redirectToLoginOnce() {
  if (redirecting) return;
  redirecting = true;
  try {
    if (String(window.location && window.location.pathname || '') === '/ui/login') return;
  } catch {}
  try {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {}
  try {
    const next = (() => {
      try {
        const p = String(window.location.pathname || '');
        const s = String(window.location.search || '');
        const h = String(window.location.hash || '');
        return p + s + h;
      } catch {
        return '';
      }
    })();
    const url = '/ui/login' + (next ? ('?next=' + encodeURIComponent(next)) : '');
    try { window.location.replace(url); return; } catch {}
    try { window.location.href = url; return; } catch {}
  } catch {}
  try {
    const a = document.createElement('a');
    a.href = '/ui/login';
    a.textContent = 'ログイン画面へ';
    a.style.cssText = 'position:fixed;top:12px;right:12px;z-index:99999;background:#fff1f2;color:#7f1d1d;border:1px solid #fecaca;border-radius:10px;padding:10px 12px;font-weight:900;';
    document.body.appendChild(a);
  } catch {}
}

async function doFetchAuth(url, options, accessToken) {
  const csrf = getCookie('csrfToken');
  const opt = options || {};
  const baseHeaders = {
    'Authorization': accessToken ? `Bearer ${accessToken}` : '',
    'X-CSRF-Token': csrf || ''
  };
  const hasFormData = typeof FormData !== 'undefined' && opt.body instanceof FormData;
  if (!hasFormData) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  const mergedHeaders = { ...baseHeaders, ...(opt.headers || {}) };
  return fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...opt,
    headers: mergedHeaders
  });
}

async function fetchAuthResponse(url, options) {
  let tok = sessionStorage.getItem('accessToken') || '';
  if (!tok) {
    try {
      const rt0 = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      if (rt0) {
        const r0 = await refreshCached(rt0 || undefined);
        tok = r0.accessToken || '';
        if (tok) {
          sessionStorage.setItem('accessToken', tok);
          try {
            if (r0.refreshToken) {
              sessionStorage.setItem('refreshToken', r0.refreshToken);
              localStorage.setItem('refreshToken', r0.refreshToken);
            }
          } catch {}
        }
      }
    } catch {}
  }
  let res = await doFetchAuth(url, options, tok);
  if (!res.ok && res.status === 401) {
    try {
      const clone = res.clone();
      const j = await clone.json().catch(() => ({}));
      if (j.notPublished || (j.message && j.message.includes('公開されていません'))) {
        // It's a specific business error, not an auth error, so don't try to refresh/login
        throw new Error(j.message || 'Not published');
      }
    } catch (e) {
      if (e.message && e.message.includes('公開されていません')) {
        throw e; // Pass it down to be caught below
      }
      // If not JSON or not our specific error, proceed with refresh logic
    }

    try {
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      const r = await refreshCached(rt || undefined);
      sessionStorage.setItem('accessToken', r.accessToken);
      try {
        if (r.refreshToken) {
          sessionStorage.setItem('refreshToken', r.refreshToken);
          localStorage.setItem('refreshToken', r.refreshToken);
        } else if (rt) {
          sessionStorage.setItem('refreshToken', rt);
          localStorage.setItem('refreshToken', rt);
        }
      } catch {}
      res = await doFetchAuth(url, options, r.accessToken);
    } catch {
      redirectToLoginOnce();
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j.message || (Array.isArray(j.errors) && j.errors.length ? j.errors[0].msg : msg);
    } catch {}
    const m = String(msg || '').toLowerCase();
    if (res.status === 429 || m.includes('too many requests')) {
      throw new Error('Too many requests（操作が多すぎます。1分ほど待ってから再度お試しください）');
    }
    if (res.status === 401) {
      redirectToLoginOnce();
    }
    throw new Error(msg);
  }
  return res;
}

export async function fetchJSONAuth(url, options) {
  const res = await fetchAuthResponse(url, options);
  try { return await res.json(); } catch { return null; }
}

export async function fetchBlobAuth(url, options) {
  const res = await fetchAuthResponse(url, options);
  return res.blob();
}

export async function fetchResponseAuth(url, options) {
  return fetchAuthResponse(url, options);
}
