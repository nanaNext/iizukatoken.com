import { logout } from '../api/auth.api.js';
import { wireAdminShell } from '../shell/admin-shell.js';

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
  if (p === '/admin/attendance/adjust-requests') return { tab: 'approvals', hash: '' };
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
    const links = Array.from(document.querySelectorAll('.sidebar .sidebar-nav a[href]'));
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
    for (const a of links) a.classList.toggle('active', a === best);
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
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        await logout(rt || undefined);
      } catch {}
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

let routeSeq = 0;
const route = async () => {
  const seq = ++routeSeq;
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
    try {
      document.body.classList.toggle('employees-wide', p === '/admin/employees' || p.startsWith('/admin/employees/'));
    } catch {}
    markActiveNav();
    expandActiveSidebarSection();
    if (seq !== routeSeq) return;

    try {
      if (p === '/admin') {
        try { history.replaceState(null, '', '/admin/dashboard'); } catch {}
      }
    } catch {}

    const p2 = normalizePath(window.location.pathname);

    if (p2 === '/admin' || p2 === '/admin/dashboard') {
      const mod = await loadModule('./dashboard/dashboard.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/employees' || p2.startsWith('/admin/employees/')) {
      const mod = await loadModule('./employees/employees.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/attendance/monthly') {
      try { window.location.assign('/admin/attendance/monthly'); } catch { window.location.href = '/admin/attendance/monthly'; }
      return;
    }
    if (p2 === '/admin/attendance' || p2.startsWith('/admin/attendance/')) {
      const mod = await loadModule('./attendance/attendance.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/leave/requests' || p2 === '/admin/leave/balance' || p2 === '/admin/leave/grants') {
      const mod = await loadModule('./leave/leave.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/work-reports') {
      const mod = await loadModule('./work-reports/work-reports.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/payroll/salary' || p2 === '/admin/payroll/payslips') {
      const mod = await loadModule('./payroll/payroll.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/departments' || p2 === '/admin/organization/departments') {
      const mod = await loadModule('./organization/organization.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/system/settings' || p2 === '/admin/system/audit-logs') {
      const mod = await loadModule('./system/system.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    if (p2 === '/admin/notices') {
      const mod = await loadModule('./notices/notices.page.js');
      if (seq !== routeSeq) return;
      if (mod && typeof mod.mount === 'function') await mod.mount();
      return;
    }
    syncUrlState();
    await loadModule('../pages/admin.page.js');
    if (seq !== routeSeq) return;
    try {
      if (document.readyState !== 'loading') {
        document.dispatchEvent(new Event('DOMContentLoaded'));
      }
    } catch {}
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
      e.preventDefault();
      navigate(u.pathname + u.search + u.hash);
    });
    window.addEventListener('popstate', () => { route(); });
    window.addEventListener('hashchange', () => { route(); });
  } catch {}
};

const boot = async () => {
  setTopbarHeightVar();
  try { window.addEventListener('resize', setTopbarHeightVar); } catch {}
  wireSidebarAccordion();
  wireLegacyLinkRewrite();
  wireSpaNav();
  wireAdminShell({ logoutRedirect: '/ui/login' });
  const p = normalizePath(window.location.pathname);
  if (p === '/admin' || p === '/admin/dashboard') {
    try {
      if (document.body.dataset.backLoginBound !== '1') {
        document.body.dataset.backLoginBound = '1';
        try { history.pushState({ back_to_login_guard: true }, '', window.location.href); } catch {}
        window.addEventListener('popstate', async () => {
          try {
            const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
            await logout(rt || undefined);
          } catch {}
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
  await route();
};

boot();
