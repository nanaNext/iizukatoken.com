import { me, refresh, logout } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);
const markTopbarReady = () => {
  try { document.documentElement.classList.add('topbar-ready'); } catch { }
};

const prefillUserName = () => {
  try {
    const el = $('#userName');
    if (!el) return;
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
    const u = raw ? JSON.parse(raw) : null;
    const name = (u && (u.username || u.email)) ? String(u.username || u.email) : '';
    if (name) el.textContent = name;
  } catch { }
};

const setUserNameStable = (nextName, { force = false } = {}) => {
  try {
    const el = $('#userName');
    if (!el) return;
    const current = String(el.textContent || '').trim();
    const next = String(nextName || '').trim();
    if (!next) return;
    if (!force && current) return;
    if (current === next) return;
    el.textContent = next;
  } catch { }
};

// Run as early as possible (module executes before DOMContentLoaded on these pages)
// to reduce visible flicker in the user area while auth/profile is still resolving.
try { prefillUserName(); } catch { }
markTopbarReady();

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

const wireExpandingSearch = () => {
  try {
    const box = document.querySelector('.topbar-inner .search');
    if (!box) return;
    if (box.dataset.bound === '1') return;
    box.dataset.bound = '1';
    const input = box.querySelector('input[type="search"]');
    const closeBtn = box.querySelector('.search-close');
    const hint = box.querySelector('.search-hint');
    box.classList.remove('active');
    if (hint) hint.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
    document.addEventListener('keydown', (e) => {
      const isCtrlK = (e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey);
      if (isCtrlK) {
        const t = e.target;
        const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
        const editable = (t && (t.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'));
        if (editable) return;
        e.preventDefault();
        try { input && input.focus({ preventScroll: true }); input && input.select(); } catch { }
      }
    });
  } catch { }
};

async function ensureAuthProfile() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;

  // Add timeout to prevent hanging
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Auth timeout')), 5000)
  );

  try {
    if (token) {
      try { profile = await Promise.race([me(token), timeoutPromise]); } catch (e) {
        console.warn('⚠️ Me() failed:', e.message);
      }
    }
    if (!profile) {
      try {
        const r = await Promise.race([refresh(), timeoutPromise]);
        sessionStorage.setItem('accessToken', r.accessToken);
        token = r.accessToken;
        profile = await me(token);
      } catch (e) {
        console.warn('⚠️ Refresh failed:', e.message);
      }
    }
    if (!profile) {
      try {
        const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
        const user = userStr ? JSON.parse(userStr) : null;
        if (user && (user.role === 'admin' || user.role === 'manager' || user.role === 'employee')) {
          profile = user;
          try {
            const r2 = await Promise.race([refresh(), timeoutPromise]);
            sessionStorage.setItem('accessToken', r2.accessToken);
          } catch { }
        }
      } catch (e) {
        console.warn('⚠️ Fallback profile failed:', e.message);
      }
    }
  } catch (e) {
    console.error('❌ ensureAuthProfile error:', e);
  }

  if (!profile) { return null; }
  return profile;
}

