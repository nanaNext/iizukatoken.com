import { logout } from '../api/auth.api.js';
import { wireAdminShell } from '../shell/admin-shell.js?v=navy-20260418-menuhotfix27';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

let lastRenderErr = null;
let globalErrShown = false;
try {
  window.addEventListener('error', (ev) => {
    if (globalErrShown) return;
    if (!lastRenderErr) return;
    try {
      globalErrShown = true;
      const file = String((ev && ev.filename) ? ev.filename : '');
      const line = Number((ev && ev.lineno) ? ev.lineno : 0) || 0;
      const col = Number((ev && ev.colno) ? ev.colno : 0) || 0;
      const loc = file ? `${file}${line ? `:${line}` : ''}${col ? `:${col}` : ''}` : '';
      const baseMsg = String((ev && ev.message) ? ev.message : 'Unknown error');
      const err = (ev && ev.error) ? ev.error : new Error(baseMsg);
      if (loc && !String(err.message || '').includes(loc)) {
        err.message = String(err.message || baseMsg) + `\n@ ${loc}`;
      }
      lastRenderErr(err);
    } catch {}
  });
  window.addEventListener('unhandledrejection', (ev) => {
    if (globalErrShown) return;
    if (!lastRenderErr) return;
    try {
      globalErrShown = true;
      const r = ev ? ev.reason : null;
      const err = r instanceof Error ? r : new Error(String(r || 'Unhandled rejection'));
      lastRenderErr(err);
    } catch {}
  });
} catch {}

const toLegacyState = (path) => {
  const p = normalizePath(path);
  if (p === '/admin' || p === '/admin/dashboard') return { tab: null, hash: '' };

  if (p === '/admin/employees') return { tab: 'employees', hash: '#list' };
  if (p === '/admin/employees/add') return { tab: 'employees', hash: '#add' };
  if (p === '/admin/employees/change-requests') return { tab: 'approvals', hash: '' };

  if (p === '/admin/attendance') return { tab: 'attendance', hash: '' };
  if (p === '/admin/attendance/monthly') return { redirect: '/ui/attendance/monthly' };
  if (p === '/admin/attendance/shifts') return { tab: 'shifts', hash: '' };
  if (p === '/admin/attendance/shift-assignment') return { tab: 'shifts', hash: '' };
  if (p === '/admin/attendance/adjust-requests') return { redirect: '/admin-attendance-adjust-requests.html' };
  if (p === '/admin/attendance/holidays') return { tab: 'calendar', hash: '' };

  if (p === '/admin/leave/requests') return { tab: 'approvals', hash: '' };
  if (p === '/admin/leave/grants') return { tab: 'leave_grant', hash: '' };
  if (p === '/admin/leave/balance') return { tab: 'leave_balance', hash: '' };

  if (p === '/admin/payroll/salary') return { tab: 'salary_list', hash: '' };
  if (p === '/admin/payroll/payslips') return { tab: 'salary_send', hash: '' };

  if (p === '/admin/departments' || p === '/admin/organization/departments') return { tab: 'departments', hash: '' };

  if (p === '/admin/chatbot/faq') return { redirect: '/ui/chatbot' };
  if (p === '/admin/chatbot/categories') return { redirect: '/ui/chatbot' };
  if (p === '/admin/chatbot/user-questions') return { redirect: '/ui/chatbot' };

  if (p === '/admin/system/settings') return { tab: 'settings', hash: '' };
  if (p === '/admin/system/audit-logs') return { tab: 'audit', hash: '' };

  return null;
};

const syncUrlState = () => {
  const state = toLegacyState(window.location.pathname);
  if (!state) return;
  if (state.redirect) {
    try { window.location.assign(state.redirect); } catch { window.location.href = state.redirect; }
    return;
  }

  const url = new URL(window.location.href);
  if (state.tab) url.searchParams.set('tab', state.tab);
  else url.searchParams.delete('tab');
  url.hash = state.hash || '';
  try { history.replaceState(null, '', url.pathname + url.search + url.hash); } catch {}
};

