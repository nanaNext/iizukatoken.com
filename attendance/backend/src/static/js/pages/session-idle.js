(function () {
  if (globalThis.SessionIdle) return;
  if (/\/login(?:\.html)?$/.test(String(window.location.pathname || ''))) return;

  const IDLE_TIMEOUT_MS = 25 * 60 * 1000;
  const WARNING_MS = 5 * 60 * 1000;
  const GRACE_MS = 3 * 60 * 1000;
  const CHECK_MS = 10 * 1000;
  const ACTIVITY_KEY = 'se.lastActivityAt';
  const FORCE_LOGOUT_KEY = 'se.forceLogoutAt';

  const getCookie = (name) => {
    try {
      const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
      return m ? decodeURIComponent(m[2]) : null;
    } catch {
      return null;
    }
  };

  const now = () => Date.now();

  const setLastActivity = (t) => {
    try { localStorage.setItem(ACTIVITY_KEY, String(t)); } catch {}
  };

  const getLastActivity = () => {
    try {
      const v = Number(localStorage.getItem(ACTIVITY_KEY) || '0');
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  };

  const bump = () => {
    const t = now();
    setLastActivity(t);
  };

  const clearClientTokens = () => {
    try {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
    } catch {}
    try {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch {}
  };

  const goLogin = () => {
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
  };

  const flushDrafts = () => {
    try {
      const list = Array.isArray(globalThis.__draftFlushers) ? globalThis.__draftFlushers : [];
      for (const fn of list) {
        try { if (typeof fn === 'function') fn(); } catch {}
      }
    } catch {}
  };

  const doLogout = async () => {
    flushDrafts();
    try { localStorage.setItem(FORCE_LOGOUT_KEY, String(now())); } catch {}
    const rt = (() => {
      try { return sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || ''; } catch { return ''; }
    })();
    try {
      const csrf = getCookie('csrfToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
        credentials: 'include',
        body: JSON.stringify(rt ? { refreshToken: rt } : {})
      });
    } catch {}
    clearClientTokens();
    goLogin();
  };

  const refreshSession = async () => {
    const rt = (() => {
      try { return sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || ''; } catch { return ''; }
    })();
    const csrf = getCookie('csrfToken');
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' },
      credentials: 'include',
      body: JSON.stringify(rt ? { refreshToken: rt } : {})
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    const j = await res.json();
    if (j && j.accessToken) {
      try { sessionStorage.setItem('accessToken', j.accessToken); } catch {}
    }
    if (j && j.refreshToken) {
      try { sessionStorage.setItem('refreshToken', j.refreshToken); } catch {}
      try { localStorage.setItem('refreshToken', j.refreshToken); } catch {}
    }
    bump();
    return true;
  };

  const fmtLeft = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  };

  let warnOpen = false;
  let warnEl = null;
  let warnCountdownEl = null;
  let warnMsgEl = null;
  let warnContinuing = false;
  let graceUntil = 0;
  let lastTickAt = now();
  let lastBumpAt = 0;

  const ensureWarn = () => {
    if (warnEl) return warnEl;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(15, 23, 42, 0.55)';
    overlay.style.zIndex = '9999';

    const panel = document.createElement('div');
    panel.style.width = 'min(420px, calc(100vw - 32px))';
    panel.style.background = '#fff';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 18px 60px rgba(0,0,0,0.25)';
    panel.style.padding = '16px';
    panel.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'セッションの有効期限';
    title.style.fontSize = '16px';
    title.style.fontWeight = '800';
    title.style.marginBottom = '8px';

    const msg = document.createElement('div');
    msg.style.fontSize = '13px';
    msg.style.lineHeight = '1.5';
    msg.style.color = '#0f172a';
    msg.style.marginBottom = '10px';
    warnMsgEl = msg;

    const countdown = document.createElement('div');
    countdown.style.display = 'flex';
    countdown.style.alignItems = 'baseline';
    countdown.style.gap = '8px';
    countdown.style.marginBottom = '12px';
    const lbl = document.createElement('div');
    lbl.textContent = '残り';
    lbl.style.fontSize = '12px';
    lbl.style.color = '#475569';
    const val = document.createElement('div');
    val.style.fontSize = '20px';
    val.style.fontWeight = '900';
    val.style.color = '#0f172a';
    warnCountdownEl = val;
    countdown.appendChild(lbl);
    countdown.appendChild(val);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const btnLogout = document.createElement('button');
    btnLogout.type = 'button';
    btnLogout.textContent = 'ログアウト';
    btnLogout.style.padding = '10px 12px';
    btnLogout.style.borderRadius = '10px';
    btnLogout.style.border = '1px solid #cbd5e1';
    btnLogout.style.background = '#fff';
    btnLogout.style.cursor = 'pointer';
    btnLogout.addEventListener('click', () => { void doLogout(); });

    const btnContinue = document.createElement('button');
    btnContinue.type = 'button';
    btnContinue.textContent = '続行';
    btnContinue.style.padding = '10px 12px';
    btnContinue.style.borderRadius = '10px';
    btnContinue.style.border = '1px solid #1d4ed8';
    btnContinue.style.background = '#2563eb';
    btnContinue.style.color = '#fff';
    btnContinue.style.cursor = 'pointer';
    btnContinue.addEventListener('click', async () => {
      if (warnContinuing) return;
      warnContinuing = true;
      try {
        btnContinue.textContent = '更新中...';
        await refreshSession();
        graceUntil = 0;
        hideWarn();
      } catch {
        void doLogout();
      } finally {
        warnContinuing = false;
        btnContinue.textContent = '続行';
      }
    });

    actions.appendChild(btnLogout);
    actions.appendChild(btnContinue);
    panel.appendChild(title);
    panel.appendChild(msg);
    panel.appendChild(countdown);
    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    warnEl = overlay;
    return warnEl;
  };

  const showWarn = ({ leftMs, reason }) => {
    if (document.visibilityState === 'hidden') return;
    ensureWarn();
    if (warnCountdownEl) warnCountdownEl.textContent = fmtLeft(leftMs);
    if (warnMsgEl) {
      warnMsgEl.textContent = reason === 'wake'
        ? 'しばらく操作がありませんでした。続行する場合は「続行」を押してください。'
        : 'まもなくセッションが終了します。続行する場合は「続行」を押してください。';
    }
    if (warnEl) warnEl.style.display = 'flex';
    warnOpen = true;
  };

  const hideWarn = () => {
    if (!warnOpen) return;
    if (warnEl) warnEl.style.display = 'none';
    warnOpen = false;
  };

  const activityEvents = ['mousemove', 'mousedown', 'pointerdown', 'keydown', 'touchstart', 'scroll', 'click'];
  const onActivity = () => {
    const t = now();
    if ((t - lastBumpAt) < 1000) return;
    lastBumpAt = t;
    bump();
    graceUntil = 0;
    if (warnOpen) hideWarn();
  };
  for (const ev of activityEvents) {
    try { window.addEventListener(ev, onActivity, { passive: true }); } catch {}
  }
  try { document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onActivity(); }); } catch {}
  try { window.addEventListener('focus', onActivity, { passive: true }); } catch {}
  try { window.addEventListener('pageshow', onActivity, { passive: true }); } catch {}
  bump();

  let timer = 0;
  const tick = () => {
    const t = getLastActivity();
    const n = now();
    const idleFor = n - (t || 0);
    const warnAt = IDLE_TIMEOUT_MS - WARNING_MS;
    const slept = (n - lastTickAt) > Math.max(60000, CHECK_MS * 2);
    lastTickAt = n;

    if (!t) return;

    if (idleFor > IDLE_TIMEOUT_MS) {
      if (slept && !graceUntil) graceUntil = n + GRACE_MS;
      if (graceUntil && n < graceUntil) {
        showWarn({ leftMs: Math.max(0, graceUntil - n), reason: 'wake' });
        return;
      }
      void doLogout();
      return;
    }

    if (idleFor > warnAt) {
      showWarn({ leftMs: Math.max(0, IDLE_TIMEOUT_MS - idleFor), reason: 'warn' });
      return;
    }

    if (warnOpen) hideWarn();
  };
  try { timer = window.setInterval(tick, CHECK_MS); } catch {}

  try {
    window.addEventListener('storage', (e) => {
      const k = String((e && e.key) ? e.key : '');
      if (k === FORCE_LOGOUT_KEY) {
        clearClientTokens();
        goLogin();
      }
      if (k === ACTIVITY_KEY) { graceUntil = 0; if (warnOpen) hideWarn(); }
    });
  } catch {}

  const stop = () => {
    try { if (timer) window.clearInterval(timer); } catch {}
    timer = 0;
    for (const ev of activityEvents) {
      try { window.removeEventListener(ev, onActivity); } catch {}
    }
    try { window.removeEventListener('focus', onActivity); } catch {}
    try { window.removeEventListener('pageshow', onActivity); } catch {}
  };

  globalThis.SessionIdle = { bump, stop, doLogout };
})();
