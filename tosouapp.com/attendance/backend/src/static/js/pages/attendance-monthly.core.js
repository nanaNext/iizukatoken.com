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
  // Mark core nav as owner early so HTML fallback does not bind competing handlers.
  try { document.documentElement.dataset.monthlyCoreNavBound = '1'; } catch {}

  let monthlySpinnerDelay = null;
  const showSpinner = (mode = '') => {
    try {
      const el = $('#pageSpinner');
      if (!el) return;
      try {
        if (mode) el.setAttribute('data-mode', String(mode));
        else el.removeAttribute('data-mode');
      } catch {}
      if (monthlySpinnerDelay) clearTimeout(monthlySpinnerDelay);
      monthlySpinnerDelay = setTimeout(() => {
        try { el.removeAttribute('hidden'); } catch {}
        monthlySpinnerDelay = null;
      }, 180);
    } catch {}
  };
  const hideSpinner = () => {
    try {
      const el = $('#pageSpinner');
      if (!el) return;
      if (monthlySpinnerDelay) {
        clearTimeout(monthlySpinnerDelay);
        monthlySpinnerDelay = null;
      }
      try { el.removeAttribute('data-mode'); } catch {}
      el.setAttribute('hidden', '');
    } catch {}
  };

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
  let toastTimer = null;
  const showToast = (msg, kind = 'success') => {
    try {
      const el = $('#kintaiToast');
      if (!el) return;
      const sub = String(msg || '').trim();
      if (kind === 'error') {
        el.style.background = 'rgba(127, 29, 29, 0.9)';
        el.innerHTML = `<span class="sub">${esc(sub || 'エラーが発生しました')}</span>`;
      } else {
        try {
          el.classList.remove('show');
          el.setAttribute('hidden', '');
        } catch {}
        return;
      }
      if (toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }
      el.classList.remove('show');
      el.removeAttribute('hidden');
      // restart css animation
      void el.offsetWidth;
      el.classList.add('show');
      toastTimer = setTimeout(() => {
        try {
          el.classList.remove('show');
          el.setAttribute('hidden', '');
        } catch {}
        toastTimer = null;
      }, 1850);
    } catch {}
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
    const targetEl = (e) => {
      const t = e && e.target;
      if (!t) return null;
      return t.nodeType === 3 ? t.parentElement : t;
    };
    const normalizeNavHref = (href) => {
      const raw = String(href || '').trim();
      if (!raw.startsWith('/')) return raw;
      if (raw.startsWith('/ui/')) return raw;
      if (
        raw.startsWith('/attendance') ||
        raw.startsWith('/leave-ledger') ||
        raw.startsWith('/change-password') ||
        raw.startsWith('/manual') ||
        raw.startsWith('/faq') ||
        raw.startsWith('/logout')
      ) return `/ui${raw}`;
      return raw;
    };
    const ensurePanelLinks = () => {
      const defaults = {
        att: [
          { href: '/ui/attendance', label: '個人カレンダー登録画面' },
          { href: '/ui/attendance/monthly', label: '月次勤怠入力へ' },
          { href: '/ui/attendance/simple', label: '簡易登録画面' }
        ],
        leave: [
          { href: '/ui/leave-ledger', label: '休暇欠勤台帳' }
        ],
        common: [
          { href: '/ui/change-password', label: 'パスワード変更画面' }
        ]
      };
      document.querySelectorAll('.kintai-dd[data-dd-panel]').forEach((panel) => {
        const key = String(panel.getAttribute('data-dd-panel') || '');
        const hasLink = !!panel.querySelector('a[href]');
        if (hasLink) return;
        const rows = defaults[key] || [];
        if (!rows.length) return;
        panel.innerHTML = rows.map((r) => `<a href="${r.href}">${r.label}</a>`).join('');
      });
    };
    try { ensurePanelLinks(); } catch {}
    // Normalize old/cached links that may miss "/ui" prefix on mobile devices.
    try {
      document.querySelectorAll('.kintai-dd[data-dd-panel] a[href^="/"]').forEach((a) => {
        const href = String(a.getAttribute('href') || '').trim();
        const fixed = normalizeNavHref(href);
        if (fixed && fixed !== href) a.setAttribute('href', fixed);
      });
    } catch {}
    const btns = Array.from(document.querySelectorAll('.kintai-nav-btn[data-dd]'));
    const panels = Array.from(document.querySelectorAll('.kintai-dd[data-dd-panel]'));
    if (!btns.length || !panels.length) return;
    try { document.body.classList.add('nav-js'); } catch {}
    try { document.documentElement.dataset.monthlyCoreNavBound = '1'; } catch {}
    try {
      if (document.documentElement.dataset.monthlyCoreNavLinkBound !== '1') {
        document.documentElement.dataset.monthlyCoreNavLinkBound = '1';
        let navGoAt = 0;
        let navGoHref = '';
        const go = (e) => {
          const t = targetEl(e);
          const a = t?.closest?.('.kintai-dd a[href]');
          if (!a) return;
          const fixed = normalizeNavHref(a.getAttribute('href') || '');
          if (!fixed) return;
          const now = Date.now();
          if (now - navGoAt < 800 && fixed === navGoHref) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          navGoAt = now;
          navGoHref = fixed;
          e.preventDefault();
          e.stopPropagation();
          window.location.href = fixed;
        };
        document.addEventListener('pointerup', go, true);
        document.addEventListener('touchend', go, true);
        document.addEventListener('click', go, true);
      }
    } catch {}

    const closeAll = () => {
      for (const b of btns) {
        try { b.setAttribute('aria-expanded', 'false'); } catch {}
      }
      for (const p of panels) {
        try {
          p.setAttribute('hidden', '');
          p.style.display = '';
          p.style.position = '';
          p.style.top = '';
          p.style.left = '';
          p.style.right = '';
          p.style.maxWidth = '';
          p.style.maxHeight = '';
          p.style.overflow = '';
          p.style.zIndex = '';
          p.style.transform = '';
        } catch {}
      }
      document.querySelectorAll('.kintai-nav-dd').forEach(dd => { try { dd.classList.remove('open'); } catch {} });
    };

    const openOne = (key) => {
      try { ensurePanelLinks(); } catch {}
      closeAll();
      const btn = btns.find(b => b.dataset.dd === key);
      const panel = panels.find(p => p.dataset.ddPanel === key);
      if (!btn || !panel) return;
      try { btn.setAttribute('aria-expanded', 'true'); } catch {}
      try { panel.removeAttribute('hidden'); panel.style.display = 'block'; } catch {}
      try { btn.closest('.kintai-nav-dd')?.classList.add('open'); } catch {}
      try {
        const mobile = !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
        if (mobile) {
          const r = btn.getBoundingClientRect();
          const gap = 4;
          const top = Math.round(r.bottom + gap);
          let left = Math.round(r.left);
          panel.style.position = 'fixed';
          panel.style.top = `${top}px`;
          panel.style.left = `${left}px`;
          panel.style.right = 'auto';
          panel.style.zIndex = '5206';
          panel.style.maxWidth = '90vw';
          panel.style.maxHeight = 'calc(100vh - 72px)';
          panel.style.overflow = 'auto';
          try {
            const w = panel.offsetWidth || 0;
            const maxLeft = Math.max(6, (window.innerWidth || 0) - w - 6);
            left = Math.min(left, maxLeft);
            panel.style.left = `${left}px`;
          } catch {}
          try { panel.style.transform = 'none'; } catch {}
        } else {
          panel.style.position = '';
          panel.style.left = '';
          panel.style.top = '';
          panel.style.right = '';
          panel.style.maxWidth = '';
          panel.style.maxHeight = '';
          panel.style.overflow = '';
          panel.style.zIndex = '';
          panel.style.transform = '';
        }
      } catch {}
    };

    for (const b of btns) {
      let lastTouchLikeAt = 0;
      const toggle = (e) => {
        e.preventDefault();
        const key = b.dataset.dd;
        const panel = panels.find(p => p.dataset.ddPanel === key);
        const isOpen = panel && !panel.hasAttribute('hidden');
        if (isOpen) closeAll();
        else openOne(key);
      };
      const onTouchLike = (e) => {
        lastTouchLikeAt = Date.now();
        toggle(e);
      };
      const onClick = (e) => {
        if (Date.now() - lastTouchLikeAt < 700) {
          e.preventDefault();
          return;
        }
        toggle(e);
      };
      if ('PointerEvent' in window) b.addEventListener('pointerdown', onTouchLike, { passive: false });
      else b.addEventListener('touchstart', onTouchLike, { passive: false });
      b.addEventListener('click', onClick, { passive: false });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') toggle(e);
      }, { passive: false });
    }

    document.addEventListener('click', (e) => {
      const t = targetEl(e);
      if (t?.closest?.('.kintai-nav-dd')) return;
      closeAll();
    });
  };

  // Bind top nav independently so dropdown still works even if later boot steps fail.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { wireTopNavDropdowns(); } catch {}
    }, { once: true });
  } else {
    try { wireTopNavDropdowns(); } catch {}
  }

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
    showToast,
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