const markActiveNav = () => {
  try {
    const p = normalizePath(window.location.pathname);
    const links = [
      ...Array.from(document.querySelectorAll('.sidebar .sidebar-nav a[href]')),
      ...Array.from(document.querySelectorAll('.subbar .subnav a[href]')),
    ];
    let best = null;
    let bestLen = -1;
    for (const a of links) {
      const href = normalizePath(a.getAttribute('href'));
      if (!href || href === '/') continue;
      if (p === href) {
        const len = href.length + 10000;
        if (len > bestLen) { best = a; bestLen = len; }
        continue;
      }
      if (href !== '/admin/dashboard' && p.startsWith(href + '/')) {
        const len = href.length;
        if (len > bestLen) { best = a; bestLen = len; }
      }
    }
    for (const a of links) {
      a.classList.toggle('active', a === best);
      try {
        if (a === best) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      } catch {}
    }

    // Also highlight top-level menu buttons when any of their submenu links match current path
    try {
      const menus = Array.from(document.querySelectorAll('.subbar .menu'));
      let bestMenu = null;
      let bestMenuLen = -1;
      for (const m of menus) {
        const btn = m.querySelector('.menu-btn');
        const as = Array.from(m.querySelectorAll('.submenu a[href]'));
        for (const a of as) {
          const href = normalizePath(a.getAttribute('href') || '');
          if (!href || href === '/') continue;
          if (p === href || p.startsWith(href + '/')) {
            const len = href.length + (p === href ? 10000 : 0);
            if (len > bestMenuLen) { bestMenu = btn; bestMenuLen = len; }
          }
        }
      }
      for (const m of menus) {
        const btn = m.querySelector('.menu-btn');
        if (!btn) continue;
        btn.classList.toggle('active', btn === bestMenu);
        try {
          if (btn === bestMenu) btn.setAttribute('aria-current', 'page');
          else btn.removeAttribute('aria-current');
        } catch {}
      }
    } catch {}

    try {
      const nav = document.querySelector('.sidebar .sidebar-nav');
      if (nav && !nav.querySelector('.selected')) {
        if (best) best.classList.add('selected');
      }
    } catch {}
  } catch {}
};

const SIDEBAR_OPEN_KEY = 'admin.sidebar.open';
const readOpenSections = () => {
  return new Set();
};
const writeOpenSections = (set) => {
  // no-op for accordion mode
};

const expandActiveSidebarSection = () => {
  try {
    const nav = document.querySelector('.sidebar .sidebar-nav');
    if (!nav) return;
    const details = Array.from(nav.querySelectorAll('details'));
    for (const d of details) {
      d.classList.remove('active-section');
      d.open = false; // default close all
    }
    const active = nav.querySelector('a.active');
    const parent = (active && active.closest) ? active.closest('details') : null;
    if (parent) {
      parent.open = true;
      parent.classList.add('active-section');
    }
  } catch {}
};

const showNavSpinner = () => {
  try { sessionStorage.removeItem('navSpinner'); } catch {}
};

const wireSidebarAccordion = () => {
  try {
    const nav = document.querySelector('.sidebar .sidebar-nav');
    if (!nav || nav.dataset.bound === '1') return;
    nav.dataset.bound = '1';
    nav.addEventListener('click', (e) => {
      const t = e && e.target;
      const summary = (t && t.closest) ? t.closest('summary') : null;
      if (!summary) return;
      const details = summary.closest('details');
      if (!details) return;
      e.preventDefault();
      
      const isOpening = !details.open;
      
      if (isOpening) {
        // Close all other details
        const allDetails = nav.querySelectorAll('details');
        for (const d of allDetails) {
          if (d !== details) d.open = false;
        }
      }
      
      details.open = isOpening;
    });
  } catch {}
};

const wireUserMenu = () => {
  try {
    const btn = document.querySelector('.user-btn');
    const dd = document.querySelector('#userDropdown');
    if (!btn || !dd) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const hidden = dd.hasAttribute('hidden');
      if (hidden) dd.removeAttribute('hidden');
      else dd.setAttribute('hidden', '');
      try { btn.setAttribute('aria-expanded', hidden ? 'true' : 'false'); } catch {}
    });
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      if (t && t.closest && t.closest('.user-menu')) return;
      dd.setAttribute('hidden', '');
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    });
  } catch {}
  try {
    const btnLogout = document.querySelector('#btnLogout');
    if (!btnLogout || btnLogout.dataset.bound === '1') return;
    btnLogout.dataset.bound = '1';
    btnLogout.addEventListener('click', async () => {
      try { await logout(); } catch {}
      try {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
      } catch {}
      try {
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } catch {}
      try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
    });
  } catch {}
};

