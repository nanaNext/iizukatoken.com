(function () {
  const root = globalThis.AttendanceMonthly || {};
  const ns = root.Core || globalThis.MonthlyMonthlyCore || {};
  const state = root.State || globalThis.MonthlyMonthlyState || {
    dirty: false,
    editableMonth: true,
    currentMonthStatus: 'draft',
    currentViewingUserId: '',
    currentYM: '',
    currentMonthDetail: null,
    currentMonthTimesheet: null
  };

  const $ = (sel) => document.querySelector(sel);

  try { globalThis.__monthlyBooted = Date.now(); } catch {}

  const showSpinner = () => { try { $('#pageSpinner')?.removeAttribute('hidden'); } catch {} };
  const hideSpinner = () => { try { $('#pageSpinner')?.setAttribute('hidden', ''); } catch {} };

  const MonthlyAuth = globalThis.MonthlyAuth || {};
  const fetchJSONAuth = MonthlyAuth.fetchJSONAuth;
  const downloadWithAuth = MonthlyAuth.downloadWithAuth;
  const ensureAuthProfile = MonthlyAuth.ensureAuthProfile;
  const logout = MonthlyAuth.logout;

  const cssEscape = (s) => {
    try {
      if (globalThis.CSS && typeof globalThis.CSS.escape === 'function') return globalThis.CSS.escape(String(s));
    } catch {}
    return String(s).replace(/[\"\\]/g, '\\$&');
  };

  const makeClientId = () => {
    try {
      const c = globalThis.crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    } catch {}
    return 'cid_' + Date.now() + '_' + Math.random().toString(16).slice(2);
  };

  const showErr = (msg) => {
    const el = $('#error');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = 'block';
    el.textContent = msg;
  };

  const setDirty = () => {
    state.dirty = true;
    window.onbeforeunload = (e) => {
      try { e.preventDefault(); } catch {}
      const msg = '確定されていない内容は失われます。よろしいですか？';
      try { e.returnValue = msg; } catch {}
      return msg;
    };
  };
  const clearDirty = () => {
    state.dirty = false;
    window.onbeforeunload = null;
  };

  const getPinMonthHeadMode = () => {
    return 'bottom';
  };
  const setPinMonthHeadMode = (mode) => {
    void mode;
  };

  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');

  const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const monthJST = () => todayJST().slice(0, 7);
  if (!state.currentYM) state.currentYM = monthJST();

  const monthIndex = (s) => {
    const v = String(s || '').slice(0, 7);
    const parts = v.split('-');
    if (parts.length !== 2) return NaN;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return NaN;
    return y * 12 + (m - 1);
  };

  const isFutureMonth = (ym) => {
    const baseIdx = monthIndex(monthJST());
    const targetIdx = monthIndex(ym);
    if (!Number.isFinite(baseIdx) || !Number.isFinite(targetIdx)) return false;
    return targetIdx > baseIdx;
  };

  const wireUserMenu = () => {
    const btn = $('#userBtn');
    const menu = $('#userMenu');
    if (!btn || !menu) return;
    const doLogout = async () => {
      try { await logout(); } catch {}
      try { sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('user'); } catch {}
      try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
      window.location.replace('/ui/login');
    };
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const open = !menu.hasAttribute('hidden');
      if (open) { menu.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
      else { menu.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
    });
    document.addEventListener('click', (e) => {
      if (e.target?.closest?.('#userBtn') || e.target?.closest?.('#userMenu')) return;
      try { menu.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); } catch {}
    });
    $('#btnLogout')?.addEventListener('click', doLogout);
    document.querySelectorAll('[data-action=\"logout\"]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); doLogout(); });
    });
  };

  const wireTopNavDropdowns = () => {
    const btns = Array.from(document.querySelectorAll('.kintai-nav-btn[data-dd]'));
    const panels = Array.from(document.querySelectorAll('.kintai-dd[data-dd-panel]'));
    if (!btns.length || !panels.length) return;
    try { document.body.classList.add('nav-js'); } catch {}

    const closeAll = () => {
      for (const b of btns) { try { b.setAttribute('aria-expanded', 'false'); } catch {} }
      for (const p of panels) { try { p.setAttribute('hidden', ''); p.style.display = ''; } catch {} }
      document.querySelectorAll('.kintai-nav-dd').forEach(dd => { try { dd.classList.remove('open'); } catch {} });
    };
    const openOne = (key) => {
      closeAll();
      const btn = btns.find(b => b.dataset.dd === key);
      const panel = panels.find(p => p.dataset.ddPanel === key);
      if (!btn || !panel) return;
      try { btn.setAttribute('aria-expanded', 'true'); } catch {}
      try { panel.removeAttribute('hidden'); panel.style.display = 'block'; } catch {}
      try { btn.closest('.kintai-nav-dd')?.classList.add('open'); } catch {}
    try {
      panel.style.position = '';
      panel.style.left = '';
      panel.style.top = '';
      panel.style.maxWidth = '';
      panel.style.width = '';
    } catch {}
    };
    for (const b of btns) {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        const key = b.dataset.dd;
        const panel = panels.find(p => p.dataset.ddPanel === key);
        const isOpen = panel && !panel.hasAttribute('hidden');
        if (isOpen) closeAll();
        else openOne(key);
      });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const key = b.dataset.dd;
        const panel = panels.find(p => p.dataset.ddPanel === key);
        const isOpen = panel && !panel.hasAttribute('hidden');
        if (isOpen) closeAll();
        else openOne(key);
      }, { passive: false });
      b.addEventListener('touchend', (e) => {
        e.preventDefault();
        const key = b.dataset.dd;
        const panel = panels.find(p => p.dataset.ddPanel === key);
        const isOpen = panel && !panel.hasAttribute('hidden');
        if (isOpen) closeAll();
        else openOne(key);
      }, { passive: false });
    }
    document.addEventListener('click', (e) => {
      if (e.target?.closest?.('.kintai-nav-dd')) return;
      closeAll();
    });
  };

  const addMonths = (ym, delta) => {
    const [y0, m0] = String(ym).split('-').map(x => parseInt(x, 10));
    if (!y0 || !m0) return monthJST();
    const dt = new Date(Date.UTC(y0, m0 - 1 + delta, 1, 0, 0, 0));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
  };

  const dowJa = (dateStr) => {
    try {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
    } catch {
      return '';
    }
  };

  const toDateTime = (dateStr, hhmm) => {
    const t = String(hhmm || '').trim();
    if (!t) return null;
    const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    const hh = m[1].padStart(2, '0');
    const mm = m[2];
    return `${String(dateStr).slice(0, 10)} ${hh}:${mm}:00`;
  };

  const addDaysISO = (dateStr, days) => {
    try {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
      const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + Number(days || 0)));
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(dt.getUTCDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    } catch {
      return String(dateStr).slice(0, 10);
    }
  };

  const parseHm = (hhmm) => {
    const s = String(hhmm || '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
    const parts = s.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const diffMinutesAllowOvernight = (inHm, outHm) => {
    const a = parseHm(inHm);
    const b = parseHm(outHm);
    if (a == null || b == null) return null;
    if (a === b) return 0;
    return b > a ? (b - a) : (b + 24 * 60 - a);
  };

  const fmtHm = (min) => {
    const m = Math.max(0, Number(min || 0));
    const h = Math.floor(m / 60);
    const mm = Math.floor(m % 60);
    return `${String(h)}:${pad2(mm)}`;
  };

  const fmtWorkHours = (checkInHm, checkOutHm, breakMin) => {
    const raw = diffMinutesAllowOvernight(checkInHm, checkOutHm);
    if (raw == null || raw <= 0) return null;
    const net = Math.max(0, raw - Math.max(0, Number(breakMin || 0)));
    return net > 0 ? fmtHm(net) : '0:00';
  };

  const fromDateTime = (dt) => {
    const s = String(dt || '');
    return s.length >= 16 ? s.slice(11, 16) : '';
  };

  const workTypeLabel = (wt) => wt === 'onsite' ? '出社' : wt === 'remote' ? '在宅' : wt === 'satellite' ? '現場・出張' : '';

  const computeStatus = (kubun, isOff, seg, planned = false) => {
    const k = String(kubun || '').trim();
    if (planned) return { text: k ? `予定${k}` : '予定', cls: 'plan' };
    if (!seg?.checkIn && !seg?.checkOut) {
      const text = k || (isOff ? '休日' : '出勤');
      const cls = text === '休日' ? 'off' : 'warn';
      return { text, cls };
    }
    if (seg?.checkIn && !seg?.checkOut) return { text: k ? `${k}中` : (isOff ? '休日出勤中' : '出勤中'), cls: 'warn' };
    if (seg?.checkIn && seg?.checkOut) return { text: k || (isOff ? '休日出勤' : '出勤'), cls: 'ok' };
    return { text: k ? `予定${k}` : '予定', cls: 'plan' };
  };

  Object.assign(ns, {
    $,
    showSpinner,
    hideSpinner,
    fetchJSONAuth,
    downloadWithAuth,
    ensureAuthProfile,
    logout,
    cssEscape,
    makeClientId,
    showErr,
    setDirty,
    clearDirty,
    getPinMonthHeadMode,
    setPinMonthHeadMode,
    esc,
    pad2,
    todayJST,
    monthJST,
    monthIndex,
    isFutureMonth,
    wireUserMenu,
    wireTopNavDropdowns,
    addMonths,
    dowJa,
    toDateTime,
    addDaysISO,
    parseHm,
    diffMinutesAllowOvernight,
    fmtHm,
    fmtWorkHours,
    fromDateTime,
    workTypeLabel,
    computeStatus
  });

  root.Core = ns;
  root.State = state;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlyCore = ns;
  globalThis.MonthlyMonthlyState = state;
})();