document.addEventListener('DOMContentLoaded', async () => {
  markTopbarReady();
  prefillUserName();
  // Prevent full reload when user clicks the link of the page already opened.
  // This removes topbar/user flicker on same-tab clicks such as "申請" on /ui/requests.
  try {
    if (!window.__preventSelfNavBound) {
      window.__preventSelfNavBound = true;
      document.addEventListener('click', (e) => {
        const a = e.target?.closest?.('a[href]');
        if (!a) return;
        if (a.hasAttribute('download')) return;
        const target = String(a.getAttribute('target') || '').toLowerCase();
        if (target && target !== '_self') return;
        const href = String(a.getAttribute('href') || '').trim();
        if (!href || href === '#' || href.startsWith('javascript:')) return;
        let to = null;
        let cur = null;
        try {
          to = new URL(href, window.location.href);
          cur = new URL(window.location.href);
        } catch {
          return;
        }
        if (!to || !cur) return;
        if (to.origin !== cur.origin) return;
        if (to.pathname === cur.pathname && to.search === cur.search && (to.hash || '') === (cur.hash || '')) {
          e.preventDefault();
        }
      }, true);
    }
  } catch { }
  const pageSpinner = document.querySelector('#pageSpinner');
  try {
    const navEntry = (typeof performance !== 'undefined' && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
    const navType = navEntry?.type || (performance && performance.navigation && performance.navigation.type === 2 ? 'back_forward' : '');
    if (navType === 'back_forward') {
      if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
      try { sessionStorage.removeItem('navSpinner'); } catch { }
    }
    window.addEventListener('pageshow', () => {
      try { sessionStorage.removeItem('navSpinner'); } catch { }
      if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
    });
  } catch { }
  try {
    /* giữ spinner đến khi xác thực xong, không auto-hide theo thời gian */
  } catch { }
  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1' && pageSpinner) {
      pageSpinner.removeAttribute('hidden');
    }
    sessionStorage.removeItem('navSpinner');
  } catch { }
  const waitMinDelay = async () => { };
  // Keep header height stable to avoid first-paint layout jump between pages.
  const setTopbarHeightVar = () => { };
  const status = $('#status');
  if (status) status.textContent = '認証を確認しています…';
  const tilesRoot = document.querySelector('.tiles');
  if (tilesRoot) { tilesRoot.style.visibility = 'hidden'; }
  let profile = null;
  try {
    profile = await ensureAuthProfile();
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '認証エラー: ' + (e?.message || 'unknown'); }
    if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  }
  if (!profile) { if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); } window.location.replace('/ui/login'); return; }
  markTopbarReady();
  const goLogin = async () => {
    try { await logout(); } catch { }
    try {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
    } catch { }
    try {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    } catch { }
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
  };
  try {
    const userStr = sessionStorage.getItem('user') || '';
    if (userStr) { localStorage.setItem('user', userStr); }
  } catch { }
  const role = String(profile.role || '').toLowerCase();
  setUserNameStable(profile.username || profile.email || 'ユーザー');
  if (role === 'admin' || role === 'manager') {
    const p0 = String(window.location.pathname || '');
    if (p0 === '/ui/portal' || p0 === '/ui/dashboard') {
      try { window.location.replace('/admin/dashboard'); } catch { window.location.href = '/admin/dashboard'; }
      return;
    }
  }
  const bindEmployeePjaxRequests = () => {
    const REQ_PATH = '/ui/requests';
    const CONTACT_PATH = '/ui/contact';
    const HOME_PATH = '/ui/portal';
    // Keep requests on full-page load so it always applies requests.html styles.
    const SOFT_PATHS = new Set([CONTACT_PATH, HOME_PATH]);
    const main = document.querySelector('main.content');
    if (!main) return;
    const setNavCurrent = (pathName) => {
      try {
        document.querySelectorAll('.subbar .subnav a[href]').forEach((a) => {
          const href = String(a.getAttribute('href') || '');
          const u = new URL(href, window.location.origin);
          if (u.pathname === pathName) a.setAttribute('aria-current', 'page');
          else a.removeAttribute('aria-current');
        });
        document.querySelectorAll('#mobileDrawer a.drawer-item[href]').forEach((a) => {
          const href = String(a.getAttribute('href') || '');
          const u = new URL(href, window.location.origin);
          if (u.pathname === pathName) a.setAttribute('aria-current', 'page');
          else a.removeAttribute('aria-current');
        });
      } catch { }
    };
    const loadViaPjax = async (url, push = true) => {
      try {
        const res = await fetch(url.pathname + url.search, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return false;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const nextMain = doc.querySelector('main.content');
        if (!nextMain) return false;
        main.innerHTML = nextMain.innerHTML;
        if (doc.title) document.title = doc.title;
        if (push) history.pushState({ pjax: true }, '', url.pathname + url.search + url.hash);
        setNavCurrent(url.pathname);
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
        if (url.pathname === REQ_PATH) {
          try {
            const mod = await import('/static/js/pages/requests.page.js');
            if (mod && typeof mod.bootRequestsPage === 'function') {
              await mod.bootRequestsPage();
            }
          } catch { }
        }
        if (url.pathname === HOME_PATH) {
          try { renderHomeTiles(role); } catch { }
          try {
            const tiles = document.querySelector('.tiles');
            if (tiles && tiles.dataset.navBound !== '1') {
              tiles.dataset.navBound = '1';
              tiles.addEventListener('click', (e) => {
                const a = e.target?.closest?.('a.tile');
                if (a && a.href && a.target !== '_blank') {
                  e.preventDefault();
                  window.location.href = a.href;
                }
              });
            }
          } catch { }
        }
        return true;
      } catch {
        return false;
      }
    };
    if (!window.__employeePjaxReqBound) {
      window.__employeePjaxReqBound = true;
      window.__employeeSoftNavigate = async (href, push = true) => {
        try {
          const to = new URL(String(href || ''), window.location.href);
          if (to.origin !== window.location.origin) return false;
          if (!SOFT_PATHS.has(to.pathname)) return false;
          const ok = await loadViaPjax(to, !!push);
          return !!ok;
        } catch {
          return false;
        }
      };
      document.addEventListener('click', async (e) => {
        const a = e.target?.closest?.('a[href]');
        if (!a) return;
        if (a.hasAttribute('download')) return;
        const target = String(a.getAttribute('target') || '').toLowerCase();
        if (target && target !== '_self') return;
        const href = String(a.getAttribute('href') || '').trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        let to = null;
        try { to = new URL(href, window.location.href); } catch { return; }
        if (!to || to.origin !== window.location.origin) return;
        if (!SOFT_PATHS.has(to.pathname)) return;
        if (window.location.pathname === to.pathname && window.location.search === to.search) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        const ok = await loadViaPjax(to, true);
        if (!ok) window.location.href = to.pathname + to.search + to.hash;
      }, true);
      window.addEventListener('popstate', async () => {
        try {
          const p = String(window.location.pathname || '');
          if (SOFT_PATHS.has(p)) {
            const hasExpectedMain =
              (p === CONTACT_PATH && !!document.querySelector('.contact-wrap')) ||
              (p === HOME_PATH && !!document.querySelector('.tiles'));
            if (!hasExpectedMain) {
              const ok = await loadViaPjax(new URL(window.location.href), false);
              if (!ok) window.location.reload();
            }
            return;
          }
          if (document.querySelector('.req-page')) {
            window.location.reload();
          }
        } catch { }
      });
    }
  };
  bindEmployeePjaxRequests();
  if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  try {
    const p = String(window.location.pathname || '');
    if ((p === '/ui/portal' || p === '/ui/dashboard') && document.body.dataset.backLoginBound !== '1') {
      document.body.dataset.backLoginBound = '1';
      try { history.pushState({ back_to_login_guard: true }, '', window.location.href); } catch { }
      window.addEventListener('popstate', async () => {
        await goLogin();
      });
    }
  } catch { }
  try {
  } catch { }
  if (role === 'employee' || role === 'manager') {
    const tiles = document.querySelector('.tiles');
    if (tiles) {
      tiles.innerHTML = `
        <a class="tile" href="/ui/attendance/simple"><div class="icon">⏱</div><div class="title">出退勤打刻</div></a>
        <a class="tile" href="/ui/profile"><div class="icon">👤</div><div class="title">プロフィール</div></a>
        <a class="tile" href="/ui/salary"><div class="icon">💴</div><div class="title">給与明細など</div></a>
        <a class="tile" href="/ui/calendar"><div class="icon">📅</div><div class="title">カレンダー</div></a>
        <a class="tile" href="/ui/requests"><div class="icon">✈️</div><div class="title">休暇申請</div></a>
      `;
    }
  }

  if (role === 'admin') {
    const tiles = document.querySelector('.tiles');
    if (tiles) {
      tiles.innerHTML = `
        <a class="tile" href="/ui/employees"><div class="icon">👤</div><div class="title">社員管理</div></a>
        <a class="tile" href="/ui/admin?tab=dbcheck"><div class="icon">🗄️</div><div class="title">DB検査</div></a>
        <a class="tile" href="/ui/admin?tab=users"><div class="icon">👥</div><div class="title">ユーザー管理</div></a>
        <a class="tile" href="/ui/admin?tab=departments"><div class="icon">🏢</div><div class="title">部門管理</div></a>
        <a class="tile" href="/ui/admin?tab=attendance"><div class="icon">⏱</div><div class="title">勤怠管理</div></a>
        <a class="tile" href="/ui/admin?tab=approvals"><div class="icon">✅</div><div class="title">承認フロー</div></a>
        <a class="tile" href="/ui/admin?tab=reports"><div class="icon">📊</div><div class="title">レポート</div></a>
        <a class="tile" href="/ui/admin?tab=salary_list"><div class="icon">💴</div><div class="title">給与管理</div></a>
        <a class="tile" href="/ui/admin?tab=settings"><div class="icon">⚙️</div><div class="title">システム設定</div></a>
        <a class="tile" href="/ui/admin?tab=audit"><div class="icon">📝</div><div class="title">監査ログ</div></a>
        <a class="tile" href="/ui/admin?tab=refresh"><div class="icon">🔑</div><div class="title">トークン管理</div></a>
        <a class="tile" href="/ui/admin?tab=calendar"><div class="icon">📅</div><div class="title">カレンダー</div></a>
        <a class="tile" href="/ui/admin?tab=shifts"><div class="icon">🗓️</div><div class="title">シフト</div></a>
        <a class="tile" href="/ui/admin?tab=routes"><div class="icon">🔗</div><div class="title">API一覧</div></a>
      `;
    }
    const drawer = document.querySelector('#mobileDrawer');
    if (drawer) {
      drawer.innerHTML = `
        <div class="drawer-header">
          <button id="mobileClose" class="mobile-close" aria-label="close">✕</button>
        </div>
        <a href="/ui/portal" class="drawer-item">ホーム</a>
        <a href="/admin/employees" class="drawer-item">社員管理</a>
        <a href="/ui/admin?tab=users" class="drawer-item">ユーザー管理</a>
        <a href="/admin/departments" class="drawer-item">部門管理</a>
        <a href="/admin/attendance" class="drawer-item">勤怠管理</a>
        <a href="/admin/leave/requests" class="drawer-item">承認フロー</a>
        <a href="/ui/admin?tab=reports" class="drawer-item">レポート</a>
        <a href="/admin/payroll/salary" class="drawer-item">給与管理</a>
        <a href="/admin/system/settings" class="drawer-item">システム設定</a>
        <a href="/admin/system/audit-logs" class="drawer-item">監査ログ</a>
        <a href="/ui/admin?tab=refresh" class="drawer-item">トークン管理</a>
        <a href="/admin/attendance/holidays" class="drawer-item">カレンダー</a>
        <a href="/admin/attendance/shifts" class="drawer-item">シフト</a>
        <a href="/ui/admin?tab=routes" class="drawer-item">API一覧</a>
        <button id="drawerLogout" class="drawer-item" type="button">ログアウト</button>
      `;
    }
  } else if (role === 'manager') {
    // manager drawer set above; tiles rendered by renderHomeTiles below
  } else {
    // non-admin/non-manager; tiles rendered by renderHomeTiles below
  }
  const renderHomeTiles = (role) => {
    const tiles = document.querySelector('.tiles');
    if (!tiles) return;
    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin) {
      tiles.classList.add('employee-portal');
      tiles.innerHTML = `
        <div class="emp-tiles-3">
          <a class="tile" href="/ui/attendance/simple">
            <div class="icon">🕒</div>
            <div class="title">勤怠入力</div>
          </a>
          <a class="tile" href="/ui/expenses">
            <div class="icon">💳</div>
            <div class="title">経費精算</div>
          </a>
          <a class="tile" href="/ui/adjust">
            <div class="icon">⏲</div>
            <div class="title">調整申請</div>
          </a>
        </div>
        <div class="emp-tiles-2">
          <a class="tile emp-wide" href="/ui/chatbot">
            <div class="icon">💬</div>
            <div class="title">エンジニア<br>サポートセンター</div>
            <div class="arrow">›</div>
          </a>
          <a class="tile emp-wide" href="/ui/salary">
            <div class="icon">💴</div>
            <div class="title">給与明細など</div>
            <div class="arrow">›</div>
          </a>
        </div>
      `;
      return;
    }
    const cfg = [
      { key: 'attendance_manage', title: '勤怠管理', icon: '', href: (r) => (r === 'admin' || r === 'manager') ? '/admin/attendance' : '/ui/attendance', desc: (r) => (r === 'admin' || r === 'manager') ? 'Team attendance (missing/late)' : 'Attendance overview', prio: 10 },
      { key: 'users', title: 'ユーザー管理', icon: '👥', href: '/ui/admin?tab=users', desc: 'User management', adminOnly: true, prio: 12 },
      { key: 'departments', title: '部門管理', icon: '🏢', href: '/admin/departments', desc: 'Departments', adminOnly: true, prio: 14 },
      { key: 'admin', title: '社員管理', icon: '🛠', href: '/admin/employees', desc: 'Admin portal', adminOnly: true, prio: 16 },
      { key: 'attendance_in', title: '勤怠入力', icon: '', href: '/ui/attendance/simple', desc: 'Daily time input', prio: 20, hideForAdmin: true },
      { key: 'paid_leave', title: '有給休暇', icon: '🏝', href: '/ui/requests', desc: 'Paid leave', prio: 25 },
      { key: 'paid_leave_manage', title: '有給休暇管理', icon: '🏝', href: '/admin/leave/balance', desc: 'Paid leave admin', adminOnly: true, prio: 22 },
      { key: 'leave', title: '申請', icon: '📝', href: '/ui/requests', desc: 'Leave & requests', prio: 30, hideForAdmin: true },
      { key: 'overtime', title: '残業申請', icon: '⏲', href: '/ui/adjust?type=overtime', desc: 'Overtime / time correction request', prio: 32, hideForAdmin: true },
      { key: 'overtime_manage', title: '残業管理', icon: '⏲', href: '/admin/leave/requests', desc: 'Overtime management', adminOnly: true, prio: 18 },
      { key: 'requests_manage', title: '申請管理', icon: '🗂', href: '/admin/leave/requests', desc: 'Requests management', adminOnly: true, prio: 19 },
      { key: 'expenses', title: '経費精算', icon: '💳', href: '/ui/expenses', desc: 'Expense claims', prio: 34 },
      { key: 'salary', title: (r) => (r === 'admin' || r === 'manager') ? '給与管理' : '給与明細', icon: '💴', href: (r) => (r === 'admin' || r === 'manager') ? '/admin/payroll/salary' : '/ui/salary', desc: (r) => (r === 'admin' || r === 'manager') ? 'Salary management' : 'Payslips', prio: 36 },
      { key: 'salary_calc', title: '給与計算', icon: '🧮', href: '/ui/admin?tab=salary_calc', desc: 'Payroll calculation', adminOnly: true, prio: 37 },
      { key: 'salary_send', title: '給与明細送信', icon: '📧', href: '/admin/payroll/payslips', desc: 'Send payslips', adminOnly: true, prio: 38 },
      { key: 'calendar', title: 'カレンダー', icon: '📆', href: '/admin/attendance/holidays', desc: 'Work calendar', adminOnly: true, prio: 40 },
      { key: 'shifts', title: 'シフト', icon: '🗓', href: '/admin/attendance/shifts', desc: 'Shift planning', adminOnly: true, prio: 42 },
      { key: 'reports', title: 'レポート', icon: '📊', href: '/ui/admin?tab=reports', desc: 'Reports', adminOnly: true, prio: 50 },
      { key: 'settings', title: 'システム設定', icon: '⚙️', href: '/admin/system/settings', desc: 'System settings', adminOnly: true, prio: 60 },
      { key: 'audit', title: '監査ログ', icon: '🧾', href: '/admin/system/audit-logs', desc: 'Audit logs', adminOnly: true, prio: 62 },
      { key: 'tokens', title: 'トークン管理', icon: '🔑', href: '/ui/admin?tab=refresh', desc: 'Token control', adminOnly: true, prio: 64 },
      { key: 'api', title: 'API一覧', icon: '🔗', href: '/ui/admin?tab=routes', desc: 'API list', adminOnly: true, prio: 66 },
      { key: 'contacts', title: 'お問い合わせ先', icon: '☎', href: '/ui/contact', desc: 'Contacts', prio: 80 },
      { key: 'help', title: 'サポート', icon: '💬', href: '/ui/chatbot', desc: 'Help center', prio: 82 },
      { key: 'profile', title: 'プロフィール', icon: '👤', href: '/ui/dashboard', desc: 'Profile overview', prio: 90 }
    ];
    const items = cfg
      .filter(c => (isAdmin || !c.adminOnly) && !(isAdmin && c.hideForAdmin))
      .sort((a, b) => ((a.prio == null ? 100 : a.prio) - (b.prio == null ? 100 : b.prio)));
    tiles.innerHTML = items.map(c => {
      const link = typeof c.href === 'function' ? c.href(role) : c.href;
      const title = typeof c.title === 'function' ? c.title(role) : c.title;
      const desc = typeof c.desc === 'function' ? c.desc(role) : (c.desc || '');
      return `
      <a class="tile" href="${link}">
        ${c.icon ? `<div class="icon">${c.icon}</div>` : ''}
        <div class="title">${title}</div>
        <div class="desc">${desc}</div>
      </a>
    `;
    }).join('');
  };
  renderHomeTiles(role);
  try {
    const brand = document.querySelector('.topbar .brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/ui/portal';
      });
    }
  } catch { }
  /* dùng biến pageSpinner đã khai báo ở đầu scope */
  function navigateWithSpinner(href) {
    const goSoft = window.__employeeSoftNavigate;
    if (typeof goSoft === 'function') {
      goSoft(href, true).then((ok) => {
        if (!ok) window.location.href = href;
      }).catch(() => { window.location.href = href; });
      return;
    }
    window.location.href = href;
  }
  const tilesSection = document.querySelector('.tiles');
  if (tilesSection) {
    tilesSection.addEventListener('click', (e) => {
      const a = e.target?.closest?.('a.tile');
      if (a && a.href && a.target !== '_blank') {
        e.preventDefault();
        navigateWithSpinner(a.href);
      }
    });
  }
  const drawerEl = document.querySelector('#mobileDrawer');
  if (drawerEl) {
    drawerEl.addEventListener('click', async (e) => {
      const btn = e.target?.closest?.('#drawerLogout');
      if (btn) {
        try { await logout(); } catch { }
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch { }
        window.location.replace('/ui/login');
      }
    });
  }
  const adminTile = document.querySelector('#tile-admin');
  if (adminTile) {
    if (role === 'admin') {
      adminTile.style.display = '';
    } else {
      adminTile.style.display = 'none';
    }
  }
  if (status) status.textContent = '';
  if (tilesRoot) { tilesRoot.style.visibility = ''; }
  markTopbarReady();
  const input = document.querySelector('.search input');
  if (input) {
    const tiles = Array.from(document.querySelectorAll('.tiles .tile'));
    const applyFilter = () => {
      const q = input.value.trim().toLowerCase();
      tiles.forEach(t => {
        const text = String(t.textContent || '').toLowerCase();
        const match = q.length === 0 || text.includes(q);
        t.style.display = match ? '' : 'none';
      });
    };
    input.addEventListener('input', applyFilter);
    input.addEventListener('change', applyFilter);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = tiles.find(t => t.style.display !== 'none');
        if (first) first.click();
      }
    });
  }
  const imgIcons = document.querySelectorAll('.tile .img-icon');
  imgIcons.forEach(img => {
    img.addEventListener('error', () => {
      img.src = '/static/images/iconlogin.png';
    }, { once: true });
  });
  const userBtn = document.querySelector('.user .user-btn');
  const dropdown = document.querySelector('#userDropdown');
  if (userBtn && dropdown) {
    userBtn.addEventListener('click', () => {
      const hidden = dropdown.hasAttribute('hidden');
      if (hidden) {
        dropdown.removeAttribute('hidden');
        userBtn.setAttribute('aria-expanded', 'true');
        const firstItem = dropdown.querySelector('.item, a, button');
        if (firstItem && typeof firstItem.focus === 'function') {
          try { firstItem.focus(); } catch { }
        }
      } else {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      }
    });
    const btnLogout = document.querySelector('#btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        try { await logout(); } catch { }
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch { }
        window.location.replace('/ui/login');
      });
    }
    const items = dropdown.querySelectorAll('.item, a, button');
    items.forEach(el => {
      el.addEventListener('click', () => {
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  const mobileBtn = document.querySelector('#mobileMenuBtn');
  const mobileDrawer = document.querySelector('#mobileDrawer');
  const mobileClose = document.querySelector('#mobileClose');
  const mobileBackdrop = document.querySelector('#drawerBackdrop');
  if (mobileBtn && mobileDrawer) {
    const isMobileViewport = () => {
      try { return (window.innerWidth || 0) <= 480; } catch { return false; }
    };
    let drawerScrollY = 0;
    const lockViewport = () => {
      try {
        drawerScrollY = window.scrollY || window.pageYOffset || 0;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${drawerScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
      } catch { }
    };
    const unlockViewport = () => {
      try {
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, Math.max(0, Number(drawerScrollY) || 0));
      } catch { }
    };
    const swallowWhenDrawerOpen = (e) => {
      try {
        if (!document.body.classList.contains('drawer-open')) return;
        const inDrawer = e.target && e.target.closest && e.target.closest('#mobileDrawer');
        if (inDrawer) return;
        e.preventDefault();
      } catch { }
    };
    document.addEventListener('touchmove', swallowWhenDrawerOpen, { passive: false });
    document.addEventListener('wheel', swallowWhenDrawerOpen, { passive: false });
    const toggleDrawer = (open) => {
      if (!isMobileViewport()) {
        try {
          mobileDrawer.setAttribute('hidden', '');
          mobileBtn.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('drawer-open');
          unlockViewport();
          if (mobileBackdrop) mobileBackdrop.setAttribute('hidden', '');
        } catch { }
        return;
      }
      const isHidden = mobileDrawer.hasAttribute('hidden');
      const shouldOpen = typeof open === 'boolean' ? open : isHidden;
      if (shouldOpen) {
        mobileDrawer.removeAttribute('hidden');
        mobileBtn.setAttribute('aria-expanded', 'true');
        try {
          const w = Math.round(mobileDrawer.getBoundingClientRect().width || 280);
          document.documentElement.style.setProperty('--drawer-offset', `${w}px`);
          document.body.classList.add('drawer-open');
          lockViewport();
        } catch { }
        if (mobileBackdrop) { mobileBackdrop.removeAttribute('hidden'); }
      } else {
        mobileDrawer.setAttribute('hidden', '');
        mobileBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('drawer-open');
        unlockViewport();
        if (mobileBackdrop) { mobileBackdrop.setAttribute('hidden', ''); }
      }
    };
    mobileBtn.addEventListener('click', () => {
      if (!isMobileViewport()) return;
      toggleDrawer();
    });
    if (mobileClose) mobileClose.addEventListener('click', () => toggleDrawer(false));
    mobileDrawer.addEventListener('click', (e) => {
      const link = e.target?.closest?.('a[href]');
      if (!link) return;
      const href = String(link.getAttribute('href') || '').trim();
      if (!href) return;
      if (!isMobileViewport()) return;
      e.preventDefault();
      toggleDrawer(false);
      let to = null;
      try { to = new URL(href, window.location.href); } catch { to = null; }
      if (!to) return;
      if (to.pathname === window.location.pathname && to.search === window.location.search) return;
      window.location.href = to.pathname + to.search + to.hash;
    });
    window.addEventListener('resize', () => {
      if (!isMobileViewport()) toggleDrawer(false);
    }, { passive: true });
    if (!isMobileViewport()) toggleDrawer(false);
    /* backdrop không đóng, chỉ nút X mới đóng */
  }
  try { wireExpandingSearch(); } catch { }
});