const wireExpandingSearch = () => {
  try {
    const box = document.querySelector('.topbar-inner .search');
    if (!box) return;
    if (box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    const input = box.querySelector('input[type="search"]');
    const closeBtn = box.querySelector('.search-close');
    const hint = box.querySelector('.search-hint');
    const prefixTxt = box.querySelector('.search-prefix .txt');
    const originalPlaceholder = input ? String(input.getAttribute('placeholder') || '') : '';
    const open = () => {
      try {
        const inner = box.closest('.topbar-inner');
        const brand = inner ? inner.querySelector('.brand, a.brand') : null;
        const actions = inner ? inner.querySelector('.topbar-actions') : null;
        const user = inner ? inner.querySelector('.user') : null;
        if (inner && !inner.dataset.searchLocked) {
          const bw = brand ? Math.round(brand.getBoundingClientRect().width) : 0;
          const aw = actions ? Math.round(actions.getBoundingClientRect().width) : 0;
          const uw = user ? Math.round(user.getBoundingClientRect().width) : 0;
          inner.style.gridTemplateColumns = `${bw || 'auto'} 1fr ${aw || 'auto'} ${uw || 'auto'}`;
          inner.dataset.searchLocked = '1';
        }
      } catch {}
      box.classList.add('active');
      try {
        if (input) {
          input.setAttribute('placeholder', 'Search your workspace for a project, resource, environment...');
          input.focus(); input.select();
        }
        if (prefixTxt) prefixTxt.textContent = 'Search';
      } catch {}
    };
    const close = () => {
      box.classList.remove('active');
      try {
        const inner = box.closest('.topbar-inner');
        if (inner && inner.dataset.searchLocked === '1') {
          inner.style.gridTemplateColumns = '';
          delete inner.dataset.searchLocked;
        }
      } catch {}
      try {
        if (input) {
          if (originalPlaceholder) input.setAttribute('placeholder', originalPlaceholder);
          input.blur();
        }
        if (prefixTxt) prefixTxt.textContent = 'Projects';
      } catch {}
    };
    input.addEventListener('focus', open);
    if (hint) hint.addEventListener('click', (e) => { e.preventDefault(); open(); });
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); close(); });
      closeBtn.addEventListener('mousedown', (e) => { e.preventDefault(); close(); }, true);
    }
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      if (t && t.closest && t.closest('.search-close')) { e.preventDefault(); close(); return; }
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      const isCtrlK = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
      const isPlainK = (e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
      if (isCtrlK || isPlainK) {
        const t = e.target;
        const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
        const editable = (t && (t.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
        if (editable && !isCtrlK) return;
        e.preventDefault();
        open();
      }
    });
    document.addEventListener('click', (e) => {
      if (!box.classList.contains('active')) return;
      const t = e && e.target;
      if (t && t.closest && t.closest('.topbar-inner .search')) return;
      close();
    });
  } catch {}
};

const wireMobileDrawer = () => {
  try {
    const btn = document.querySelector('#mobileMenuBtn');
    const drawer = document.querySelector('#mobileDrawer');
    const backdrop = document.querySelector('#drawerBackdrop');
    const closeBtn = document.querySelector('#mobileClose');
    if (!btn || !drawer || !backdrop) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';

    const open = () => {
      try { drawer.removeAttribute('hidden'); } catch {}
      try { backdrop.removeAttribute('hidden'); } catch {}
      try { document.body.classList.add('drawer-open'); } catch {}
      try { btn.setAttribute('aria-expanded', 'true'); } catch {}
    };
    const close = () => {
      try { drawer.setAttribute('hidden', ''); } catch {}
      try { backdrop.setAttribute('hidden', ''); } catch {}
      try { document.body.classList.remove('drawer-open'); } catch {}
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    };
    const toggle = () => {
      const isOpen = !drawer.hasAttribute('hidden');
      if (isOpen) close();
      else open();
    };

    btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); close(); });
    backdrop.addEventListener('click', (e) => { e.preventDefault(); close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  } catch {}
};

