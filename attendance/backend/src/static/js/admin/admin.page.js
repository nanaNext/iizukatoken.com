import { logout } from '../api/auth.api.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

const toLegacyState = (path) => {
  const p = normalizePath(path);
  if (p === '/admin' || p === '/admin/dashboard') return { tab: null, hash: '' };

  if (p === '/admin/employees') return { tab: 'employees', hash: '#list' };
  if (p === '/admin/employees/add') return { tab: 'employees', hash: '#add' };
  if (p === '/admin/employees/change-requests') return { tab: 'approvals', hash: '' };

  if (p === '/admin/attendance') return { tab: 'attendance', hash: '' };
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
    for (const a of document.querySelectorAll('.sidebar .sidebar-nav a[href]')) {
      const href = normalizePath(a.getAttribute('href'));
      const active = href !== '/' && (p === href || (href !== '/admin/dashboard' && p.startsWith(href + '/')));
      a.classList.toggle('active', active);
    }
  } catch {}
};

const expandActiveSidebarSection = () => {
  try {
    const nav = document.querySelector('.sidebar .sidebar-nav');
    if (!nav) return;
    const details = Array.from(nav.querySelectorAll('details'));
    for (const d of details) {
      d.open = false;
      d.classList.remove('active-section');
    }
    const active = nav.querySelector('a.active');
    const parent = active?.closest?.('details');
    if (parent) {
      parent.open = true;
      parent.classList.add('active-section');
    }
  } catch {}
};

const showNavSpinner = () => {
  try { sessionStorage.setItem('navSpinner', '1'); } catch {}
  try {
    const sp = document.querySelector('#pageSpinner');
    if (sp) { sp.removeAttribute('hidden'); sp.style.display = 'flex'; }
  } catch {}
  try {
    const c = document.querySelector('#adminContent');
    if (c) c.style.visibility = 'hidden';
  } catch {}
};

const wireSidebarAccordion = () => {
  try {
    const nav = document.querySelector('.sidebar .sidebar-nav');
    if (!nav || nav.dataset.bound === '1') return;
    nav.dataset.bound = '1';
    nav.addEventListener('click', (e) => {
      const summary = e.target?.closest?.('summary');
      if (!summary) return;
      const details = summary.closest('details');
      if (!details) return;
      const chev = e.target?.closest?.('.chev');
      if (chev) {
        e.preventDefault();
        details.open = !details.open;
        return;
      }
      const href = details.getAttribute('data-default-href') || '';
      if (href) {
        e.preventDefault();
        if (normalizePath(window.location.pathname) === normalizePath(href)) return;
        showNavSpinner();
        window.location.href = href;
      }
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
    });
    document.addEventListener('click', (e) => {
      if (e.target?.closest?.('.user-menu')) return;
      dd.setAttribute('hidden', '');
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

const wireLegacyLinkRewrite = () => {
  try {
    if (document.body.dataset.legacyRewrite === '1') return;
    document.body.dataset.legacyRewrite = '1';
    document.addEventListener('click', (e) => {
      const a = e.target?.closest?.('a[href]');
      if (!a) return;
      if (a.target === '_blank') return;
      const href = a.getAttribute('href') || '';
      if (!href.startsWith('/ui/admin')) return;
      const mapped = mapLegacyAdminToNewPath(href);
      if (!mapped) return;
      e.preventDefault();
      showNavSpinner();
      window.location.href = mapped;
    });
  } catch {}
};

const boot = async () => {
  setTopbarHeightVar();
  try { window.addEventListener('resize', setTopbarHeightVar); } catch {}
  wireSidebarAccordion();
  wireLegacyLinkRewrite();
  wireUserMenu();
  const p = normalizePath(window.location.pathname);
  try {
    document.body.classList.toggle('employees-wide', p === '/admin/employees' || p.startsWith('/admin/employees/'));
  } catch {}
  markActiveNav();
  expandActiveSidebarSection();
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
    await import('./dashboard/dashboard.page.js');
    return;
  }
  if (p === '/admin/employees' || p.startsWith('/admin/employees/')) {
    await import('./employees/employees.page.js');
    return;
  }
  if (p === '/admin/attendance' || p.startsWith('/admin/attendance/')) {
    await import('./attendance/attendance.page.js');
    return;
  }
  if (p === '/admin/leave/requests' || p === '/admin/leave/balance' || p === '/admin/leave/grants') {
    await import('./leave/leave.page.js');
    return;
  }
  if (p === '/admin/work-reports') {
    await import('./work-reports/work-reports.page.js');
    return;
  }
  if (p === '/admin/payroll/salary' || p === '/admin/payroll/payslips') {
    await import('./payroll/payroll.page.js');
    return;
  }
  if (p === '/admin/departments' || p === '/admin/organization/departments') {
    await import('./organization/organization.page.js');
    return;
  }
  if (p === '/admin/system/settings' || p === '/admin/system/audit-logs') {
    await import('./system/system.page.js');
    return;
  }
  syncUrlState();
  await import('../pages/admin.page.js');
};

boot();
