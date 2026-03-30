(function () {
  if (globalThis.MonthlyAuth) return;

  function getCookie(name) {
    const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return m ? decodeURIComponent(m[2]) : null;
  }

  const AUTH_BASE = '/api/auth';

  async function me(accessToken) {
    const res = await fetch(`${AUTH_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      credentials: 'include'
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  async function refresh(refreshToken) {
    const csrf = getCookie('csrfToken');
    const res = await fetch(`${AUTH_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
      credentials: 'include',
      body: JSON.stringify(refreshToken ? { refreshToken } : {})
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  let refreshInFlight = null;
  let refreshCooldownUntil = 0;
  async function refreshCached(refreshToken) {
    const now = Date.now();
    if (now < refreshCooldownUntil) throw new Error('Too many requests');
    if (refreshInFlight) return refreshInFlight;
    const rt = String(refreshToken || '').trim();
    if (!rt) throw new Error('Missing refreshToken');
    refreshInFlight = (async () => {
      try {
        return await refresh(rt);
      } catch (e) {
        const msg = String(e?.message || '');
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

  async function logout(refreshToken) {
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

  async function fetchJSONAuth(url, options) {
    const tok = sessionStorage.getItem('accessToken') || '';
    const csrf = getCookie('csrfToken');
    let res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tok ? `Bearer ${tok}` : '',
        'X-CSRF-Token': csrf || ''
      },
      credentials: 'include',
      cache: 'no-store',
      ...options
    });
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refreshCached(rt || undefined);
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
          cache: 'no-store',
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
      if (res.status === 429 || m.includes('too many requests')) {
        throw new Error('Too many requests（操作が多すぎます。1分ほど待ってから再度お試しください）');
      }
      if (res.status === 401 || res.status === 403) {
        if (m.includes('invalid or expired token') || m.includes('no token provided') || m.includes('missing refreshtoken') || m.includes('invalid refresh token') || m.includes('unauthorized')) {
          redirectToLoginOnce();
        }
      }
      throw new Error(msg);
    }
    try { return await res.json(); } catch { return null; }
  }

  async function downloadWithAuth(url, filename) {
    let tok = sessionStorage.getItem('accessToken') || '';
    const csrf = getCookie('csrfToken');
    let res = await fetch(url, { headers: { 'Authorization': tok ? 'Bearer ' + tok : '', 'X-CSRF-Token': csrf || '' }, credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refreshCached(rt || undefined);
        sessionStorage.setItem('accessToken', r.accessToken);
        try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
        tok = r.accessToken;
        const csrf2 = getCookie('csrfToken');
        res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf2 || '' }, credentials: 'include' });
      } catch {}
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename || 'download.xlsx';
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch {} }, 1000);
  }

  async function ensureAuthProfile() {
    let token = sessionStorage.getItem('accessToken');
    let profile = null;
    if (token) { try { profile = await me(token); } catch {} }
    if (!profile) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refreshCached(rt || undefined);
        sessionStorage.setItem('accessToken', r.accessToken);
        try {
          sessionStorage.setItem('refreshToken', r.refreshToken || rt);
          localStorage.setItem('refreshToken', r.refreshToken || rt);
        } catch {}
        profile = await me(r.accessToken);
      } catch {}
    }
    if (!profile) {
      try {
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
        const user = userStr ? JSON.parse(userStr) : null;
        const role = String(user?.role || '').toLowerCase();
        profile = role === 'admin' || role === 'manager' || role === 'employee' ? user : null;
      } catch {}
    }
    return profile || null;
  }

  globalThis.MonthlyAuth = {
    fetchJSONAuth,
    downloadWithAuth,
    ensureAuthProfile,
    logout
  };
})();