const setTopbarHeightVar = () => {
  try {
    if (document.body.classList.contains('drawer-open')) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const h = Math.round(topbar.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--topbar-height', `${h}px`);
  } catch {}
};

const mapLegacyAdminToNewPath = (href) => {
  try {
    const u = new URL(href, window.location.origin);
    if (normalizePath(u.pathname) !== '/ui/admin') return null;
    const tab = (u.searchParams.get('tab') || '').trim();
    if (!tab) return '/admin/dashboard';
    if (tab === 'employees') return '/admin/employees';
    if (tab === 'attendance') return '/admin/attendance';
    if (tab === 'shifts') return '/admin/attendance/shifts';
    if (tab === 'calendar') return '/admin/attendance/holidays';
    if (tab === 'leave_grant') return '/admin/leave/grants';
    if (tab === 'leave_balance') return '/admin/leave/balance';
    if (tab === 'approvals') return '/admin/leave/requests';
    if (tab === 'salary_list') return '/admin/payroll/salary';
    if (tab === 'salary_send') return '/admin/payroll/payslips';
    if (tab === 'departments') return '/admin/departments';
    if (tab === 'audit') return '/admin/system/audit-logs';
    if (tab === 'settings') return '/admin/system/settings';
    return '/admin/dashboard';
  } catch {}
  return null;
};

const isSameOrigin = (href) => {
  try {
    const u = new URL(href, window.location.origin);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
};

const isAdminPath = (pathname) => {
  const p = normalizePath(pathname);
  return p === '/admin' || p.startsWith('/admin/');
};

const assetV = (() => {
  try {
    const meta = document.querySelector('meta[name="asset-v"]');
    const v = meta ? (meta.getAttribute('content') || '') : '';
    if (v) return String(v);
  } catch {}
  try {
    const v2 = window.__assetV;
    return v2 ? String(v2) : '';
  } catch {}
  return '';
})();

const withAssetV = (path) => {
  const p = String(path || '');
  if (!assetV) return p;
  if (!p) return p;
  if (p.includes('v=')) return p;
  return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(assetV);
};

const moduleCache = new Map();
const loadModule = async (path) => {
  const spec = withAssetV(path);
  let url = '';
  try { url = new URL(spec, import.meta.url).href; } catch { url = String(spec || ''); }
  const key = String(url || '');
  if (moduleCache.has(key)) return moduleCache.get(key);
  const p = (async () => {
    try {
      return await import(url);
    } catch (e) {
      const msg = String((e && e.message) ? e.message : (e || 'unknown'));
      throw new Error(`Module load failed: ${url || spec}\n${msg}`);
    }
  })();
  moduleCache.set(key, p);
  return p;
};

const resetTransientUiState = () => {
  try {
    const dd = document.querySelector('#userDropdown');
    const btn = document.querySelector('.user-btn');
    if (dd && !dd.hasAttribute('hidden')) dd.setAttribute('hidden', '');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  } catch {}
  try {
    const drawer = document.querySelector('#mobileDrawer');
    const backdrop = document.querySelector('#drawerBackdrop');
    const mobileBtn = document.querySelector('#mobileMenuBtn');
    if (drawer) {
      drawer.setAttribute('hidden', '');
      drawer.style.display = 'none';
      drawer.style.removeProperty('pointer-events');
    }
    if (backdrop) {
      backdrop.setAttribute('hidden', '');
      backdrop.style.display = 'none';
      backdrop.style.removeProperty('pointer-events');
    }
    if (mobileBtn) mobileBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  } catch {}
  try {
    const spinner = document.querySelector('#pageSpinner');
    if (spinner) {
      spinner.setAttribute('hidden', 'true');
      spinner.style.display = 'none';
    }
    const content = document.querySelector('#adminContent');
    if (content) content.style.visibility = '';
    sessionStorage.removeItem('navSpinner');
  } catch {}
  try {
    document.querySelectorAll('.modal-overlay').forEach((el) => {
      try { el.remove(); } catch {}
    });
  } catch {}
  try {
    const adminEditModal = document.querySelector('#adminEditModal');
    if (adminEditModal) {
      adminEditModal.style.display = 'none';
      try { adminEditModal.remove(); } catch {}
    }
  } catch {}
  try {
    document.querySelectorAll('.subbar .menu.open').forEach((el) => {
      try { el.classList.remove('open'); } catch {}
    });
  } catch {}
  try {
    const search = document.querySelector('.topbar-inner .search');
    const inner = search ? search.closest('.topbar-inner') : null;
    if (search) search.classList.remove('active');
    if (inner && inner.dataset.searchLocked === '1') {
      inner.style.gridTemplateColumns = '';
      delete inner.dataset.searchLocked;
    }
  } catch {}
};

let currentViewCleanup = null;
let routeSeq = 0;
const route = async () => {
  const seq = ++routeSeq;
  try {
    const cleanup = currentViewCleanup;
    currentViewCleanup = null;
    if (typeof cleanup === 'function') await cleanup();
  } catch {}
  resetTransientUiState();
  try {
    const prevHost = document.querySelector('#adminContent');
    if (prevHost) {
      const host = document.createElement('section');
      host.id = 'adminContent';
      host.className = 'card';
      host.style.visibility = '';
      prevHost.replaceWith(host);
    }
  } catch {}
  const mountModule = async (mod) => {
    if (!mod || typeof mod.mount !== 'function') {
      currentViewCleanup = null;
      return;
    }
    const cleanup = await mod.mount();
    if (seq !== routeSeq) {
      if (typeof cleanup === 'function') {
        try { await cleanup(); } catch {}
      }
      return;
    }
    currentViewCleanup = typeof cleanup === 'function' ? cleanup : null;
  };
  const renderErr = (err) => {
    try {
      const host = document.querySelector('#adminContent');
      if (!host) return;
      const msg = String((err && err.message) ? err.message : (err || 'unknown'));
      const stack = String((err && err.stack) ? err.stack : '').trim();
      let hint = '';
      try {
        const m = msg.match(/Module load failed:\s*(\S+)/);
        if (m && m[1]) hint = `読み込み失敗モジュール: ${m[1]}`;
      } catch {}
      host.innerHTML = `
        <div style="max-width:1100px;margin:18px auto;padding:0 12px;">
          <div style="border:1px solid #fecaca;background:#fff1f2;color:#7f1d1d;border-radius:12px;padding:14px 14px;">
            <div style="font-weight:900;font-size:16px;margin-bottom:6px;">画面の読み込みに失敗しました</div>
            <div style="font-weight:700;font-size:13px;white-space:pre-wrap;word-break:break-word;">${msg.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}</div>
            ${hint ? `<div style="margin-top:6px;font-weight:800;color:#7f1d1d;">${hint.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}</div>` : ``}
              ${stack ? `<details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:900;">詳細</summary><div style="margin-top:8px;font-weight:650;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#7f1d1d;">${stack.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}</div></details>` : ``}
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" id="btnAdminReload" style="height:34px;padding:0 12px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0b2c66;font-weight:900;cursor:pointer;">再読込</button>
              <button type="button" id="btnAdminHardReload" style="height:34px;padding:0 12px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0b2c66;font-weight:900;cursor:pointer;">キャッシュ破棄</button>
            </div>
          </div>
        </div>
      `;
      const btnReload = host.querySelector('#btnAdminReload');
      if (btnReload) btnReload.addEventListener('click', () => { try { window.location.reload(); } catch {} });
      const btnHardReload = host.querySelector('#btnAdminHardReload');
      if (btnHardReload) btnHardReload.addEventListener('click', () => {
        try {
          if ('caches' in window) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(() => window.location.reload());
            return;
          }
        } catch {}
        try { window.location.reload(); } catch {}
      });
    } catch {}
  };
  lastRenderErr = renderErr;

  try {
    const p = normalizePath(window.location.pathname);
    if (p === '/ui/admin') {
      const mapped = mapLegacyAdminToNewPath(window.location.href) || '/admin/dashboard';
      await navigate(mapped, true);
      return;
    }
    try { document.body.classList.remove('employees-wide'); } catch {}
    try {
      const opens = document.querySelectorAll('.subbar .menu.open');
      for (const el of opens) el.classList.remove('open');
    } catch {}
    markActiveNav();
    try {
      const home = document.querySelector('.sidebar .sidebar-nav a[data-admin-link="dashboard"]');
      if (home) home.classList.add('pinned');
    } catch {}
    expandActiveSidebarSection();
    if (seq !== routeSeq) return;

    try {
      if (p === '/admin') {
        try { history.replaceState(null, '', '/admin/dashboard'); } catch {}
      }
    } catch {}

    const p2 = normalizePath(window.location.pathname);

    if (p2 === '/admin' || p2 === '/admin/dashboard') {
      const mod = await loadModule('./dashboard/dashboard.page.js?v=navy-20260418-dashfix2');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/employees/monthly-summary' || p2 === '/admin/employees/monthly-summary/') {
      const mod = await loadModule('../pages/admin-employees-monthly-summary.page.js?v=navy-20260413-9');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/employees' || p2.startsWith('/admin/employees/')) {
      const mod = await loadModule('./employees/employees.page.js?v=navy-20260418-empfix1');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/attendance/monthly') {
      try { window.location.assign('/admin/attendance/monthly'); } catch { window.location.href = '/admin/attendance/monthly'; }
      return;
    }
    if (p2 === '/admin/attendance' || p2.startsWith('/admin/attendance/')) {
      const mod = await loadModule('./attendance/attendance.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/leave/requests' || p2 === '/admin/leave/balance' || p2 === '/admin/leave/grants') {
      const mod = await loadModule('./leave/leave.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/work-reports') {
      const mod = await loadModule('./work-reports/work-reports.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/payroll/salary' || p2 === '/admin/payroll/payslips') {
      const mod = await loadModule('./payroll/payroll.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/expenses') {
      const mod = await loadModule('./expenses/expenses.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/departments' || p2 === '/admin/organization/departments') {
      const mod = await loadModule('./organization/organization.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/system/settings' || p2 === '/admin/system/audit-logs') {
      const mod = await loadModule('./system/system.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    if (p2 === '/admin/notices') {
      const mod = await loadModule('./notices/notices.page.js');
      if (seq !== routeSeq) return;
      await mountModule(mod);
      return;
    }
    // Do not fallback to legacy admin bootstrap; it causes mixed old/new
    // headers and visible flicker on first load.
    if (normalizePath(p2) === '/admin') {
      await navigate('/admin/dashboard', true);
      return;
    }
    const host = document.querySelector('#adminContent');
    if (host) {
      host.className = 'card';
      host.innerHTML = '<div style="padding:16px;color:#0f172a;">ページが見つかりません。</div>';
    }
  } catch (err) {
    renderErr(err);
  }
};

const navigate = async (href, replace = false) => {
  try {
    const u = new URL(href, window.location.origin);
    if (!isAdminPath(u.pathname)) {
      window.location.href = u.href;
      return;
    }
    const cur = new URL(window.location.href);
    const same = normalizePath(cur.pathname) === normalizePath(u.pathname) && cur.search === u.search && cur.hash === u.hash;
    if (!same) {
      try {
        if (replace) history.replaceState(null, '', u.pathname + u.search + u.hash);
        else history.pushState(null, '', u.pathname + u.search + u.hash);
      } catch {}
    }
  } catch {
    try { window.location.href = href; } catch {}
    return;
  }
  await route();
};

const wireLegacyLinkRewrite = () => {
  try {
    if (document.body.dataset.legacyRewrite === '1') return;
    document.body.dataset.legacyRewrite = '1';
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      const a = (t && t.closest) ? t.closest('a[href]') : null;
      if (!a) return;
      if (a.target === '_blank') return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/ui/admin')) return;
      const mapped = mapLegacyAdminToNewPath(href);
      if (!mapped) return;
      e.preventDefault();
      navigate(mapped);
    });
  } catch {}
};

const wireSpaNav = () => {
  try {
    if (document.body.dataset.spaNav === '1') return;
    document.body.dataset.spaNav = '1';
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      const a = (t && t.closest) ? t.closest('a[href]') : null;
      if (!a) return;
      if (a.target === '_blank') return;
      if (a.hasAttribute('download')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = a.getAttribute('href') || '';
      if (!href) return;
      if (!isSameOrigin(href)) return;
      const u = new URL(href, window.location.origin);
      if (!isAdminPath(u.pathname)) return;
      if (u.pathname === '/admin/attendance/monthly' || u.pathname === '/admin/attendance/monthly/') return;
      if (u.pathname === '/admin/employees/monthly-summary' || u.pathname === '/admin/employees/monthly-summary/') return;
      e.preventDefault();
      navigate(u.pathname + u.search + u.hash);
    });
    window.addEventListener('popstate', () => { route(); });
    window.addEventListener('hashchange', () => { route(); });
  } catch {}
};

const wireTopbarMenus = () => {
  try {
    if (document.body.dataset.topbarMenus === '1') return;
    document.body.dataset.topbarMenus = '1';
    const menus = Array.from(document.querySelectorAll('.subbar .menu'));
    const openClass = 'open';
    const closeAll = () => {
      for (const m of menus) m.classList.remove(openClass);
    };
    const onDocClick = (e) => {
      const t = e && e.target;
      const inside = !!(t && t.closest && t.closest('.subbar .menu'));
      if (!inside) closeAll();
    };
    for (const m of menus) {
      const btn = m.querySelector('.menu-btn');
      if (!btn) continue;
      if (btn.dataset.bound === '1') continue;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = m.classList.contains(openClass);
        closeAll();
        if (!isOpen) m.classList.add(openClass);
      });
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
  } catch {}
};

const wireNavSelection = () => {
  try {
    if (document.body.dataset.navSelection === '1') return;
    document.body.dataset.navSelection = '1';
    const nav = document.querySelector('.sidebar .sidebar-nav');
    if (!nav) return;

    const clear = () => {
      nav.querySelectorAll('a.selected, summary.selected').forEach((el) => el.classList.remove('selected'));
    };
    const selectEl = (el) => {
      if (!el) return;
      clear();
      el.classList.add('selected');
      try {
        const a = el.tagName === 'A' ? el : null;
        const key = a ? `a:${a.getAttribute('href') || ''}` : 'summary';
        sessionStorage.setItem('admin.nav.selected', key);
      } catch {}
    };

    try {
      const saved = sessionStorage.getItem('admin.nav.selected') || '';
      if (saved.startsWith('a:')) {
        const href = saved.slice(2);
        const a = nav.querySelector(`a[href="${CSS.escape(href)}"]`);
        if (a) a.classList.add('selected');
      }
    } catch {}

    nav.addEventListener('click', (e) => {
      const t = e && e.target;
      const a = (t && t.closest) ? t.closest('a[href]') : null;
      if (a && nav.contains(a)) {
        selectEl(a);
        return;
      }
      const summary = (t && t.closest) ? t.closest('summary') : null;
      if (summary && nav.contains(summary)) {
        selectEl(summary);
      }
    }, true);
  } catch {}
};

const boot = async () => {
  try { document.documentElement.classList.add('admin-preboot'); } catch {}
  try { document.body.classList.add('booting'); } catch {}
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    try { document.body.classList.remove('booting'); } catch {}
    try { document.documentElement.classList.remove('admin-preboot'); } catch {}
    try { document.getElementById('adminChrome')?.removeAttribute('hidden'); } catch {}
    try { document.body.style.visibility = ''; } catch {}
    try { document.getElementById('adminBootMask')?.remove(); } catch {}
  };
  let forceRevealTimer = null;
  try { forceRevealTimer = setTimeout(reveal, 1200); } catch {}
  setTopbarHeightVar();
  try { window.addEventListener('resize', setTopbarHeightVar); } catch {}
  wireSidebarAccordion();
  wireNavSelection();
  wireLegacyLinkRewrite();
  wireSpaNav();
  wireExpandingSearch();
  wireTopbarMenus();
  wireAdminShell({ logoutRedirect: '/ui/login' });
  const p = normalizePath(window.location.pathname);
  if (p === '/admin' || p === '/admin/dashboard') {
    try {
      if (document.body.dataset.backLoginBound !== '1') {
        document.body.dataset.backLoginBound = '1';
        try { history.pushState({ back_to_login_guard: true }, '', window.location.href); } catch {}
        window.addEventListener('popstate', async () => {
          try { await logout(); } catch {}
          try {
            sessionStorage.removeItem('accessToken');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('user');
          } catch {}
          try {
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
          } catch {}
          try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
        });
      }
    } catch {}
  }
  try {
    await route();
  } finally {
    try { if (forceRevealTimer) clearTimeout(forceRevealTimer); } catch {}
    try {
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(reveal, 40)));
    } catch {
      reveal();
    }
  }
};

boot();
