import { logout } from '../../api/auth.api.js';

let _topbarH = 64;
let _raf = null;
let _measureDisabled = false;

export const isMobile = () => (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;

export function setTopbarHeightVar() {
  try {
    if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const rect = topbar.getBoundingClientRect();
    let h = Math.round(rect && rect.height ? rect.height : 64);
    if (!(h > 40 && h < 200)) {
      const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 64;
      h = Math.min(120, Math.max(48, cur));
    }
    if (_topbarH !== h) {
      _topbarH = h;
      document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    }
  } catch { }
}

export function scheduleTopbarMeasure() {
  if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
  if (_raf) return;
  _raf = requestAnimationFrame(() => {
    _raf = null;
    setTopbarHeightVar();
  });
}

export function initLayout() {
  if (isMobile()) {
    _measureDisabled = true;
    try {
      const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 56;
      document.documentElement.style.setProperty('--topbar-height', `${Math.min(120, Math.max(48, cur))}px`);
    } catch { }
  } else {
    scheduleTopbarMeasure();
  }
  window.addEventListener('resize', scheduleTopbarMeasure);
  try {
    const tb = document.querySelector('.topbar');
    if (tb && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        scheduleTopbarMeasure();
      });
      ro.observe(tb);
    }
  } catch { }

  // Brand click
  try {
    const brand = document.querySelector('.topbar .brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', (e) => {
        const t = e && e.target;
        const skip = (t && t.closest) ? t.closest('.brand-tabs, .brand-menu, .brand-select') : null;
        if (skip) return;
        e.preventDefault();
        window.location.href = '/ui/portal';
      });
    }
  } catch { }

  // Logout nav
  try {
    const logoutBtn = document.querySelector('#nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await logout(); } catch { }
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch { }
        window.location.replace('/ui/login');
      });
    }
  } catch { }

  // User Dropdown
  const userBtn = document.querySelector('.user .user-btn');
  const dropdown = document.querySelector('#userDropdown');
  if (userBtn && dropdown) {
    const firstChar = (s) => {
      try {
        const t = String(s || '').trim();
        if (!t) return '';
        const arr = Array.from(t);
        return arr.length ? arr[0] : '';
      } catch { return ''; }
    };
    const setInitials = () => {
      try {
        const nameEl = document.querySelector('#userName');
        const ddName = document.querySelector('#userDropdownName');
        const ddInit = document.querySelector('#userInitial');
        const btnInit = document.querySelector('#userBtnInitial');
        let uname = '';
        try {
          const u = JSON.parse(sessionStorage.getItem('user') || localStorage.getItem('user') || 'null');
          uname = (u?.username || '').trim();
        } catch {}
        const full = uname || (nameEl?.textContent || '').trim() || (window.userName || '');
        const ch = firstChar(full);
        if (ddName) ddName.textContent = full || ddName.textContent || '';
        if (ddInit) { ddInit.textContent = ''; ddInit.setAttribute('data-initial', ch); }
        if (btnInit) { btnInit.textContent = ''; btnInit.setAttribute('data-initial', ch); }
      } catch {}
    };
    setInitials();
    try {
      const nameEl = document.querySelector('#userName');
      if (nameEl && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(() => setInitials());
        mo.observe(nameEl, { characterData: true, subtree: true, childList: true });
      }
    } catch {}
    (async () => {
      try {
        const ddInit = document.querySelector('#userInitial');
        const btnInit = document.querySelector('#userBtnInitial');
        const nameEl = document.querySelector('#userName');
        const has = (ddInit && ddInit.textContent) || (btnInit && btnInit.textContent);
        const hasName = (nameEl && nameEl.textContent && nameEl.textContent.trim().length > 0);
        if (has && hasName) return;
        const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).catch(() => null);
        if (!res || !res.ok) return;
        const p = await res.json().catch(() => null);
        const uname = String(p?.username || '').trim();
        const email = String(p?.email || '').trim();
        const full = uname || email || '';
        const ch = firstChar(full);
        try { sessionStorage.setItem('user', JSON.stringify(p)); } catch {}
        if (nameEl && full && !hasName) nameEl.textContent = full;
        if (ddInit) { ddInit.textContent = ''; ddInit.setAttribute('data-initial', ch); }
        if (btnInit) { btnInit.textContent = ''; btnInit.setAttribute('data-initial', ch); }
      } catch {}
    })();
    // Final retry loop (up to ~1.5s) to ensure initials appear even with late DOM paints
    try {
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        setInitials();
        if (tries >= 6) clearInterval(timer);
      }, 250);
    } catch {}
    document.addEventListener('click', (e) => {
      const insideAnyUser = e.target && e.target.closest ? e.target.closest('.user') : null;
      if (insideAnyUser) return;
      try {
        document.querySelectorAll('.user .dropdown').forEach((dd) => dd.setAttribute('hidden', ''));
        document.querySelectorAll('.user .user-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      } catch {}
    });
    const btnLogout = document.querySelector('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try { await logout(); } catch { }
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.replace('/ui/login');
      });
    }
    const items = dropdown.querySelectorAll('.item, a, button');
    items.forEach(el => {
      el.addEventListener('click', () => {
        try {
          const root = el.closest('.user');
          const dd = root ? root.querySelector('.dropdown') : dropdown;
          const b = root ? root.querySelector('.user-btn') : userBtn;
          if (dd) dd.setAttribute('hidden', '');
          if (b) b.setAttribute('aria-expanded', 'false');
        } catch {}
      });
    });
    const applyTheme = (val) => {
      if (val === 'system' || val === '') {
        try { document.documentElement.removeAttribute('data-theme'); } catch {}
      } else {
        document.documentElement.dataset.theme = val;
      }
      try { localStorage.setItem('theme', val); } catch {}
      Array.from(document.querySelectorAll('#themeDropdown .theme-item')).forEach(el => {
        const v = el.getAttribute('data-value') || '';
        if (v === val) el.classList.add('sel');
        else el.classList.remove('sel');
      });
    };
    const initTheme = () => {
      let v = 'system';
      try { v = (localStorage.getItem('theme') || 'system'); } catch {}
      applyTheme(v);
    };
    initTheme();
    // Delegated handlers to survive dynamic page changes
    document.addEventListener('click', (e) => {
      const t = e.target.closest ? e.target.closest('#btnTheme') : null;
      if (t) {
        const themeDrop = document.querySelector('#themeDropdown');
        e.preventDefault();
        e.stopPropagation();
        if (themeDrop) themeDrop.removeAttribute('hidden');
      }
      const back = e.target.closest ? e.target.closest('#themeBack') : null;
      if (back) {
        const themeDrop = document.querySelector('#themeDropdown');
        e.preventDefault();
        if (themeDrop) themeDrop.setAttribute('hidden', '');
      }
      const item = e.target.closest ? e.target.closest('.theme-item') : null;
      const themeDrop2 = document.querySelector('#themeDropdown');
      if (item && themeDrop2 && themeDrop2.contains(item)) {
        e.preventDefault();
        const v = item.getAttribute('data-value') || 'system';
        applyTheme(v);
      }
    });
  }

  // Delegated user menu toggle to ensure it works after dynamic page changes
  document.addEventListener('click', (e) => {
    const ub = e.target && e.target.closest ? e.target.closest('.user .user-btn') : null;
    if (!ub) return;
    e.preventDefault();
    e.stopPropagation();
    const root = ub.closest('.user');
    const dd = root ? root.querySelector('.dropdown') : null;
    if (!dd) return;
    try {
      document.querySelectorAll('.user .dropdown').forEach((el) => { if (el !== dd) el.setAttribute('hidden', ''); });
      document.querySelectorAll('.user .user-btn').forEach((el) => { if (el !== ub) el.setAttribute('aria-expanded', 'false'); });
    } catch {}
    const hidden = dd.hasAttribute('hidden');
    if (hidden) {
      dd.removeAttribute('hidden');
      try { ub.setAttribute('aria-expanded', 'true'); } catch {}
      const firstItem = dd.querySelector('.item, a, button');
      if (firstItem && typeof firstItem.focus === 'function') {
        try { firstItem.focus(); } catch {}
      }
    } else {
      dd.setAttribute('hidden', '');
      try { ub.setAttribute('aria-expanded', 'false'); } catch {}
    }
  });

  // Mobile Drawer
  const mobileBtn = document.querySelector('#mobileMenuBtn');
  const mobileDrawer = document.querySelector('#mobileDrawer');
  const mobileClose = document.querySelector('#mobileClose');
  const mobileBackdrop = document.querySelector('#drawerBackdrop');
  const normalizeDrawerState = () => {
    try {
      const desktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 481px)').matches;
      const hidden = !mobileDrawer || mobileDrawer.hasAttribute('hidden');
      if (desktop || hidden) {
        document.body.classList.remove('drawer-open');
        if (mobileDrawer) mobileDrawer.setAttribute('hidden', '');
        if (mobileBackdrop) mobileBackdrop.setAttribute('hidden', '');
        if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
      }
    } catch {}
  };
  normalizeDrawerState();
  if (mobileBtn && mobileDrawer) {
    const toggleDrawer = (open) => {
      const isHidden = mobileDrawer.hasAttribute('hidden');
      const shouldOpen = typeof open === 'boolean' ? open : isHidden;
      if (shouldOpen) {
        mobileDrawer.removeAttribute('hidden');
        mobileBtn.setAttribute('aria-expanded', 'true');
        try {
          const w = Math.round(mobileDrawer.getBoundingClientRect().width || 280);
          document.documentElement.style.setProperty('--drawer-offset', `${w}px`);
          document.body.classList.add('drawer-open');
        } catch { }
        if (mobileBackdrop) { mobileBackdrop.removeAttribute('hidden'); }
      } else {
        mobileDrawer.setAttribute('hidden', '');
        mobileBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        if (mobileBackdrop) { mobileBackdrop.setAttribute('hidden', ''); }
      }
    };
    mobileBtn.addEventListener('click', () => toggleDrawer());
    if (mobileClose) mobileClose.addEventListener('click', () => toggleDrawer(false));
  }
  if (mobileBackdrop) mobileBackdrop.addEventListener('click', () => {
    try {
      if (mobileDrawer) mobileDrawer.setAttribute('hidden', '');
      mobileBackdrop.setAttribute('hidden', '');
      if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('drawer-open');
    } catch {}
  });
  window.addEventListener('pageshow', normalizeDrawerState);
  window.addEventListener('resize', normalizeDrawerState);

  // Link interceptor
  document.addEventListener('click', (e) => {
    const t = e && e.target;
    const a = (t && t.closest) ? t.closest('a') : null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/ui/portal') || href.startsWith('/ui/admin?')) {
      const now = new URL(location.href);
      const target = new URL(href, location.origin);
      const nowTab = new URLSearchParams(now.search).get('tab') || (now.pathname.startsWith('/ui/employees') ? 'employees' : '');
      const targetTab = new URLSearchParams(target.search).get('tab') || (target.pathname.startsWith('/ui/employees') ? 'employees' : '');
      const samePath = target.pathname === now.pathname;
      const onlyHashChange = samePath && nowTab === targetTab && target.hash !== now.hash;
      if (!onlyHashChange && nowTab !== targetTab) {
        try { sessionStorage.setItem('navSpinner', '1'); } catch { }
        showNavSpinner();
      }
      if (a.classList.contains('tile')) {
        e.preventDefault();
        setTimeout(() => { window.location.href = href; }, 600);
      }
    }
  });

  // Global page-transition spinner for internal navigation links/forms.
  if (!window.__globalNavSpinnerBound) {
    window.__globalNavSpinnerBound = true;
    let spinnerHideTimer = null;
    let spinnerShowTimer = null;
    const shouldShowForAnchor = (a, e) => {
      if (!a) return false;
      if (a.dataset?.noNavSpinner === '1') return false;
      if (a.hasAttribute('download')) return false;
      const target = String(a.getAttribute('target') || '').toLowerCase();
      if (target && target !== '_self') return false;
      if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return false;
      const href = String(a.getAttribute('href') || '').trim();
      if (!href || href === '#' || href.startsWith('#')) return false;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
      let to = null;
      try { to = new URL(href, location.href); } catch { return false; }
      if (to.origin !== location.origin) return false;
      if (to.pathname === location.pathname && to.search === location.search && (to.hash || '') === (location.hash || '')) return false;
      if (to.pathname === location.pathname && to.search === location.search && to.hash && to.hash !== location.hash) return false;
      return true;
    };
    const showWithAutoHide = (delayMs = 420) => {
      try {
        if (spinnerShowTimer) clearTimeout(spinnerShowTimer);
        spinnerShowTimer = setTimeout(() => showNavSpinner(), Math.max(0, Number(delayMs) || 0));
      } catch {
        showNavSpinner();
      }
      try {
        if (spinnerHideTimer) clearTimeout(spinnerHideTimer);
        spinnerHideTimer = setTimeout(() => hideNavSpinner(), 10000);
      } catch {}
    };
    document.addEventListener('click', (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!shouldShowForAnchor(a, e)) return;
      showWithAutoHide();
    }, true);
    window.addEventListener('pageshow', () => {
      try { if (spinnerShowTimer) clearTimeout(spinnerShowTimer); } catch {}
      hideNavSpinner();
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('.subbar .menu .menu-btn') : null;
    if (btn) {
      e.preventDefault();
      const menu = btn.closest('.menu');
      const open = menu.classList.contains('open');
      document.querySelectorAll('.subbar .menu.open').forEach(m => { if (m !== menu) m.classList.remove('open'); });
      if (open) menu.classList.remove('open'); else menu.classList.add('open');
      return;
    }
    const inside = e.target && e.target.closest ? e.target.closest('.subbar .menu') : null;
    if (!inside) {
      document.querySelectorAll('.subbar .menu.open').forEach(m => m.classList.remove('open'));
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.subbar .menu.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Re-check mobile sizing
  if (isMobile()) {
    _measureDisabled = true;
    try { window.removeEventListener('resize', scheduleTopbarMeasure); } catch { }
    document.documentElement.style.setProperty('--topbar-height', `${Math.min(60, Math.max(48, _topbarH))}px`);
  } else {
    _measureDisabled = false;
    try { window.addEventListener('resize', scheduleTopbarMeasure); } catch { }
  }
}

export function setSidebarActive(t) {
  try {
    const map = {
      employees: '#nav-employees',
      dbcheck: '#nav-dbcheck',
      users: '#nav-users',
      departments: '#nav-departments',
      attendance: '#nav-attendance',
      approvals: '#nav-approvals',
      reports: '#nav-reports',
      settings: '#nav-settings',
      audit: '#nav-audit',
      refresh: '#nav-refresh',
      calendar: '#nav-calendar',
      shifts: '#nav-shifts',
      routes: '#nav-routes'
    };
    const sel = map[t];
    if (sel) {
      document.querySelectorAll('.sidebar .sidebar-nav a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(sel);
      if (link) link.classList.add('active');
    }
  } catch { }
}

export const showNavSpinner = () => {
  try {
    try { sessionStorage.setItem('navSpinner', '1'); } catch { }
    let el = document.querySelector('#pageSpinner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pageSpinner';
      el.className = 'page-spinner';
      el.innerHTML = '<div class="lds-spinner" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.background = 'transparent';
      el.style.display = 'grid';
      el.style.placeItems = 'center';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '9999';
      document.body.appendChild(el);
    } else {
      el.removeAttribute('hidden');
      el.style.background = 'transparent';
      el.style.display = 'grid';
      el.style.pointerEvents = 'none';
    }
  } catch { }
};

export const hideNavSpinner = () => {
  try {
    try { sessionStorage.removeItem('navSpinner'); } catch { }
    const el = document.querySelector('#pageSpinner');
    if (el) {
      el.setAttribute('hidden', 'true');
      el.style.display = 'none';
    }
  } catch { }
};

export function ensureSpinnerStyle() {
  try {
    if (!document.querySelector('#spinnerStyle')) {
      const style = document.createElement('style');
      style.id = 'spinnerStyle';
      style.textContent = `
        .page-spinner{background:transparent;display:grid;place-items:center;pointer-events:none}
        .dot-spinner{position:relative;width:64px;height:64px}
        .dot-spinner div{position:absolute;top:50%;left:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#666;opacity:.2;animation:dotfade 1s linear infinite}
        @keyframes dotfade{0%{opacity:1}100%{opacity:.2}}
        .dot-spinner div:nth-child(1){transform:rotate(0deg) translate(24px);animation-delay:-0.92s}
        .dot-spinner div:nth-child(2){transform:rotate(30deg) translate(24px);animation-delay:-0.84s}
        .dot-spinner div:nth-child(3){transform:rotate(60deg) translate(24px);animation-delay:-0.76s}
        .dot-spinner div:nth-child(4){transform:rotate(90deg) translate(24px);animation-delay:-0.68s}
        .dot-spinner div:nth-child(5){transform:rotate(120deg) translate(24px);animation-delay:-0.60s}
        .dot-spinner div:nth-child(6){transform:rotate(150deg) translate(24px);animation-delay:-0.52s}
        .dot-spinner div:nth-child(7){transform:rotate(180deg) translate(24px);animation-delay:-0.44s}
        .dot-spinner div:nth-child(8){transform:rotate(210deg) translate(24px);animation-delay:-0.36s}
        .dot-spinner div:nth-child(9){transform:rotate(240deg) translate(24px);animation-delay:-0.28s}
        .dot-spinner div:nth-child(10){transform:rotate(270deg) translate(24px);animation-delay:-0.20s}
        .dot-spinner div:nth-child(11){transform:rotate(300deg) translate(24px);animation-delay:-0.12s}
        .dot-spinner div:nth-child(12){transform:rotate(330deg) translate(24px);animation-delay:-0.04s}
      `;
      document.head.appendChild(style);
    }
  } catch { }
}

export function ensureJapanSafeColorsStyle() {
  try {
    if (!document.querySelector('#jpSafeColors')) {
      const style = document.createElement('style');
      style.id = 'jpSafeColors';
      style.textContent = `
        .emp-action.danger { background: #eef2ff !important; border-color: #c7d2fe !important; color: #1e40af !important; }
        .emp-action.danger:hover { background: #e0e7ff !important; border-color: #a5b4fc !important; }
        .btn-danger { background: #2b6cb0 !important; border-color: #1e4e8c !important; color: #fff !important; }
        .status-pill.inactive { background: #eef2ff !important; color: #1e40af !important; border-color: #c7d2fe !important; }
        .excel-header {
          display: inline-block;
          margin: 8px 0 12px;
          padding: 0;
          background: transparent;
          color: #0d2c5b;
          font-weight: 700;
          font-size: 16px;
          line-height: 1.35;
          letter-spacing: .02em;
          border: none;
          border-radius: 0;
        }
      `;
      document.head.appendChild(style);
    }
  } catch { }
}

export function ensureEmployeePillStyle() {
  try {
    if (!document.querySelector('#empPillStyle')) {
      const style = document.createElement('style');
      style.id = 'empPillStyle';
      style.textContent = `
        .admin .card { --emp-pill-width: max-content; }
        .admin .card table#list { width: 100%; }
        .admin.employees-wide .card table#list:not(.emp-del-list) thead { position: static; }
        .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead { position: static; }
        .admin.employees-wide .card table#list:not(.emp-del-list) thead th { position: static; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
        .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead th { position: static; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
        .admin .card table#list.emp-del-list thead th { position: static; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
        .admin .card table#list tbody td .text-pill,
        .admin .card table#list tbody td .status-pill,
        .admin .card table#list tbody td .role-pill,
        .admin .card table#list tbody td .type-pill { width: var(--emp-pill-width); box-sizing: border-box; }
        .admin .card table#list tbody td.col-code .text-pill { width: max-content; }
        .admin .card table#list tbody td .status-pill { min-height: 32px; padding: 4px 14px; line-height: 1.2; }
        .admin .card table#list tbody td .role-pill { min-height: 32px; padding: 4px 14px; line-height: 1.2; }
        .admin .card table#list tbody td .type-pill { min-height: 32px; padding: 4px 14px; line-height: 1.2; }
        .admin .card table#list tbody tr.emp-row.inactive td { background: #fff7ed; }
        .admin .card table#list tbody tr.emp-row.inactive td { color: #7c2d12; }
        .admin .card table#list tbody tr.emp-row.inactive td { border-top-color: #fdba74; border-bottom-color: #fdba74; }
        .admin .card table#list tbody tr.emp-row.inactive td:first-child { border-left-color: #fb923c; }
        .admin .card table#list tbody tr.emp-row.inactive td:last-child { border-right-color: #fb923c; }
        .admin .card table#list tbody tr.emp-row.inactive td .text-pill { background: #ffedd5; border-color: #fdba74; color: #7c2d12; }
        .admin .card table#list tbody tr.emp-row.inactive td .text-pill a { color: inherit; }
        .admin .card table#list tbody tr.emp-row.retired td { background: #f8fafc; color: #475569; }
        @media (max-width: 640px) {
          .admin.employees-wide .card table#list:not(.emp-del-list) thead,
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead,
          .admin.employees-wide .card table#list:not(.emp-del-list) thead th,
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead th {
            top: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  } catch { }
}
