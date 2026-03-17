import { me, refresh, logout } from '../api/auth.api.js';
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from '../api/employees.api.js';
import { listDepartments } from '../api/departments.api.js';
import { listUsers, deleteUser as deleteUserAccount, resetUserPassword } from '../api/users.api.js';
import { getTimesheet, getAttendanceDay, updateAttendanceSegment, buildTimesheetExportURL } from '../api/attendance.api.js';

const $ = (sel) => document.querySelector(sel);

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureAdmin() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) {
    try { profile = await me(token); } catch {}
  }
  if (!profile) {
    try {
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      const r = await refresh(rt || undefined);
      sessionStorage.setItem('accessToken', r.accessToken);
      try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
      token = r.accessToken;
      profile = await me(token);
    } catch {}
  }
  if (!profile) {
    try {
      const rt2 = localStorage.getItem('refreshToken') || '';
      if (rt2) {
        const r2 = await refresh(rt2);
        sessionStorage.setItem('accessToken', r2.accessToken);
        try { sessionStorage.setItem('refreshToken', r2.refreshToken || rt2); } catch {}
        token = r2.accessToken;
        profile = await me(token);
      }
    } catch {}
  }
  if (!profile) {
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && user.role && (String(user.role).toLowerCase() === 'admin' || String(user.role).toLowerCase() === 'manager')) {
        profile = user;
        try {
          const rt3 = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          if (rt3) {
            const r3 = await refresh(rt3);
            sessionStorage.setItem('accessToken', r3.accessToken);
            try { sessionStorage.setItem('refreshToken', r3.refreshToken || rt3); localStorage.setItem('refreshToken', r3.refreshToken || rt3); } catch {}
          }
        } catch {}
      }
    } catch {}
  }
  if (!profile) {
    const err = document.querySelector('#error');
    if (err) { err.style.display = 'block'; err.textContent = 'ログインが必要です。もう一度ログインしてください。'; }
    try {
      const sp = document.querySelector('#pageSpinner');
      if (sp) { sp.setAttribute('hidden', ''); sp.style.display = 'none'; }
    } catch {}
    setTimeout(() => { try { window.location.replace('/ui/login'); } catch {} }, 200);
    return null;
  }
  const role = String(profile.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    const err = document.querySelector('#error');
    if (err) { err.style.display = 'block'; err.textContent = '管理者権限が必要です。従業員ポータルへ移動してください。'; }
    return null;
  }
  return profile;
}

document.addEventListener('DOMContentLoaded', async () => {
  let _topbarH = 64;
  let _raf = null;
  let _measureDisabled = false;
  const isMobile = () => (typeof window !== 'undefined') && window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
  const setTopbarHeightVar = () => {
    try {
      if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
      const topbar = document.querySelector('.topbar');
      if (!topbar) return;
      const rect = topbar.getBoundingClientRect();
      let h = Math.round(rect?.height || 64);
      if (!(h > 40 && h < 200)) {
        const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 64;
        h = Math.min(120, Math.max(48, cur));
      }
      if (_topbarH !== h) {
        _topbarH = h;
        document.documentElement.style.setProperty('--topbar-height', `${h}px`);
      }
    } catch {}
  };
  const scheduleTopbarMeasure = () => {
    if (_measureDisabled || document.body.classList.contains('drawer-open') || isMobile()) return;
    if (_raf) return;
    _raf = requestAnimationFrame(() => {
      _raf = null;
      setTopbarHeightVar();
    });
  };
  if (isMobile()) {
    _measureDisabled = true;
    try {
      const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 56;
      document.documentElement.style.setProperty('--topbar-height', `${Math.min(120, Math.max(48, cur))}px`);
    } catch {}
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
  } catch {}
  try {
    const brand = document.querySelector('.topbar .brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', (e) => {
        const skip = e.target?.closest?.('.brand-tabs, .brand-menu, .brand-select');
        if (skip) return;
        e.preventDefault();
        window.location.href = '/ui/portal';
      });
    }
  } catch {}
  const status = $('#status');
  if (status) status.textContent = '認証を確認しています…';
  let profile = null;
  try {
    profile = await ensureAdmin();
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '認証エラー: ' + (e?.message || 'unknown'); }
  }
  if (!profile) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: Invalid or expired token'; }
    try {
      const sp = document.querySelector('#pageSpinner');
      if (sp) { sp.setAttribute('hidden', ''); sp.style.display = 'none'; }
    } catch {}
    try {
      const st = document.querySelector('#status');
      if (st) st.textContent = '';
    } catch {}
    setTimeout(() => { try { window.location.href = '/ui/login'; } catch {} }, 200);
    return;
  }
  $('#userName').textContent = profile.username || profile.email || '管理者';
  const token = sessionStorage.getItem('accessToken');
  const content = $('#adminContent');
  const params = new URLSearchParams(window.location.search);
  let tab = params.get('tab') || '';
  if (!tab && window.location.pathname.startsWith('/ui/employees')) {
    tab = 'employees';
  }
  if (content) {
    content.className = tab === 'employees' ? 'card wide' : 'card';
  }
  function renderEmployeesTopbar(mode) {
    try {
      const brand = document.querySelector('.topbar .brand');
      if (brand && document.body.classList.contains('employees-wide')) {
        brand.innerHTML = `
          <img src="/static/images/logo1.png" alt="logo" class="icon">
          <span class="logo">IIZUKA</span>
          <div class="brand-menu" style="display:inline-block;position:relative;margin-left:10px;">
            <button id="brandMenuBtn" class="brand-link">社員管理 ▾</button>
            <div class="dropdown" id="brandDropdown" hidden>
              <a href="#list" class="item" id="brandList">社員一覧</a>
              <a href="#add" class="item" id="brandAdd">社員追加</a>
              <a href="#edit" class="item" id="brandEdit" aria-disabled="true">社員編集</a>
              <a href="#delete" class="item" id="brandDelete">社員削除</a>
            </div>
          </div>
        `;
        const menuBtn = brand.querySelector('#brandMenuBtn');
        const dd = brand.querySelector('#brandDropdown');
        if (menuBtn && dd) {
          menuBtn.addEventListener('click', () => {
            const open = !dd.hasAttribute('hidden');
            if (open) dd.setAttribute('hidden','');
            else dd.removeAttribute('hidden');
          });
          document.addEventListener('click', (e) => {
            if (!dd) return;
            const inside = e.target.closest('.brand-menu');
            if (!inside) dd.setAttribute('hidden','');
          });
          dd.addEventListener('click', async (e) => {
            const a = e.target.closest('a.item');
            if (!a) return;
            e.preventDefault();
            const idSel = Array.from(document.querySelectorAll('.empSel:checked')).map(i => i.value);
            const href = a.getAttribute('href') || '#list';
            if (href === '#list') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#list`); } catch { window.location.href = `/ui/admin?tab=employees#list`; return; }
              await renderEmployees();
            } else if (href === '#add') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#add`); } catch { window.location.href = `/ui/admin?tab=employees#add`; return; }
              await renderEmployees();
            } else if (href === '#edit') {
              if (idSel.length === 1) {
                const id = idSel[0];
                try { history.pushState(null, '', `/ui/admin?tab=employees&edit=${id}`); } catch { window.location.href = `/ui/admin?tab=employees&edit=${id}`; return; }
              } else {
                try { history.pushState(null, '', `/ui/admin?tab=employees#edit`); } catch { window.location.href = `/ui/admin?tab=employees#edit`; return; }
              }
              await renderEmployees();
            } else if (href === '#delete') {
              try { history.pushState(null, '', `/ui/admin?tab=employees#delete`); } catch { window.location.href = `/ui/admin?tab=employees#delete`; return; }
              await renderEmployees();
            }
            dd.setAttribute('hidden','');
          });
        }
      }
    } catch {}
  }
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
    const sel = map[tab];
    if (sel) {
      document.querySelectorAll('.sidebar .sidebar-nav a').forEach(a => a.classList.remove('active'));
      const link = document.querySelector(sel);
      if (link) link.classList.add('active');
    }
    const logoutBtn = document.querySelector('#nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          await logout(rt);
        } catch {}
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
        window.location.replace('/ui/login');
      });
    }
  } catch {}
  try {
    if (tab === 'employees') {
      document.body.classList.add('employees-wide');
    } else {
      document.body.classList.remove('employees-wide');
    }
  } catch {}
  
  function ensureSpinnerStyle() {
    try {
      if (!document.querySelector('#spinnerStyle')) {
        const style = document.createElement('style');
        style.id = 'spinnerStyle';
        style.textContent = `
          .page-spinner{background:#fff;display:flex;align-items:center;justify-content:center}
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
    } catch {}
  }
  function ensureJapanSafeColorsStyle() {
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
          .form-title {
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
    } catch {}
  }
  ensureJapanSafeColorsStyle();
  function ensureEmployeePillStyle() {
    try {
      if (!document.querySelector('#empPillStyle')) {
        const style = document.createElement('style');
        style.id = 'empPillStyle';
        style.textContent = `
          .admin .card { --emp-pill-width: 260px; }
          .admin .card table#list { width: 100%; }
          .admin.employees-wide .card table#list:not(.emp-del-list) thead { position: sticky; top: var(--topbar-height); z-index: 19; }
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead { position: sticky; top: calc(var(--topbar-height) + var(--subbar-height)); z-index: 19; }
          .admin.employees-wide .card table#list:not(.emp-del-list) thead th { position: sticky; top: var(--topbar-height); z-index: 20; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead th { position: sticky; top: calc(var(--topbar-height) + var(--subbar-height)); z-index: 20; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
          .admin .card table#list.emp-del-list thead th { position: sticky; top: 0; z-index: 30; background: #f3f4f6; box-shadow: 0 1px 0 rgba(16,24,40,.06); }
          .admin .card table#list tbody td .text-pill,
          .admin .card table#list tbody td .status-pill,
          .admin .card table#list tbody td .role-pill,
          .admin .card table#list tbody td .type-pill { width: var(--emp-pill-width); box-sizing: border-box; }
          .admin .card table#list tbody td.col-code .text-pill { width: 140px; }
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
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }
  ensureEmployeePillStyle();
  const showNavSpinner = () => {
    try {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      let el = document.querySelector('#pageSpinner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pageSpinner';
        el.className = 'page-spinner';
        el.innerHTML = '<div class="lds-spinner" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
        el.style.position = 'fixed';
        el.style.inset = '0';
        el.style.background = '#fff';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.zIndex = '9999';
        document.body.appendChild(el);
      } else {
        el.removeAttribute('hidden');
        el.style.background = '#fff';
        el.style.display = 'flex';
      }
      const c = document.querySelector('#adminContent');
      if (c) c.style.visibility = 'hidden';
    } catch {}
  };
  const hideNavSpinner = () => {
    try {
      try { sessionStorage.removeItem('navSpinner'); } catch {}
      const el = document.querySelector('#pageSpinner');
      if (el) {
        el.setAttribute('hidden', 'true');
        el.style.display = 'none';
      }
      const c = document.querySelector('#adminContent');
      if (c) c.style.visibility = '';
    } catch {}
  };
  
  if (isMobile()) {
    _measureDisabled = true;
    try { window.removeEventListener('resize', scheduleTopbarMeasure); } catch {}
    document.documentElement.style.setProperty('--topbar-height', `${Math.min(60, Math.max(48, _topbarH))}px`);
  } else {
    _measureDisabled = false;
    try { window.addEventListener('resize', scheduleTopbarMeasure); } catch {}
  }
  try {
    async function renderByTab() {
      const params2 = new URLSearchParams(location.search || '');
      let tab2 = params2.get('tab') || '';
      if (!tab2 && location.pathname.startsWith('/ui/employees')) tab2 = 'employees';
      const contentEl2 = document.querySelector('#adminContent');
      if (contentEl2) contentEl2.className = tab2 === 'employees' ? 'card wide' : 'card';
      try {
        if (tab2 === 'employees') await renderEmployees();
        else if (tab2 === 'users') await renderUsers();
        else if (tab2 === 'dbcheck') await renderDbCheck();
        else if (tab2 === 'departments') await renderDepartments();
        else if (tab2 === 'attendance') await renderAttendance();
        else if (tab2 === 'approvals') await renderApprovals();
        else if (tab2 === 'leave') await renderLeaveHub();
        else if (tab2 === 'reports') await renderReports();
        else if (tab2 === 'leave_admin') await renderLeaveBalance();
        else if (tab2 === 'leave_grant') await renderLeaveGrant();
        else if (tab2 === 'leave_balance') await renderLeaveBalance();
        else if (tab2 === 'settings') await renderSettings();
        else if (tab2 === 'audit') await renderAudit();
        else if (tab2 === 'refresh') await renderRefresh();
        else if (tab2 === 'calendar') await renderCalendar();
        else if (tab2 === 'shifts') await renderShifts();
        else if (tab2 === 'routes') await renderRoutes();
        else if (tab2 === 'salary_list') await renderSalaryList();
        else if (tab2 === 'salary_calc') await renderSalaryCalc();
        else if (tab2 === 'salary_send') await renderPayslipSend();
        else if (tab2 === 'payslip_upload') await renderPayslipUpload();
        else { await renderHome(); }
      } finally {
        hideNavSpinner();
      }
    }
    window.addEventListener('hashchange', async () => { hideNavSpinner(); await renderByTab(); });
    window.addEventListener('popstate', async () => { hideNavSpinner(); await renderByTab(); });
    await renderByTab();
  } catch {}
  const tilesSection = document.querySelector('.tiles');
  if (tilesSection) tilesSection.style.display = tab ? 'none' : '';
  const subBrand = document.querySelector('.brand .sub');
  if (subBrand) {
    subBrand.style.display = tab === 'settings' ? 'none' : '';
    setTopbarHeightVar();
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
    setTimeout(() => { try { window.location.href = '/ui/login'; } catch {} }, 200);
  }
  async function fetchJSONAuth(url, options) {
    let tok = sessionStorage.getItem('accessToken') || token;
    const csrf = getCookie('csrfToken');
    let res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options });
    if (res.status === 401 || res.status === 403) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refresh(rt);
        sessionStorage.setItem('accessToken', r.accessToken);
        try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
        tok = r.accessToken;
        res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf || '' }, credentials: 'include', ...options });
      } catch {}
    }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.message || msg; } catch {}
      const m = String(msg || '').toLowerCase();
      if (res.status === 403 && m.includes('forbidden')) {
        const el = document.querySelector('#error');
        if (el) { el.style.display = 'block'; el.textContent = '管理者権限が必要です。アクセスが拒否されました。'; }
      } else if ((res.status === 401 || res.status === 403) && (m.includes('invalid or expired token') || m.includes('no token provided') || m.includes('missing refresh token') || m.includes('missing refreshtoken') || m.includes('csrf validation failed') || m.includes('unauthorized'))) {
        const el = document.querySelector('#error');
        if (el) { el.style.display = 'block'; el.textContent = 'ログインが必要です。もう一度ログインしてください。'; }
        redirectToLoginOnce();
      }
      throw new Error(msg);
    }
    return res.json();
  }

  async function downloadWithAuth(url, filename) {
    let tok = sessionStorage.getItem('accessToken') || token;
    const csrf = getCookie('csrfToken');
    let res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf || '' }, credentials: 'include' });
    if (res.status === 401 || res.status === 403) {
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        const r = await refresh(rt);
        sessionStorage.setItem('accessToken', r.accessToken);
        try { sessionStorage.setItem('refreshToken', r.refreshToken || rt); localStorage.setItem('refreshToken', r.refreshToken || rt); } catch {}
        tok = r.accessToken;
        const csrf2 = getCookie('csrfToken');
        res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + tok, 'X-CSRF-Token': csrf2 || '' }, credentials: 'include' });
      } catch {}
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename || 'download';
    a.click();
    setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch {} }, 1000);
  }
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
          try { firstItem.focus(); } catch {}
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
        try {
          const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          await logout(rt);
        } catch {}
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
        dropdown.setAttribute('hidden', '');
        userBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a');
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
        try { sessionStorage.setItem('navSpinner', '1'); } catch {}
        showNavSpinner();
      }
      if (a.classList.contains('tile')) {
        e.preventDefault();
        setTimeout(() => { window.location.href = href; }, 600);
      }
    }
  });
  const mobileBtn = document.querySelector('#mobileMenuBtn');
  const mobileDrawer = document.querySelector('#mobileDrawer');
  const mobileClose = document.querySelector('#mobileClose');
  const mobileBackdrop = document.querySelector('#drawerBackdrop');
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
        } catch {}
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
    /* backdrop không đóng, chỉ nút X mới đóng */
  }
  async function renderUsers() {
    const rows = await listUsers();
    content.innerHTML = '<h3>ユーザー一覧</h3>';
    const table = document.createElement('table');
    table.style.width = 'auto';
    table.style.minWidth = '880px';
    table.style.tableLayout = 'auto';
    table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>Email</th><th>Role</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.username || ''}</td>
        <td>${r.email || ''}</td>
        <td>${r.role || ''}</td>
        <td>
          <button data-detail="${r.id}">詳細</button>
          <button data-resetpw="${r.id}">PWリセット</button>
          <button data-lock="${r.id}">ロック</button>
          <button data-unlock="${r.id}">ロック解除</button>
          <button data-delete="${r.id}">削除</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    content.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-delete');
      const rid = e.target?.getAttribute?.('data-resetpw');
      const lid = e.target?.getAttribute?.('data-lock');
      const uid = e.target?.getAttribute?.('data-unlock');
      const did = e.target?.getAttribute?.('data-detail');
      if (id) {
        if (confirm('削除しますか？')) {
          await deleteUserAccount(id);
          await renderUsers();
        }
      } else if (rid) {
        const newPw = prompt('新しいパスワードを入力');
        if (newPw && newPw.length >= 6) {
          await resetUserPassword(rid, newPw);
          alert('PW更新しました');
        }
      } else if (lid) {
        const minsStr = prompt('ロック分数 (既定: 60)');
        const minutes = parseInt(minsStr || '60', 10);
        await fetchJSONAuth(`/api/admin/users/${lid}/lock`, { method: 'PATCH', body: JSON.stringify({ minutes }) });
        alert('ロックしました');
      } else if (uid) {
        await fetchJSONAuth(`/api/admin/users/${uid}/unlock`, { method: 'PATCH' });
        alert('ロック解除しました');
      } else if (did) {
        const u = rows.find(x => String(x.id) === String(did));
        if (u) {
          alert(`ID: ${u.id}\n名前: ${u.username || ''}\nEmail: ${u.email || ''}\nRole: ${u.role || ''}`);
        }
      }
    });
  }
  async function renderDepartments() {
    const rows = await listDepartments();
    const users = await listUsers();
    content.innerHTML = '<h3>部門管理</h3>';
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="deptName" placeholder="部門名">
      <button type="submit">作成</button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.querySelector('#deptName').value.trim();
      if (!name) return;
      await fetchJSONAuth('/api/admin/departments', { method: 'POST', body: JSON.stringify({ name }) });
      await renderDepartments();
    });
    content.appendChild(form);
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>コード</th><th>名前</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const d of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.id}</td>
        <td><input data-dept-code="${d.id}" value="${d.code || ''}" placeholder="例: HR, ENG"></td>
        <td><input data-dept-name="${d.id}" value="${d.name}"></td>
        <td>
          <button data-dept-save="${d.id}">保存</button>
          <button data-dept-del="${d.id}">削除</button>
          <button data-dept-users="${d.id}">社員一覧</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    const listDiv = document.createElement('div');
    content.appendChild(listDiv);
    content.addEventListener('click', async (e) => {
      const sid = e.target?.getAttribute?.('data-dept-save');
      const did = e.target?.getAttribute?.('data-dept-del');
      const uid = e.target?.getAttribute?.('data-dept-users');
      if (sid) {
        const name = content.querySelector(`input[data-dept-name="${sid}"]`).value.trim();
        const code = content.querySelector(`input[data-dept-code="${sid}"]`)?.value.trim() || null;
        await fetchJSONAuth(`/api/admin/departments/${sid}`, { method: 'PATCH', body: JSON.stringify({ name, code }) });
        alert('保存しました');
      } else if (did) {
        if (confirm('削除しますか？')) {
          await fetchJSONAuth(`/api/admin/departments/${did}`, { method: 'DELETE' });
          await renderDepartments();
        }
      } else if (uid) {
        const list = users.filter(u => String(u.departmentId || '') === String(uid));
        listDiv.innerHTML = '<h4>所属社員</h4>';
        const ul = document.createElement('ul');
        for (const u of list) {
          const li = document.createElement('li');
          li.textContent = `${u.id} ${u.username || u.email}`;
          ul.appendChild(li);
        }
        listDiv.appendChild(ul);
      }
    });
  }
  async function renderSettings() {
    const prefs = (() => { try { return JSON.parse(localStorage.getItem('prefs') || '{}'); } catch { return {}; } })();
    const mailPrefs = {}; // không hiển thị sẵn các checkbox thông báo
    content.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'card wide';
    wrap.innerHTML = `
      <h3>各種設定</h3>
      <div class="two-cols">
        <div class="left">
          <form id="formUser" class="section">
            <div class="section-head">
              <h4>ユーザ情報</h4>
              <div class="actions"><button type="button" id="btnCancelUser">キャンセル</button><button type="submit" id="btnSaveUser">保存</button></div>
            </div>
            <div class="row"><label>ユーザー名</label><input id="setName" placeholder="氏名" value="${profile.username || ''}"></div>
            <div class="row"><label>メールアドレス <span style="color:#b00020;">＊必須情報</span></label><input id="setEmail" placeholder="email@example.com" value="${profile.email || ''}"></div>
            <div class="row"><label>パスワード</label><input id="setPass" type="password" placeholder="新しいパスワード"></div>
          </form>
          <form id="formLang" class="section">
            <div class="section-head">
              <h4>言語設定</h4>
              <div class="actions"><button type="button" id="btnCancelPrefs">キャンセル</button><button type="submit" id="btnSavePrefs">保存</button></div>
            </div>
            <div class="row">
              <label>言語</label>
              <select id="langSel">
                <option value="ja" ${prefs.lang==='ja'?'selected':''}>日本語</option>
                <option value="en" ${prefs.lang==='en'?'selected':''}>English</option>
                <option value="vi" ${prefs.lang==='vi'?'selected':''}>Tiếng Việt</option>
              </select>
            </div>
            <div class="row">
              <label>地域</label>
              <select id="regionSel">
                <option value="ja-JP" ${prefs.region==='ja-JP'?'selected':''}>日本語 (日本)</option>
                <option value="en-US" ${prefs.region==='en-US'?'selected':''}>English (United States)</option>
                <option value="vi-VN" ${prefs.region==='vi-VN'?'selected':''}>Tiếng Việt (Việt Nam)</option>
              </select>
            </div>
            <div class="row">
              <label>タイムゾーン</label>
              <select id="tzSel">
                <option value="Asia/Tokyo" ${prefs.tz==='Asia/Tokyo'?'selected':''}>GMT+09:00 日本標準時 (Asia/Tokyo)</option>
                <option value="UTC" ${prefs.tz==='UTC'?'selected':''}>UTC</option>
                <option value="Asia/Ho_Chi_Minh" ${prefs.tz==='Asia/Ho_Chi_Minh'?'selected':''}>GMT+07:00 (Asia/Ho_Chi_Minh)</option>
              </select>
            </div>
          </form>
        </div>
        <div class="right">
          <form id="formMail" class="section">
            <div class="section-head">
              <h4>メール設定</h4>
              <div class="actions"><button type="button" id="btnCancelMail">キャンセル</button><button type="submit" id="btnSaveMail">保存</button></div>
            </div>
            <div class="row single"><label><input type="checkbox" id="mail_enabled">メール通知を有効にする</label></div>
            <div style="margin:8px 16px;color:#3a6ea5;">VITEアカウントの設定変更を通知して、重要な変更を見逃さないようにしましょう。</div>
            <div class="row single"><label><input type="checkbox" id="mail_topic">トピックの作成を通知</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_profile_update">プロフィールの更新を通知</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_my_comment">私の投稿へのコメント</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_file_comment">ファイルへのコメント</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_mention">メンションされた時</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_reply">返信が付いた時</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_like_comment">私のコメントに「いいね」が付いた</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_reply_comment">私のコメントに返信が付いた</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_blog_update">自分のブログのアップデート</label></div>
            <div class="row single"><label><input type="checkbox" id="mail_page_update">自分のプロファイルページのアップデート</label></div>
          </form>
        </div>
      </div>
    `;
    content.appendChild(wrap);
    const formUser = wrap.querySelector('#formUser');
    formUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailVal = wrap.querySelector('#setEmail').value.trim();
      const emailOk = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(emailVal);
      if (!emailOk) { alert('メールアドレスの形式が正しくありません'); return; }
      const b = {
        username: wrap.querySelector('#setName').value.trim() || null,
        email: emailVal || null
      };
      await fetchJSONAuth(`/api/users/me`, { method: 'PATCH', body: JSON.stringify(b) });
      const pass = wrap.querySelector('#setPass').value;
      if (pass && pass.length >= 6) {
        if ((profile.role || '').toLowerCase() === 'admin') {
          await fetchJSONAuth(`/api/admin/users/${encodeURIComponent(profile.id)}/password`, { method: 'PATCH', body: JSON.stringify({ password: pass }) });
        } else {
          alert('パスワード変更は現在のパスワードが必要です'); 
        }
      }
      alert('保存しました');
    });
    const btnCancelUser = wrap.querySelector('#btnCancelUser');
    if (btnCancelUser) btnCancelUser.addEventListener('click', () => { window.location.href = '/ui/admin'; });
    const formLang = wrap.querySelector('#formLang');
    formLang.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPrefs = {
        lang: wrap.querySelector('#langSel').value,
        region: wrap.querySelector('#regionSel').value,
        tz: wrap.querySelector('#tzSel').value
      };
      localStorage.setItem('prefs', JSON.stringify(newPrefs));
      await fetchJSONAuth(`/api/users/me`, { method: 'PATCH', body: JSON.stringify({ lang: newPrefs.lang, region: newPrefs.region, timezone: newPrefs.tz }) });
      alert('保存しました');
    });
    const btnCancelPrefs = wrap.querySelector('#btnCancelPrefs');
    if (btnCancelPrefs) btnCancelPrefs.addEventListener('click', () => { window.location.href = '/ui/admin'; });
    const formMail = wrap.querySelector('#formMail');
    formMail.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newMail = {
        enabled: wrap.querySelector('#mail_enabled').checked,
        topic: wrap.querySelector('#mail_topic').checked,
        profile_update: wrap.querySelector('#mail_profile_update').checked,
        my_comment: wrap.querySelector('#mail_my_comment').checked,
        file_comment: wrap.querySelector('#mail_file_comment').checked,
        mention: wrap.querySelector('#mail_mention').checked,
        reply: wrap.querySelector('#mail_reply').checked,
        like_comment: wrap.querySelector('#mail_like_comment').checked,
        reply_comment: wrap.querySelector('#mail_reply_comment').checked,
        blog_update: wrap.querySelector('#mail_blog_update').checked,
        page_update: wrap.querySelector('#mail_page_update').checked
      };
      localStorage.setItem('mailPrefs', JSON.stringify(newMail));
      alert('保存しました');
    });
    const btnCancelMail = wrap.querySelector('#btnCancelMail');
    if (btnCancelMail) btnCancelMail.addEventListener('click', () => { window.location.href = '/ui/admin'; });
  }
  async function renderAudit() {
    const r = await fetchJSONAuth('/api/admin/audit');
    content.innerHTML = '<h3>監査ログ</h3>';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(r, null, 2);
    content.appendChild(pre);
  }
  async function renderRefresh() {
    content.innerHTML = '<h3>トークン管理</h3>';
    const q = await fetchJSONAuth(`/api/admin/auth/refresh/list?userId=${encodeURIComponent(profile.id)}&page=1&pageSize=20`);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(q, null, 2);
    content.appendChild(pre);
  }
  async function renderCalendar() {
    const year = new Date().getUTCFullYear();
    const ping = await fetchJSONAuth(`/api/admin/calendar/ping?year=${year}`);
    const data = await fetchJSONAuth(`/api/admin/calendar/holidays?year=${year}`);
    content.innerHTML = '<h3>カレンダー</h3>';
    const info = document.createElement('div');
    info.textContent = `Ping: ${ping?.version || 'ok'}, Year: ${ping?.year || year}, 件数: ${(data?.rows || data)?.length || 0}`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    content.appendChild(info);
    content.appendChild(pre);
  }
  async function renderShifts() {
    const defs = await fetchJSONAuth('/api/admin/shifts/definitions');
    content.innerHTML = '<h3>シフト定義</h3>';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>開始</th><th>終了</th><th>休憩(分)</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const s of defs) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${s.id}</td><td>${s.name||''}</td><td>${s.start_time||''}</td><td>${s.end_time||''}</td><td>${s.break_minutes||0}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
    const form = document.createElement('form');
    form.innerHTML = `
      <h4>新規シフト</h4>
      <input id="shiftName" placeholder="名前">
      <input id="shiftStart" placeholder="開始(HH:MM)">
      <input id="shiftEnd" placeholder="終了(HH:MM)">
      <input id="shiftBreak" type="number" placeholder="休憩(分)" value="0">
      <button type="submit">作成</button>
    `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = {
        name: document.querySelector('#shiftName').value.trim(),
        start_time: document.querySelector('#shiftStart').value.trim(),
        end_time: document.querySelector('#shiftEnd').value.trim(),
        break_minutes: parseInt(document.querySelector('#shiftBreak').value || '0', 10)
      };
      await fetchJSONAuth('/api/admin/shifts/definitions', { method: 'POST', body: JSON.stringify(b) });
      await renderShifts();
    });
    content.appendChild(form);
    const assign = document.createElement('form');
    assign.innerHTML = `
      <h4>シフト割当</h4>
      <input id="assignUserId" type="number" placeholder="userId">
      <input id="assignShiftId" type="number" placeholder="shiftId">
      <input id="assignStart" placeholder="開始日(YYYY-MM-DD)">
      <input id="assignEnd" placeholder="終了日(YYYY-MM-DD)">
      <button type="submit">割当</button>
    `;
    assign.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = {
        userId: parseInt(document.querySelector('#assignUserId').value, 10),
        shiftId: parseInt(document.querySelector('#assignShiftId').value, 10),
        startDate: document.querySelector('#assignStart').value.trim(),
        endDate: document.querySelector('#assignEnd').value.trim() || null
      };
      await fetchJSONAuth('/api/admin/shifts/assign', { method: 'POST', body: JSON.stringify(b) });
      alert('割当完了');
    });
    content.appendChild(assign);
  }
  async function renderRoutes() {
    const r = await fetchJSONAuth('/api/debug/routes');
    content.innerHTML = '<h3>API一覧</h3>';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>Path</th><th>Methods</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const it of (r.routes || [])) {
      const tr = document.createElement('tr');
      const methods = Array.isArray(it.methods) ? it.methods.join(', ').toUpperCase() : Object.keys(it.methods||{}).join(', ').toUpperCase();
      tr.innerHTML = `<td>${it.path}</td><td>${methods}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }
  let employeesRenderSeq = 0;
  async function renderEmployees() {
    try {
      const f = sessionStorage.getItem('navSpinner');
      if (f === '1') showNavSpinner();
    } catch {}
    const seq = ++employeesRenderSeq;
    const params = new URLSearchParams(location.search);
    const detailId = params.get('detail');
    const editId = params.get('edit');
    const createFlag = params.get('create');
    const role2 = String((profile && profile.role) || '').toLowerCase();
    const hash = location.hash || (detailId || editId || createFlag ? '' : '#list');
    let mode = 'list';
    if (editId) mode = 'edit';
    else if (createFlag || hash === '#add') mode = 'add';
    else if (hash === '#delete') mode = 'delete';
    else if (hash === '#edit') mode = 'edit';
    try {
      if (mode === 'list' && location.hash !== '#list') {
        history.replaceState(null, '', '#list');
      }
    } catch {}
    try {
      const contentEl = document.querySelector('#adminContent');
      if (contentEl) {
        contentEl.style.paddingTop = mode === 'delete' ? '0' : '';
        contentEl.style.marginTop = mode === 'delete' ? '-12px' : '';
      }
      const subbarEl = document.querySelector('.subbar');
      if (subbarEl) subbarEl.style.display = mode === 'delete' ? 'none' : '';
      try {
        if (mode === 'delete') {
          document.body.classList.add('emp-delete-mode');
          document.documentElement.classList.add('emp-delete-mode');
        } else {
          document.body.classList.remove('emp-delete-mode');
          document.documentElement.classList.remove('emp-delete-mode');
        }
      } catch {}
      if (mode === 'delete') {
        try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0,0); }
      }
    } catch {}
    if (detailId) {
      const u = await getEmployee(detailId);
      if (seq !== employeesRenderSeq) return;
      let depts2 = [];
      try { depts2 = role2==='manager' ? await fetchJSONAuth('/api/manager/departments') : await listDepartments(); } catch { depts2 = []; }
      if (seq !== employeesRenderSeq) return;
      const deptName2 = (id) => {
        const d = depts2.find(x => String(x.id) === String(id));
        return d ? d.name : '';
      };
      const statusJa2 = (s) => {
        const v = String(s || '').toLowerCase();
        if (v === 'inactive') return '無効';
        if (v === 'retired') return '退職';
        return '在職';
      };
      const fmtDate2 = (d) => {
        if (!d || String(d) === '-' || String(d) === '0000-00-00') return '未登録';
        const raw = String(d);
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[1]}/${m[2]}/${m[3]}`;
        try {
          const x = new Date(raw);
          if (!isNaN(x.getTime())) return `${x.getFullYear()}/${String(x.getMonth()+1).padStart(2,'0')}/${String(x.getDate()).padStart(2,'0')}`;
        } catch {}
        return raw;
      };
      content.innerHTML = '<h3 class="excel-header">社員詳細</h3>';
      const panel = document.createElement('div');
      panel.className = 'card detail-card';
      const roleV = String(u.role || '').toLowerCase();
      const roleJa3 = roleV==='admin' ? '管理者' : roleV==='manager' ? 'マネージャー' : roleV==='employee' ? '従業員' : (u.role||'');
      const roleCls3 = roleV==='admin' ? 'admin' : roleV==='manager' ? 'manager' : 'employee';
      const typeV = String(u.employment_type || '').toLowerCase();
      const typeJa3 = typeV==='full_time' ? '正社員' : typeV==='part_time' ? 'パート・アルバイト' : typeV==='contract' ? '契約社員' : (u.employment_type||'');
      const typeCls3 = typeV==='full_time' ? 'full' : typeV==='part_time' ? 'part' : typeV==='contract' ? 'contract' : '';
      const statusV = String(u.employment_status || '').toLowerCase();
      const statusCls3 = statusV==='retired' ? 'retired' : statusV==='inactive' ? 'inactive' : 'active';
      const name3 = (u.username || u.email || '').trim();
      const ini3 = name3 ? name3[0].toUpperCase() : '?';
      let mgrName3 = '';
      try {
        const allUsers3 = role2==='manager' ? await fetchJSONAuth('/api/manager/users') : await listUsers();
        const mgr3 = allUsers3.find(x => String(x.id) === String(u.manager_id));
        mgrName3 = mgr3 ? (mgr3.username || mgr3.email) : '';
      } catch {}
      const avatarBlock3 = u.avatar_url ? `<img class="avatar-img" src="${u.avatar_url}" alt="avatar">` : `<div class="avatar">${ini3}</div>`;
      panel.innerHTML = `
        <div class="head">
          ${avatarBlock3}
          <div class="info">
            <div class="title">${u.username || ''}</div>
            <div class="subtitle">${u.email || ''}</div>
          </div>
          <span class="status-pill ${statusCls3}">${statusJa2(u.employment_status)}</span>
        </div>
        <div class="detail-row"><div class="label">社員番号</div><div class="value">${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}</div></div>
        <div class="detail-row"><div class="label">氏名</div><div class="value">${u.username || ''}</div></div>
        <div class="detail-row"><div class="label">Email</div><div class="value">${u.email || ''}</div></div>
        <div class="detail-row"><div class="label">電話番号</div><div class="value">${u.phone || ''}</div></div>
        <div class="detail-row"><div class="label">生年月日</div><div class="value">${fmtDate2(u.birth_date)}</div></div>
        <div class="detail-row"><div class="label">部署</div><div class="value">${deptName2(u.departmentId)}</div></div>
        <div class="detail-row"><div class="label">直属マネージャー</div><div class="value">${mgrName3}</div></div>
        <div class="detail-row"><div class="label">レベル</div><div class="value">${u.level || ''}</div></div>
        <div class="detail-row"><div class="label">役割</div><div class="value"><span class="role-pill ${roleCls3}">${roleJa3}</span></div></div>
        <div class="detail-row"><div class="label">雇用形態</div><div class="value"><span class="type-pill ${typeCls3}">${typeJa3}</span></div></div>
        <div class="detail-row"><div class="label">入社日</div><div class="value">${fmtDate2(u.hire_date)}</div></div>
        <div class="detail-row"><div class="label">試用開始</div><div class="value">${fmtDate2(u.probation_date)}</div></div>
        <div class="detail-row"><div class="label">正社員化</div><div class="value">${fmtDate2(u.official_date)}</div></div>
        <div class="detail-row"><div class="label">契約終了</div><div class="value">${fmtDate2(u.contract_end)}</div></div>
        <div class="detail-row"><div class="label">基本給</div><div class="value">${u.base_salary ?? ''}</div></div>
        <div class="detail-row"><div class="label">状態</div><div class="value"><span class="status-pill ${statusCls3}">${statusJa2(u.employment_status)}</span></div></div>
        <div class="detail-actions form-actions"><a class="btn" href="/ui/admin?tab=employees&edit=${u.id}">編集</a><a class="btn" href="/ui/admin?tab=employees">一覧へ</a></div>
      `;
      content.appendChild(panel);
      try {
        const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        const backHref = `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`;
        const editHref = `/ui/admin?tab=employees&edit=${u.id}${qsKeep ? '&' + qsKeep : ''}`;
        const aEls = panel.querySelectorAll('a.btn');
        if (aEls && aEls.length >= 2) {
          aEls[0].setAttribute('href', editHref);
          aEls[1].setAttribute('href', backHref);
        }
      } catch {}
      hideNavSpinner();
      return;
    }
    content.innerHTML = ``;
    renderEmployeesTopbar(mode);
    let users = [];
    let depts = [];
    let errMsgs = [];
    // load users
    try {
      users = role2==='manager' ? await fetchJSONAuth('/api/manager/users') : await listEmployees();
    } catch (e1) {
      errMsgs.push(`一覧: ${e1?.message || 'unknown'}`);
      if (role2 !== 'manager') {
        try { users = await listUsers(); } catch (e2) { errMsgs.push(`一覧(予備): ${e2?.message || 'unknown'}`); users = []; }
      } else {
        users = [];
      }
    }
    if (seq !== employeesRenderSeq) return;
    // load departments
    try {
      depts = role2==='manager' ? await fetchJSONAuth('/api/manager/departments') : await listDepartments();
    } catch (e3) {
      errMsgs.push(`部署: ${e3?.message || 'unknown'}`);
      depts = [];
    }
    if (seq !== employeesRenderSeq) return;
    if (errMsgs.length) {
      const msg = document.createElement('div');
      msg.style.color = '#b00020';
      msg.style.margin = '8px 0';
      msg.textContent = `読み込みエラー: ${errMsgs.join(' / ')}`;
      content.appendChild(msg);
    }
    if (editId) {
      const u = await getEmployee(editId);
      if (seq !== employeesRenderSeq) return;
      content.innerHTML = ``;
      renderEmployeesTopbar('edit');
      const formEdit = document.createElement('form');
      formEdit.innerHTML = `
        <div style="margin-bottom:8px;"><a id="editBack" class="btn" href="#list">← 社員一覧へ戻る</a></div>
        <h4>社員編集（${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}）</h4>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">基本情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">社員番号</td><td>${u.employee_code || ('EMP' + String(u.id).padStart(3,'0'))}</td></tr>
            <tr><td>氏名</td><td><input id="empName" style="width:240px" value="${u.username || ''}"></td></tr>
            <tr><td>メール</td><td><input id="empEmail" style="width:240px" value="${u.email || ''}"></td></tr>
            <tr><td>パスワード</td><td><input id="empPw" type="password" style="width:240px" placeholder="空欄なら変更なし"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">職務情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d=>`<option value="${d.id}" ${String(u.departmentId||'')===String(d.id)?'selected':''}>${d.name}</option>`).join('')}</select></td></tr>
            <tr><td>役割</td><td>
              <select id="empRole" style="width:240px">
                <option value="employee" ${u.role==='employee'?'selected':''}>従業員</option>
                <option value="manager" ${u.role==='manager'?'selected':''}>マネージャー</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>管理者</option>
              </select>
            </td></tr>
            <tr><td>雇用形態</td><td>
              <select id="empType" style="width:240px">
                <option value="full_time" ${u.employment_type==='full_time'?'selected':''}>正社員</option>
                <option value="part_time" ${u.employment_type==='part_time'?'selected':''}>パート・アルバイト</option>
                <option value="contract" ${u.employment_type==='contract'?'selected':''}>契約社員</option>
              </select>
            </td></tr>
            <tr><td>状態</td><td>
              <select id="empStatus" style="width:240px">
                <option value="active" ${String(u.employment_status||'')==='active'?'selected':''}>在職</option>
                <option value="inactive" ${String(u.employment_status||'')==='inactive'?'selected':''}>無効/休職</option>
                <option value="retired" ${String(u.employment_status||'')==='retired'?'selected':''}>退職</option>
              </select>
            </td></tr>
            <tr><td>直属マネージャー</td><td>
              <select id="empManager" style="width:240px"><option value="">未設定</option>${users.filter(x=>x.role==='manager').map(m=>`<option value="${m.id}" ${String(u.manager_id||'')===String(m.id)?'selected':''}>${m.username || m.email}</option>`).join('')}</select>
            </td></tr>
            <tr><td>レベル</td><td><input id="empLevel" style="width:180px" value="${u.level || ''}" placeholder="例: L1/L2/Senior"></td></tr>
            <tr><td>入社日</td><td><input id="empHireDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.hire_date || u.join_date || ''}"></td></tr>
            <tr><td>試用開始</td><td><input id="empProbDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.probation_date || ''}"></td></tr>
            <tr><td>正社員化</td><td><input id="empOfficialDate" placeholder="YYYY-MM-DD" style="width:180px" value="${u.official_date || ''}"></td></tr>
            <tr><td>契約終了</td><td><input id="empContractEnd" placeholder="YYYY-MM-DD" style="width:180px" value="${u.contract_end || ''}"></td></tr>
            <tr><td>基本給</td><td><input id="empBaseSalary" type="number" step="0.01" style="width:180px" value="${u.base_salary ?? ''}" placeholder="円"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">その他</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">生年月日</td><td><input id="empBirth" placeholder="YYYY-MM-DD" style="width:180px" value="${u.birth_date || ''}"></td></tr>
            <tr><td>性別</td><td><select id="empGender" style="width:180px"><option value="">未設定</option><option value="male" ${u.gender==='male'?'selected':''}>男</option><option value="female" ${u.gender==='female'?'selected':''}>女</option><option value="other" ${u.gender==='other'?'selected':''}>その他</option></select></td></tr>
            <tr><td>電話番号</td><td><input id="empPhone" style="width:240px" value="${u.phone || ''}"></td></tr>
            <tr><td>住所</td><td><input id="empAddr" style="width:320px" value="${u.address || ''}"></td></tr>
            <tr><td>プロフィール写真（アップロード）</td><td><input id="empAvatarFile" type="file" accept="image/*"> <button type="button" id="btnAvatarUpload">アップロード</button> <span id="avatarUploadStatus" style="margin-left:8px;color:#334155;"></span></td></tr>
          </tbody>
        </table>
        <div class="form-actions" style="justify-content:flex-end;">
          <button type="submit" class="btn-primary">更新</button>
          <a class="btn" id="btnCancelEdit" href="#list">キャンセル</a>
        </div>
      `;
      try {
        const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        const backHref = `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`;
        const backA = formEdit.querySelector('#editBack');
        const cancelA = formEdit.querySelector('#btnCancelEdit');
        if (backA) backA.setAttribute('href', backHref);
        if (cancelA) cancelA.setAttribute('href', backHref);
      } catch {}
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = {
          username: document.querySelector('#empName').value.trim(),
          email: document.querySelector('#empEmail').value.trim(),
          role: document.querySelector('#empRole').value,
          departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value,10) : null,
          level: (document.querySelector('#empLevel').value || '').trim() || null,
          managerId: document.querySelector('#empManager').value ? parseInt(document.querySelector('#empManager').value,10) : null,
          employmentType: document.querySelector('#empType').value,
          hireDate: document.querySelector('#empHireDate').value.trim() || null,
          probationDate: document.querySelector('#empProbDate').value.trim() || null,
          officialDate: document.querySelector('#empOfficialDate').value.trim() || null,
          contractEnd: document.querySelector('#empContractEnd').value.trim() || null,
          baseSalary: (document.querySelector('#empBaseSalary').value || '').trim() || null,
          birthDate: document.querySelector('#empBirth').value.trim() || null,
          gender: document.querySelector('#empGender').value || null,
          phone: (document.querySelector('#empPhone').value || '').trim() || null,
          employmentStatus: document.querySelector('#empStatus').value,
          address: (document.querySelector('#empAddr').value || '').trim() || null
        };
        await updateEmployee(u.id, b);
        const newPw = document.querySelector('#empPw').value;
        if (newPw && newPw.length >= 6) {
          await fetchJSONAuth(`/api/admin/users/${u.id}/password`, { method: 'PATCH', body: JSON.stringify({ password: newPw }) });
        }
        try {
          const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
          const keep = new URLSearchParams();
          for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
          const qsKeep = keep.toString();
          history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
        } catch {}
        await renderEmployees();
      });
      const btnAvatar = formEdit.querySelector('#btnAvatarUpload');
      if (btnAvatar) {
        btnAvatar.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            const fileEl = formEdit.querySelector('#empAvatarFile');
            const statusEl = formEdit.querySelector('#avatarUploadStatus');
            if (!fileEl || !fileEl.files || !fileEl.files[0]) { if (statusEl) statusEl.textContent = 'ファイル未選択'; return; }
            const fd = new FormData();
            fd.append('file', fileEl.files[0]);
            const tok = sessionStorage.getItem('accessToken') || '';
            const res = await fetch(`/api/admin/employees/${encodeURIComponent(u.id)}/avatar`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok }, body: fd, credentials: 'include' });
            if (!res.ok) {
              let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.message || msg; } catch {}
              if (statusEl) statusEl.textContent = msg;
              return;
            }
            const r = await res.json();
            if (statusEl) statusEl.textContent = 'アップロード完了';
          } catch (err) {}
        });
      }
      formEdit.querySelector('#editBack').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
          const keep = new URLSearchParams();
          for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
          const qsKeep = keep.toString();
          history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
        } catch {}
        await renderEmployees();
      });
      formEdit.querySelector('#btnCancelEdit').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
          const keep = new URLSearchParams();
          for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
          const qsKeep = keep.toString();
          history.replaceState(null, '', `/ui/admin?tab=employees${qsKeep ? '&' + qsKeep : ''}#list`);
        } catch {}
        await renderEmployees();
      });
      content.appendChild(formEdit);
      hideNavSpinner();
      return;
    }
    if (mode === 'edit') {
      content.innerHTML = ``;
      const prompt = document.createElement('form');
      prompt.innerHTML = `
        <div class="form-card form-compact form-sm form-narrow">
          <div class="form-title">【社員編集】</div>
          <div class="form-sep"></div>
          <div class="form-grid">
            <div class="form-label">社員番号</div>
            <div class="form-input">
              <span class="bracket"><input id="editKey" placeholder="EMP001 または ID 数字"></span>
            </div>
          </div>
          <div id="editKeyErr" style="color:#b00020;display:none;margin-top:8px;"></div>
          <div class="form-actions" style="margin-top:8px;">
            <button type="submit">編集へ</button>
          </div>
        </div>
      `;
      prompt.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = prompt.querySelector('#editKeyErr');
        const key = (document.querySelector('#editKey').value || '').trim();
        if (!key) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = '社員番号を入力してください。'; }
          try { document.querySelector('#editKey')?.focus(); } catch {}
          return;
        }
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        let id = null;
        if (/^\d+$/.test(key)) {
          id = parseInt(key, 10);
        } else {
          try {
            showNavSpinner();
            const list = await Promise.race([
              fetchJSONAuth(role2==='manager' ? '/api/manager/users' : '/api/admin/employees'),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
            ]);
            const f = list.find(u => {
              const code = String(u.employee_code||'').toUpperCase();
              const gen = ('EMP' + String(u.id).padStart(3,'0')).toUpperCase();
              return code === key.toUpperCase() || gen === key.toUpperCase();
            });
            if (f) id = f.id;
          } catch (err) {
            alert(String(err?.message || '読み込みエラー'));
          } finally {
            hideNavSpinner();
          }
        }
        if (!id) return alert('対象が見つかりません');
        window.location.href = `/ui/admin?tab=employees&edit=${id}`;
      });
      content.appendChild(prompt);
      try { document.querySelector('#editKey')?.focus(); } catch {}
      const tabsEl2 = content.querySelector('.tabs');
      if (tabsEl2) {
        tabsEl2.addEventListener('click', async (e) => {
          const a = e.target.closest('.btn');
          if (!a) return;
          const target = a.getAttribute('href') || '#list';
          if (a.id === 'btnGoHome') {
            e.preventDefault();
            try { sessionStorage.setItem('navSpinner', '1'); } catch {}
            showNavSpinner();
            setTimeout(() => { window.location.href = '/ui/portal'; }, 300);
            return;
          }
          if (target.startsWith('#')) {
            e.preventDefault();
            try { history.pushState(null, '', `/ui/admin?tab=employees${target}`); } catch { window.location.href = `/ui/admin?tab=employees${target}`; return; }
            await renderEmployees();
          }
        });
      }
      hideNavSpinner();
      return;
    }
    if (mode === 'add') {
      const form = document.createElement('form');
      form.id = 'add';
      let managers = [];
      try { managers = await listUsers(); } catch { managers = []; }
      if (seq !== employeesRenderSeq) return;
      const managerOptions = managers.filter(m => String(m.role) === 'manager').map(m => `<option value="${m.id}">${m.username || m.email}</option>`).join('');
      form.innerHTML = `
        <div class="form-title">【新規社員】</div>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">基本情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">社員番号</td><td><input id="empCode" style="width:240px"></td></tr>
            <tr><td>氏名</td><td><input id="empName" style="width:240px"></td></tr>
            <tr><td>メール</td><td><input id="empEmail" style="width:240px"></td></tr>
            <tr><td>パスワード</td><td><input id="empPass" type="password" style="width:240px"></td></tr>
            <tr><td>生年月日</td><td><input id="empBirth" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>性別</td><td>
              <select id="empGender" style="width:180px">
                <option value="">未選択</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
              </select>
            </td></tr>
            <tr><td>電話番号</td><td><input id="empPhone" style="width:240px"></td></tr>
            <tr><td>住所</td><td><input id="empAddr" style="width:320px"></td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">職務情報</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">部署</td><td><select id="empDept" style="width:240px"><option value="">部署</option>${depts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}</select></td></tr>
            <tr><td>役割</td><td>
              <select id="empRole" style="width:240px">
                <option value="employee">従業員</option>
                <option value="manager">マネージャー</option>
                <option value="admin">管理者</option>
              </select>
            </td></tr>
            <tr><td>直属マネージャー</td><td><select id="empManager" style="width:240px"><option value="">未設定</option>${managerOptions}</select></td></tr>
            <tr><td>レベル</td><td><input id="empLevel" style="width:180px" placeholder="例: L1/L2/Senior"></td></tr>
            <tr><td>雇用形態</td><td>
              <select id="empType" style="width:240px">
                <option value="full_time">正社員</option>
                <option value="part_time">パート・アルバイト</option>
                <option value="contract">契約社員</option>
              </select>
            </td></tr>
            <tr><td>入社日</td><td><input id="empJoinDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>試用開始</td><td><input id="empProbDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>正社員化</td><td><input id="empOfficialDate" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>契約終了日（任意）</td><td><input id="empContractEnd" placeholder="YYYY-MM-DD" style="width:180px"></td></tr>
            <tr><td>基本給</td><td><input id="empBaseSalary" type="number" step="0.01" style="width:180px" placeholder="円"></td></tr>
            <tr><td>状態</td><td>
              <select id="empStatus" style="width:240px">
                <option value="active">在職</option>
                <option value="inactive">休職/無効</option>
                <option value="retired">退職</option>
              </select>
            </td></tr>
          </tbody>
        </table>
        <table class="excel-table" style="margin-bottom:12px;">
          <thead><tr><th colspan="2">その他</th></tr></thead>
          <tbody>
            <tr><td style="width:180px;">プロフィール写真URL（任意）</td><td><input id="empAvatarUrl" style="width:320px" placeholder="https://..."></td></tr>
            <tr><td>プロフィール写真（アップロード）</td><td><input id="empAvatarFile" type="file" accept="image/*"></td></tr>
          </tbody>
        </table>
        <div class="form-actions" style="justify-content:flex-end;">
          <button type="submit" class="btn-primary">作成</button>
        </div>
        <div id="empCreateMsg" style="margin-top:10px;color:#0f172a;font-weight:600;"></div>
      `;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = form.querySelector('#empCreateMsg');
        const btn = form.querySelector('button[type="submit"]');
        const b = {
          employeeCode: document.querySelector('#empCode').value.trim(),
          username: document.querySelector('#empName').value.trim(),
          email: document.querySelector('#empEmail').value.trim(),
          password: document.querySelector('#empPass').value,
          role: document.querySelector('#empRole').value,
          departmentId: document.querySelector('#empDept').value ? parseInt(document.querySelector('#empDept').value,10) : null,
          level: (document.querySelector('#empLevel').value || '').trim() || null,
          managerId: document.querySelector('#empManager').value ? parseInt(document.querySelector('#empManager').value,10) : null,
          employmentType: document.querySelector('#empType').value,
          hireDate: document.querySelector('#empJoinDate').value.trim() || null,
          probationDate: document.querySelector('#empProbDate').value.trim() || null,
          officialDate: document.querySelector('#empOfficialDate').value.trim() || null,
          contractEnd: document.querySelector('#empContractEnd').value.trim() || null,
          baseSalary: (document.querySelector('#empBaseSalary').value || '').trim() || null,
          birthDate: document.querySelector('#empBirth').value.trim() || null,
          gender: document.querySelector('#empGender').value || null,
          phone: (document.querySelector('#empPhone').value || '').trim() || null,
          address: (document.querySelector('#empAddr').value || '').trim() || null,
          employmentStatus: document.querySelector('#empStatus').value,
          avatarUrl: (document.querySelector('#empAvatarUrl').value || '').trim() || null
        };
        if (!b.username || !b.email || !b.password) {
          if (msgEl) { msgEl.style.color = '#b00020'; msgEl.textContent = '氏名・メール・パスワードは必須です。'; }
          return;
        }
        const ok = window.confirm('保存しますか？');
        if (!ok) return;
        if (msgEl) { msgEl.style.color = '#0f172a'; msgEl.textContent = '保存中…'; }
        if (btn) btn.disabled = true;
        try {
          const r = await createEmployee(b);
          try {
            const fileEl = document.querySelector('#empAvatarFile');
            if (fileEl && fileEl.files && fileEl.files[0] && r && r.id) {
              const fd = new FormData();
              fd.append('file', fileEl.files[0]);
              const tok = sessionStorage.getItem('accessToken') || '';
              await fetch(`/api/admin/employees/${encodeURIComponent(r.id)}/avatar`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok }, body: fd, credentials: 'include' });
            }
          } catch {}
          if (msgEl) { msgEl.style.color = '#0f172a'; msgEl.textContent = '保存しました（1名追加）'; }
          try { sessionStorage.setItem('navSpinner', '1'); } catch {}
          setTimeout(() => { window.location.href = '/ui/admin?tab=employees#list'; }, 350);
        } catch (err) {
          const m = String(err?.message || '');
          const low = m.toLowerCase();
          if (msgEl) {
            msgEl.style.color = '#b00020';
            if (m.includes('社員番号') || low.includes('uniq_employee_code') || low.includes('duplicate entry')) {
              msgEl.textContent = '社員番号が既に存在します。別の番号を入力してください。';
              try { document.querySelector('#empCode')?.focus(); } catch {}
            } else if (m.includes('Email') || low.includes('email')) {
              msgEl.textContent = m;
              try { document.querySelector('#empEmail')?.focus(); } catch {}
            } else {
              msgEl.textContent = '保存失敗: ' + (m || 'error');
            }
          }
        } finally {
          if (btn) btn.disabled = false;
        }
      });
      if (seq !== employeesRenderSeq) return;
      content.appendChild(form);
      hideNavSpinner();
      return;
    }
    const filterWrap = document.createElement('div');
    filterWrap.style.margin = mode === 'delete' ? '0 0 8px' : '12px 0';
    filterWrap.className = mode === 'delete' ? 'emp-filters emp-del-wrap' : 'emp-filters filter-bar';
    const deptOptions = `<option value="">全て</option>${depts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('')}`;
    if (mode === 'delete') {
      filterWrap.innerHTML = `
        <table class="excel-table emp-del-filter" style="margin:0 0 10px; width:720px; min-width:680px;">
          <thead>
            <tr>
              <th colspan="2">
                <div class="del-head"><div class="form-title">【社員削除】</div></div>
              </th>
            </tr>
            <tr>
              <th colspan="2">
                <div class="del-tabs">
                  <button type="button" id="tabSearch" class="tab active">社員検索</button>
                  <button type="button" id="tabShowAll" class="tab">全員表示</button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="width:120px;">社員番号</td>
              <td><input id="empSearchCode" placeholder="EMP番号/コード"></td>
            </tr>
            <tr>
              <td style="width:120px;">名前</td>
              <td><input id="empSearchName" placeholder="名前"></td>
            </tr>
            <tr>
              <td>部署</td>
              <td><select id="empDeptFilter">${deptOptions}</select></td>
            </tr>
            <tr>
              <td>役割</td>
              <td><select id="empRoleFilter"><option value="">全て</option><option value="employee">従業員</option><option value="manager">マネージャー</option><option value="admin">管理者</option></select></td>
            </tr>
            <tr style="display:none;">
              <td>状態</td>
              <td><select id="empStatusFilter"><option value="">全て</option><option value="active">在職</option><option value="inactive">無効</option><option value="retired">退職</option></select></td>
            </tr>
            <tr>
              <td>入社日</td>
              <td>
                <div class="date-range">
                  <input id="empHireFrom" placeholder="YYYY-MM-DD">
                  <span class="tilde">〜</span>
                  <input id="empHireTo" placeholder="YYYY-MM-DD">
                </div>
              </td>
            </tr>
            <tr>
              <td></td>
              <td class="actions"><button type="button" id="btnEmpSearch" class="btn btn-search">検索</button></td>
            </tr>
          </tbody>
        </table>
        <div id="empListBox" style="display:none"></div>
      `;
    } else {
      filterWrap.innerHTML = `
        <div class="fi">
          <div class="fi-label">検索</div>
          <input id="empSearchName" class="fi-name" placeholder="名前">
        </div>
        <div class="fi">
          <div class="fi-label">部署</div>
          <select id="empDeptFilter" class="fi-dept">${deptOptions}</select>
        </div>
        <div class="fi">
          <button id="toggleAdv" class="toggle-adv" type="button">詳細フィルター</button>
        </div>
        <div class="adv" hidden>
          <div class="fi">
            <div class="fi-label">役割</div>
            <select id="empRoleFilter" class="fi-role"><option value="">全て</option><option value="employee">従業員</option><option value="manager">マネージャー</option><option value="admin">管理者</option></select>
          </div>
          <div class="fi">
            <div class="fi-label">状態</div>
            <select id="empStatusFilter" class="fi-status"><option value="">全て</option><option value="active">在職</option><option value="inactive">無効</option><option value="retired">退職</option></select>
          </div>
          <div class="fi fi-range">
            <div class="fi-label">入社日</div>
            <input id="empHireFrom" class="fi-date" placeholder="YYYY-MM-DD">
            <span class="fi-sep">〜</span>
            <input id="empHireTo" class="fi-date" placeholder="YYYY-MM-DD">
          </div>
        </div>
        <div class="fi fi-action">
          <button type="button" id="btnEmpSearch" class="btn">検索</button>
        </div>
      `;
    }
    try {
      const subnav = document.querySelector('.subbar .subnav');
      if (subnav) {
        if (mode === 'delete') {
          subnav.innerHTML = '';
          subnav.style.display = 'none';
          filterWrap.style.position = 'static';
          filterWrap.style.zIndex = 'auto';
          content.appendChild(filterWrap);
          try {
            let style = document.querySelector('#empDelFilterStyle');
            if (!style) {
              style = document.createElement('style');
              style.id = 'empDelFilterStyle';
              style.textContent = `
                html.emp-delete-mode, body.emp-delete-mode { height: 100%; overflow: hidden; }
                .admin.emp-delete-mode .content { height: 100vh; overflow: hidden; box-sizing: border-box; }
                .admin.emp-delete-mode #adminContent { height: calc(100vh - var(--topbar-height) - 24px); overflow: hidden; }
                .emp-del-wrap { display: flex; flex-direction: column; max-width: 1300px; width: 100%; margin: 0 auto; padding: 8px 12px; height: 100%; box-sizing: border-box; }
                .del-head { display: inline-flex; margin-bottom: 0; }
                .del-tabs { display: inline-flex; gap: 8px; margin-bottom: 0; }
                .del-tabs .tab { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid #d0d8e4; background: #f3f6fb; color: #1f3b63; }
                .del-tabs .tab.active { background: #2b6cb0; color: #fff; border-color: #1e4e8c; }

                .emp-del-filter { table-layout: fixed; border-collapse: separate; border-spacing: 0; background: #fff; border: 1px solid #e5eaf0; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
                .emp-del-filter thead th { background: #eaf2ff; color:#0d2c5b; font-weight:600; border-bottom:1px solid #e1e8f5; }
                .emp-del-filter tbody tr { height: 42px; }
                .emp-del-filter tbody tr td:first-child { width: 140px; white-space: nowrap; color: #0d2c5b; background:#f8fbff; border-right:1px solid #e3edf8; }
                .emp-del-filter tbody tr td:not(.actions) > * { width: 100%; }
                .emp-del-filter tbody td { padding: 10px 12px; vertical-align: middle; border-top: 1px solid #eef2f7; }
                .emp-del-filter input,
                .emp-del-filter select {
                  height: 36px;
                  border-radius: 10px;
                  background: #fcfdff;
                  border: 1.5px solid #bcd0e6;
                  padding: 6px 12px;
                  box-sizing: border-box;
                  display: block;
                }
                .emp-del-filter input::placeholder { color: #94a3b8; }
                .emp-del-filter input:focus,
                .emp-del-filter select:focus {
                  border-color: #2b67b3;
                  box-shadow: 0 0 0 3px rgba(43,103,179,.12);
                  outline: none;
                }
                .emp-del-filter td.actions { text-align: center; }
                .emp-del-filter .date-range { display: flex; align-items: center; gap: 6px; }
                .emp-del-filter .date-range input { flex: 1 1 0; display: inline-block; min-width: 160px; }
                .emp-del-filter .date-range .tilde { width: 12px; text-align: center; color: #64748b; }
                .emp-del-filter .btn-search {
                  height: 36px;
                  border-radius: 10px;
                  padding: 0 16px;
                  background: #2b6cb0;
                  border: 1px solid #1e4e8c;
                  color: #fff;
                  transition: background-color .15s ease, border-color .15s ease;
                }
                .emp-del-filter .btn-search:hover { background: #255ea7; border-color: #1e4e8c; }
                .emp-del-filter .btn-search:active { background: #1f4e8a; border-color: #163b6e; }
                .emp-del-filter .btn.full { width: 100%; }

                #empListBox { display:block; width:100%; margin-top:0; overflow: auto; flex: 1 1 auto; min-height: 0; }

                .emp-del-list {
                  width: 100%;
                  table-layout: fixed;
                  border-collapse: separate;
                  border-spacing: 0;
                  background: #f5f5f5;
                  border: 1px solid #9ca3af;
                  border-radius: 10px;
                  overflow: hidden;
                  box-shadow: 0 1px 2px rgba(16,24,40,.06);
                }
                .emp-del-list thead { position: sticky; top: 0; z-index: 199; }
                .emp-del-list thead th {
                  background: #f3f4f6;
                  text-align: center !important;
                  vertical-align: middle;
                  color: #111827;
                  font-weight: 600;
                  border-bottom: 2px solid #9ca3af;
                  position: sticky;
                  top: 0;
                  z-index: 200;
                  box-shadow: 0 1px 0 rgba(16,24,40,.06);
                }
                .emp-del-list thead th > * { margin-left: auto; margin-right: auto; }
                .emp-del-list tbody td {
                  padding: 4px 8px;
                  text-align: left;
                  vertical-align: middle;
                  background: #fff;
                  border-bottom: 1px solid #9ca3af;
                  border-right: 1px solid #d1d5db;
                  color: #0f172a;
                  font-size: 12px;
                }
                .emp-del-list tbody tr:hover td { background: #fff; }
                .emp-del-list tbody tr:last-child td { border-bottom: 0; }
                .emp-del-list tbody tr td:first-child { border-left: 2px solid #9ca3af; }
                .emp-del-list tbody tr td:last-child { border-right: 0; }
                .emp-del-list th, .emp-del-list td { white-space: nowrap; overflow: visible; text-overflow: clip; }
                .emp-del-list td:last-child > div { justify-content: flex-start; }

                .emp-del-list thead th:nth-child(1), .emp-del-list tbody td:nth-child(1) { width: 32px; text-align: center; }
                .emp-del-list thead th:nth-child(2), .emp-del-list tbody td:nth-child(2) { width: 92px; }
                .emp-del-list thead th:nth-child(3), .emp-del-list tbody td:nth-child(3) { width: 140px; }
                .emp-del-list thead th:nth-child(4), .emp-del-list tbody td:nth-child(4) { width: 240px; }
                .emp-del-list thead th:nth-child(5), .emp-del-list tbody td:nth-child(5) { width: 180px; }
                .emp-del-list thead th:nth-child(1), .emp-del-list tbody td:nth-child(1) { width: 40px; text-align: center; }
                .emp-del-list thead th:nth-child(6), .emp-del-list tbody td:nth-child(6) { width: 96px; text-align: center; }
                .emp-del-list thead th:nth-child(7), .emp-del-list tbody td:nth-child(7) { width: 110px; text-align: center; }
                .emp-del-list thead th:nth-child(8), .emp-del-list tbody td:nth-child(8) { width: 90px; text-align: center; }
                .emp-del-list thead th:nth-child(9), .emp-del-list tbody td:nth-child(9) { width: 110px; text-align: center; }
                .emp-del-list thead th:nth-child(10), .emp-del-list tbody td:nth-child(10) { width: 190px; }

                .emp-del-list tbody td:nth-child(1) { padding: 2px 4px; line-height: 1; }
                .emp-del-list td:nth-child(1) input[type="checkbox"] { display:block; margin:0 auto; width:16px; height:16px; appearance:auto; }
                .status-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 32px; padding: 4px 14px; border-radius: 999px; border: 1px solid transparent; font-weight: 600; font-size: 16px !important; line-height: 1.2; box-sizing: border-box; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                .status-pill.active { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
                .status-pill.inactive { background: #eef2ff; color: #1e40af; border-color: #c7d2fe; }
                .status-pill.retired { background: #f1f5f9; color: #334155; border-color: #e2e8f0; }

                .emp-action-group { display:flex; gap:8px; align-items:center; flex-wrap:nowrap; }
                .emp-action {
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  height: 34px;
                  padding: 0 16px;
                  border-radius: 8px;
                  border: 1px solid #d0d8e4;
                  background: #fff;
                  color: #1f3b63;
                  text-decoration: none;
                  font-size: 16px;
                  cursor: pointer;
                }
                .emp-action:hover { background: #f3f7ff; border-color: #c3d2ea; }
                .emp-action:active { background: #eaf2ff; border-color: #b6c8e5; }
                .emp-action.danger { background: #eef2ff; border-color: #c7d2fe; color: #1e40af; }
                .emp-action.danger:hover { background: #e0e7ff; border-color: #a5b4fc; }
                .admin .card .excel-table .emp-action-group .emp-action { font-size: 16px !important; height: 34px !important; padding: 0 16px !important; gap: 8px !important; }
                .admin .card .excel-table .emp-action-group .emp-action.danger { font-size: 16px !important; }
                .pager-right { margin-left: auto; display: inline-flex; align-items: center; }
                .emp-del-toolbar { display: flex; justify-content: flex-end; margin: 8px 0 0; position: static; top: auto; z-index: auto; background: transparent; }
                .emp-bulk-disable {
                  height: 36px;
                  border-radius: 10px;
                  padding: 0 16px;
                  background: linear-gradient(180deg, #2b6cb0 0%, #255ea7 100%);
                  border: 1px solid #1e4e8c;
                  color: #fff;
                  font-weight: 600;
                  letter-spacing: .03em;
                  box-shadow: 0 1px 2px rgba(16,24,40,.06);
                  transition: background-color .15s ease, border-color .15s ease, transform .02s ease;
                }
                .emp-bulk-disable:hover { background: linear-gradient(180deg, #336fb3 0%, #2b62a9 100%); border-color: #1e4e8c; }
                .emp-bulk-disable:active { transform: translateY(1px); }
                .emp-bulk-disable:focus { outline: 3px solid rgba(43,103,179,.20); outline-offset: 2px; }
                .admin .card { --emp-pill-width: 260px; }
                .admin .card table#list { width: 100%; }

                .text-pill { display:inline-flex; align-items:center; min-height:32px; padding:4px 14px; border-radius:999px; border:1px solid #d1d5db; background:#fff; color:#1f2937; font-size:16px !important; line-height:1.2; box-sizing:border-box; justify-content:flex-start; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
                .text-pill.neutral { background:#fff; border-color:#d1d5db; color:#1f2937; }
                .text-pill a { color: inherit; text-decoration: none; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; display:block; width:100%; line-height:inherit; }
                .admin .card table#list tbody td .text-pill,
                .admin .card table#list tbody td .status-pill,
                .admin .card table#list tbody td .role-pill,
                .admin .card table#list tbody td .type-pill { width: var(--emp-pill-width); }
                .admin .card .excel-table th[data-sort="username"],
                .admin .card .excel-table td.col-name { min-width: 280px; }
                .admin .card .excel-table th[data-sort="email"],
                .admin .card .excel-table td.col-email { min-width: 300px; }
                .admin .card .excel-table th[data-sort="department"],
                .admin .card .excel-table td.col-dept { min-width: 300px; }
                .admin .card .excel-table th[data-sort="id"],
                .admin .card .excel-table td.col-code { min-width: 280px; }
                .admin .card .excel-table tbody td.col-name a { font-size: 16px !important; font-weight: 600 !important; }
                .admin .card .excel-table th.sel-col,
                .admin .card .excel-table td.sel-col { width: 56px; min-width: 56px; text-align: center; }
                .admin .card .excel-table input.empSel { width: 18px !important; height: 18px !important; padding: 0 !important; margin: 0 !important; }

                .role-pill { display:inline-flex; align-items:center; justify-content:center; min-height:32px; padding:4px 14px; border-radius:999px; border:1px solid #e2e8f0; font-size:16px !important; font-weight:600; line-height:1.2; box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
                .role-pill.admin { background:#eaf2ff; color:#0d2c5b; border-color:#c7d2fe; }
                .role-pill.manager { background:#fff7ed; color:#9a3412; border-color:#fed7aa; }
                .role-pill.employee { background:#f1f5f9; color:#334155; border-color:#e2e8f0; }

                .type-pill { display:inline-flex; align-items:center; justify-content:center; min-height:32px; padding:4px 14px; border-radius:999px; border:1px solid #e2e8f0; font-size:16px !important; font-weight:600; line-height:1.2; box-sizing:border-box; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
                .type-pill.full { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; }
                .type-pill.part { background:#f1f5f9; color:#334155; border-color:#e2e8f0; }
                .type-pill.contract { background:#eef2ff; color:#1e40af; border-color:#c7d2fe; }
              `;
              document.head.appendChild(style);
            }
          } catch {}
        } else {
          subnav.style.display = '';
          subnav.innerHTML = '';
          subnav.appendChild(filterWrap);
        }
      } else {
        filterWrap.style.position = 'static';
        filterWrap.style.zIndex = 'auto';
        content.appendChild(filterWrap);
      }
    } catch {
      filterWrap.style.position = 'static';
      filterWrap.style.zIndex = 'auto';
      content.appendChild(filterWrap);
    }
    const toggleBtn = filterWrap.querySelector('#toggleAdv');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const adv = filterWrap.querySelector('.adv');
        if (!adv) return;
        const hidden = adv.hasAttribute('hidden');
        if (hidden) {
          adv.removeAttribute('hidden');
          filterWrap.classList.add('open');
          toggleBtn.textContent = '簡易表示';
        } else {
          adv.setAttribute('hidden', '');
          filterWrap.classList.remove('open');
          toggleBtn.textContent = '詳細フィルター';
        }
      });
    }
    const state = { showAll: false, searchVisible: false, code: '', q: '', dept: '', role: '', status: '', hireFrom: '', hireTo: '', sortKey: 'id', sortDir: 'desc', page: 1, pageSize: 10 };
    try {
      state.showAll = ((params.get('showAll') || '') === '1' || (params.get('showAll') || '').toLowerCase() === 'true');
      state.searchVisible = ((params.get('search') || '') === '1' || (params.get('search') || '').toLowerCase() === 'true');
      state.code = (params.get('code') || '').trim().toLowerCase();
      state.q = (params.get('q') || '').trim().toLowerCase();
      state.dept = params.get('dept') || '';
      state.role = params.get('role') || '';
      state.status = params.get('status') || '';
      state.hireFrom = params.get('hireFrom') || '';
      state.hireTo = params.get('hireTo') || '';
      state.sortKey = params.get('sortKey') || state.sortKey;
      state.sortDir = params.get('sortDir') || state.sortDir;
      state.page = parseInt(params.get('page') || String(state.page), 10) || state.page;
    } catch {}
    const table = document.createElement('table');
    table.id = 'list';
    table.className = 'excel-table' + (mode === 'delete' ? ' emp-del-list' : '');
    table.style.tableLayout = 'auto';
    if (mode === 'delete') {
      table.style.width = '100%';
      table.style.minWidth = '1320px';
    } else {
      table.style.width = '100%';
      table.style.minWidth = '880px';
    }
    table.innerHTML = `
      <thead>
        <tr>
          ${mode==='delete' ? '<th class="sel-col">選択</th>' : ''}
          <th data-sort="id">社員番号</th>
          <th data-sort="username">氏名</th>
          <th data-sort="email">メール</th>
          <th data-sort="department">部署</th>
          <th data-sort="role">役割</th>
          <th data-sort="employment_type">雇用形態</th>
          <th data-sort="employment_status">状態</th>
          <th data-sort="hire_date">入社日</th>
          <th>操作</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    const pager = document.createElement('div');
    pager.style.margin = '8px 0';
    pager.style.display = 'flex';
    pager.style.alignItems = 'center';
    pager.style.justifyContent = 'space-between';
    pager.innerHTML = `
      <div class="pager-left">
        <button type="button" id="empPrev">前へ</button>
        <span id="empPageInfo" style="margin:0 8px;"></span>
        <button type="button" id="empNext">次へ</button>
      </div>
      ${mode==='delete' ? '' : ''}
    `;
    if (mode === 'delete') {
      if (seq !== employeesRenderSeq) return;
      const toolbar = document.createElement('div');
      toolbar.className = 'emp-del-toolbar';
      toolbar.innerHTML = '<div class="pager-right" id="empBulkBox"><button type="button" id="empBulkDisable" class="emp-bulk-disable" aria-label="選択を無効化">選択を無効化</button></div>';
      toolbar.style.display = '';
      const listBox = filterWrap.querySelector('#empListBox');
      if (listBox) {
        listBox.appendChild(table);
        listBox.appendChild(pager);
        filterWrap.appendChild(toolbar);
      } else {
        filterWrap.appendChild(table);
        filterWrap.appendChild(pager);
        filterWrap.appendChild(toolbar);
      }
    } else {
      if (seq !== employeesRenderSeq) return;
      const hdr = document.createElement('div');
      hdr.className = 'form-title';
      hdr.textContent = '【社員一覧】';
      content.appendChild(hdr);
      content.appendChild(table);
      content.appendChild(pager);
    }
    if (mode === 'delete') {
      // bảng danh sách chỉ hiển thị theo chế độ; bảng tìm kiếm luôn hiện phần header
      table.style.display = '';
      if (!state.showAll && !state.searchVisible) { pager.style.display = 'none'; }
      const alignBulk = () => {
        try {
          if (table.style.display === 'none') return;
          const th = table.querySelector('thead th:last-child');
          const box = filterWrap.querySelector('#empBulkBox');
          if (!th || !box) return;
          const tb = table.getBoundingClientRect();
          const thb = th.getBoundingClientRect();
          const left = Math.max(0, Math.round(thb.left - tb.left));
          box.style.marginLeft = `${left}px`;
        } catch {}
      };
      if (state.showAll || state.searchVisible) {
        alignBulk();
        try { window.addEventListener('resize', alignBulk, { once: true }); } catch {}
      }
    }
    const fmtEmpNo = (id) => 'EMP' + String(id).padStart(3, '0');
    const deptName = (id) => {
      const d = depts.find(x => String(x.id) === String(id));
      return d ? d.name : '';
    };
    const statusJa = (s) => {
      const v = String(s || '').toLowerCase();
      if (v === 'inactive') return '無効';
      if (v === 'retired') return '退職';
      return '在職';
    };
    const statusPill = (s) => {
      const v = String(s || '').toLowerCase();
      const cls = v === 'inactive' ? 'inactive' : (v === 'retired' ? 'retired' : 'active');
      return `<span class="status-pill ${cls}">${statusJa(v)}</span>`;
    };
    const roleJa = (r) => {
      const v = String(r || '').toLowerCase();
      if (v === 'admin') return '管理者';
      if (v === 'manager') return 'マネージャー';
      if (v === 'employee') return '従業員';
      return r || '';
    };
    const empTypeJa = (t) => {
      const v = String(t || '').toLowerCase();
      if (v === 'full_time') return '正社員';
      if (v === 'part_time') return 'パート・アルバイト';
      if (v === 'contract') return '契約社員';
      return t || '';
    };
    const rolePill = (r) => {
      const v = String(r || '').toLowerCase();
      const cls = v === 'admin' ? 'admin' : (v === 'manager' ? 'manager' : 'employee');
      return `<span class="role-pill ${cls}">${roleJa(v)}</span>`;
    };
    const typePill = (t) => {
      const v = String(t || '').toLowerCase();
      const cls = v === 'full_time' ? 'full' : (v === 'part_time' ? 'part' : (v === 'contract' ? 'contract' : 'other'));
      return `<span class="type-pill ${cls}">${empTypeJa(v)}</span>`;
    };
    const normText = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v).trim();
      return (s && s !== '-') ? s : '';
    };
    const dispOrUnreg = (v) => {
      const s = normText(v);
      return s ? s : `<span class="unreg" title="未登録">—</span>`;
    };
    const escAttr = (v) => String(v)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const fmtDate = (d) => {
      if (!d || String(d) === '-' || String(d) === '0000-00-00') return `<span class="unreg" title="未登録">—</span>`;
      const raw = String(d);
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${m[1]}/${m[2]}/${m[3]}`;
      try {
        const x = new Date(raw);
        if (!isNaN(x.getTime())) return `${x.getFullYear()}/${String(x.getMonth()+1).padStart(2,'0')}/${String(x.getDate()).padStart(2,'0')}`;
      } catch {}
      return raw;
    };
    const applyFilterSort = () => {
      let arr = users.slice();
      if (state.code) {
        arr = arr.filter(u => {
          const raw = String(u.employee_code || '').toLowerCase();
          const gen = ('emp' + String(u.id).padStart(3,'0')).toLowerCase();
          return raw.includes(state.code) || gen.includes(state.code);
        });
      }
      if (state.q) arr = arr.filter(u => String(u.username||'').toLowerCase().includes(state.q));
      if (state.dept) arr = arr.filter(u => String(u.departmentId||'') === String(state.dept));
      if (state.role) arr = arr.filter(u => String(u.role||'') === String(state.role));
      if (state.status) arr = arr.filter(u => String(u.employment_status||'') === String(state.status));
      if (state.hireFrom) {
        arr = arr.filter(u => {
          const d = u.hire_date;
          return d && String(d) >= state.hireFrom;
        });
      }
      if (state.hireTo) {
        arr = arr.filter(u => {
          const d = u.hire_date;
          return d && String(d) <= state.hireTo;
        });
      }
      const key = state.sortKey;
      const dir = state.sortDir === 'asc' ? 1 : -1;
      arr.sort((a,b) => {
        const va = key==='department' ? deptName(a.departmentId) : (key==='hire_date' ? (a.hire_date||'') : (a[key]||''));
        const vb = key==='department' ? deptName(b.departmentId) : (key==='hire_date' ? (b.hire_date||'') : (b[key]||''));
        return (String(va).localeCompare(String(vb))) * dir;
      });
      return arr;
    };
    const renderRows = () => {
      const all = applyFilterSort();
      const total = all.length;
      const start = (state.page - 1) * state.pageSize;
      const pageItems = all.slice(start, start + state.pageSize);
      tbody.innerHTML = '';
      for (const u of pageItems) {
        const tr = document.createElement('tr');
        const rowStatus = String(u.employment_status || '').toLowerCase();
        tr.className = `emp-row ${rowStatus || 'active'}`;
        const emailVal = normText(u.email);
        const deptVal = normText(deptName(u.departmentId));
        const detailBtn = `<a class="emp-action" href="/ui/admin?tab=employees&detail=${u.id}">👁 詳細</a>`;
        const editBtn = `<a class="emp-action" href="/ui/admin?tab=employees&edit=${u.id}">✏️ 編集</a>`;
        const disableBtn = role2==='admin' ? `<button type="button" class="emp-action danger" data-delete="${u.id}">🚫 無効化</button>` : ``;
        const ops = mode==='delete' ? `${detailBtn}${disableBtn}` : `${detailBtn}${editBtn}${disableBtn}`;
        tr.innerHTML = `
          ${mode==='delete' ? `<td class="sel-col"><input type="checkbox" class="empSel" value="${u.id}"></td>` : ''}
          <td class="col-code"><span class="text-pill neutral">${u.employee_code || fmtEmpNo(u.id)}</span></td>
          <td class="col-name"><span class="text-pill"><a href="/ui/admin?tab=employees&detail=${u.id}">${u.username||''}</a></span></td>
          <td class="col-email"${emailVal ? ` title="${escAttr(emailVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(emailVal)}</span></td>
          <td class="col-dept"${deptVal ? ` title="${escAttr(deptVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(deptVal)}</span></td>
          <td>${rolePill(u.role)}</td>
          <td>${typePill(u.employment_type)}</td>
          <td>${statusPill(u.employment_status)}</td>
          <td>${fmtDate(u.hire_date)}</td>
          <td>
            <div class="emp-action-group">
              ${ops}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      }
      const from = Math.min(total, start + 1);
      const to = Math.min(total, start + pageItems.length);
      const pageInfo = content.querySelector('#empPageInfo');
      if (pageInfo) {
        const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
        pageInfo.textContent = `${from}-${to} / ${total}`;
        if (maxPage <= 1) {
          pageInfo.style.display = 'none';
          const prevEl = content.querySelector('#empPrev');
          const nextEl = content.querySelector('#empNext');
          if (prevEl) prevEl.style.display = 'none';
          if (nextEl) nextEl.style.display = 'none';
        } else {
          pageInfo.style.display = '';
          const prevEl = content.querySelector('#empPrev');
          const nextEl = content.querySelector('#empNext');
          if (prevEl) prevEl.style.display = '';
          if (nextEl) nextEl.style.display = '';
        }
      }
    };
    renderRows();
    const updateBrandActions = () => {
      try {
        const dd = document.querySelector('.topbar .brand #brandDropdown');
        if (!dd) return;
        const sel = Array.from(content.querySelectorAll('.empSel:checked'));
        const editBtn = document.querySelector('.topbar .brand #brandEdit');
        if (editBtn) {
          const ok = sel.length === 1;
          editBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
        }
      } catch {}
    };
    content.addEventListener('change', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('empSel')) {
        updateBrandActions();
      }
    });
    content.addEventListener('click', (e) => {
      const td = e.target?.closest?.('td');
      if (!td) return;
      const t = td.closest('table');
      if (t !== table) return;
      if (e.target.closest('.emp-action-group')) return;
      if (e.target.closest('a')) return;
      if (e.target.matches('input, button, select, label')) return;
      const tr = td.closest('tr');
      const cb = tr ? tr.querySelector('.empSel') : null;
      if (cb) {
        cb.checked = !cb.checked;
        updateBrandActions();
      }
    });
    updateBrandActions();
    const sortingEnabled = false;
    if (sortingEnabled) table.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (!th) return;
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      renderRows();
      try {
        const p = new URLSearchParams();
        if (state.showAll) p.set('showAll', '1');
        if (state.code) p.set('code', state.code);
        if (state.q) p.set('q', state.q);
        if (state.dept) p.set('dept', state.dept);
        if (state.role) p.set('role', state.role);
        if (state.status) p.set('status', state.status);
        if (state.hireFrom) p.set('hireFrom', state.hireFrom);
        if (state.hireTo) p.set('hireTo', state.hireTo);
        if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
        if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
        if (state.page && state.page > 1) p.set('page', String(state.page));
        const s = p.toString();
        history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
      } catch {}
    });
    try {
      const tabSearch = filterWrap.querySelector('#tabSearch');
      const tabShowAll = filterWrap.querySelector('#tabShowAll');
      if (tabSearch && tabShowAll) {
        const setActive = () => {
          const listBox = filterWrap.querySelector('#empListBox');
          const formBody = filterWrap.querySelector('.emp-del-filter tbody');
          const tb = filterWrap.querySelector('.emp-del-toolbar');
          if (state.showAll) {
            tabSearch.classList.remove('active');
            tabShowAll.classList.add('active');
            table.style.display = '';
            pager.style.display = '';
            if (formBody) formBody.style.display = 'none';
            if (listBox) listBox.style.display = '';
            if (tb) tb.style.display = '';
          } else {
            tabSearch.classList.add('active');
            tabShowAll.classList.remove('active');
            const showSearchList = !!state.searchVisible;
            table.style.display = showSearchList ? '' : 'none';
            pager.style.display = showSearchList ? '' : 'none';
            if (formBody) formBody.style.display = '';
            if (listBox) listBox.style.display = showSearchList ? '' : 'none';
            if (tb) tb.style.display = showSearchList ? '' : 'none';
          }
        };
        setActive();
        tabSearch.addEventListener('click', () => {
          state.showAll = false;
          state.searchVisible = false;
          setActive();
          try {
            const p = new URLSearchParams();
            if (state.code) p.set('code', state.code);
            if (state.q) p.set('q', state.q);
            if (state.dept) p.set('dept', state.dept);
            if (state.role) p.set('role', state.role);
            if (state.status) p.set('status', state.status);
            if (state.hireFrom) p.set('hireFrom', state.hireFrom);
            if (state.hireTo) p.set('hireTo', state.hireTo);
            if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
            if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
            if (state.page && state.page > 1) p.set('page', String(state.page));
            const s = p.toString();
            history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#delete');
          } catch {}
        });
        tabShowAll.addEventListener('click', () => {
          state.showAll = true;
          state.searchVisible = false;
          setActive();
          renderRows();
          try {
            const p = new URLSearchParams();
            if (state.code) p.set('code', state.code);
            if (state.q) p.set('q', state.q);
            if (state.dept) p.set('dept', state.dept);
            if (state.role) p.set('role', state.role);
            if (state.status) p.set('status', state.status);
            if (state.hireFrom) p.set('hireFrom', state.hireFrom);
            if (state.hireTo) p.set('hireTo', state.hireTo);
            if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
            if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
            if (state.page && state.page > 1) p.set('page', String(state.page));
            p.set('showAll', '1');
            const s = p.toString();
            history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#delete');
          } catch {}
        });
      }
      const tbEl = filterWrap.querySelector('.emp-del-toolbar'); if (tbEl) tbEl.style.display = (state.showAll || state.searchVisible) ? '' : 'none';
      const codeEl = filterWrap.querySelector('#empSearchCode'); if (codeEl) codeEl.value = (params.get('code') || '');
      const nameEl = filterWrap.querySelector('#empSearchName'); if (nameEl) nameEl.value = (params.get('q') || '');
      const deptEl = filterWrap.querySelector('#empDeptFilter'); if (deptEl) deptEl.value = params.get('dept') || '';
      const roleEl = filterWrap.querySelector('#empRoleFilter'); if (roleEl) roleEl.value = params.get('role') || '';
      const statusEl = filterWrap.querySelector('#empStatusFilter'); if (statusEl) statusEl.value = params.get('status') || '';
      const hireFromEl = filterWrap.querySelector('#empHireFrom'); if (hireFromEl) hireFromEl.value = params.get('hireFrom') || '';
      const hireToEl = filterWrap.querySelector('#empHireTo'); if (hireToEl) hireToEl.value = params.get('hireTo') || '';
    } catch {}
    filterWrap.querySelector('#btnEmpSearch').addEventListener('click', () => {
      state.code = (filterWrap.querySelector('#empSearchCode')?.value || '').trim().toLowerCase();
      state.q = (filterWrap.querySelector('#empSearchName').value || '').trim().toLowerCase();
      state.dept = filterWrap.querySelector('#empDeptFilter').value || '';
      state.role = filterWrap.querySelector('#empRoleFilter').value || '';
      state.status = filterWrap.querySelector('#empStatusFilter').value || '';
      state.hireFrom = (filterWrap.querySelector('#empHireFrom').value || '').trim();
      state.hireTo = (filterWrap.querySelector('#empHireTo').value || '').trim();
      state.page = 1;
      const hasAny = !!(state.code || state.q || state.dept || state.role || state.status || state.hireFrom || state.hireTo);
      state.searchVisible = hasAny;
      if (!hasAny) {
        try {
          const listBox = filterWrap.querySelector('#empListBox');
          if (listBox) {
            table.style.display = 'none';
            pager.style.display = 'none';
            listBox.style.display = 'none';
          }
        } catch {}
        alert('検索条件を入力してください');
        return;
      }
      renderRows();
      try {
        const listBox = filterWrap.querySelector('#empListBox');
        if (listBox) {
          table.style.display = '';
          pager.style.display = '';
          listBox.style.display = '';
        }
      } catch {}
      try {
        const p = new URLSearchParams();
        if (state.code) p.set('code', state.code);
        if (state.showAll) p.set('showAll', '1');
        if (state.searchVisible) p.set('search', '1');
        if (state.q) p.set('q', state.q);
        if (state.dept) p.set('dept', state.dept);
        if (state.role) p.set('role', state.role);
        if (state.status) p.set('status', state.status);
        if (state.hireFrom) p.set('hireFrom', state.hireFrom);
        if (state.hireTo) p.set('hireTo', state.hireTo);
        if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
        if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
        if (state.page && state.page > 1) p.set('page', String(state.page));
        const s = p.toString();
        history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
      } catch {}
    });
    if (mode === 'delete') {
      const bulkHandler = async (e) => {
        if (e.target && e.target.id === 'empBulkDisable') {
          const ids = Array.from(content.querySelectorAll('.empSel:checked')).map(i => i.value);
          if (!ids.length) { alert('対象を選択してください'); return; }
          const overlay = document.createElement('div');
          overlay.className = 'modal-overlay';
          const modal = document.createElement('div');
          modal.className = 'modal';
          const listRows = ids.map(id => {
            const u = users.find(x => String(x.id) === String(id));
            const code = u?.employee_code || fmtEmpNo(id);
            const name = u?.username || '';
            const dept = deptName(u?.departmentId);
            return `<div class="row"><div>${code}</div><div>${name}　${dept}</div></div>`;
          }).join('');
          modal.innerHTML = `
            <div class="modal-head">⚠️　社員無効化の確認</div>
            <div class="modal-body">
              <div>以下の社員を無効化しますか？</div>
              <div class="modal-list">${listRows}</div>
              <div>この操作は取り消すことができません。</div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" id="modalConfirmDisable">無効化する</button>
              <button type="button" class="btn" id="modalCancelDisable">キャンセル</button>
            </div>
          `;
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
          const close = () => { try { document.body.removeChild(overlay); } catch {} };
          overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
          modal.querySelector('#modalCancelDisable').addEventListener('click', close);
          modal.querySelector('#modalConfirmDisable').addEventListener('click', async () => {
            const btn = modal.querySelector('#modalConfirmDisable');
            btn.disabled = true;
            try {
              for (const id of ids) {
                try { await deleteEmployee(id); } catch {}
              }
              for (const id of ids) {
                const u = users.find(x => String(x.id) === String(id));
                if (u) u.employment_status = 'inactive';
              }
              renderRows();
            } finally {
              close();
              alert('無効化しました（状態: 無効/休職）');
            }
          });
        }
      };
      pager.addEventListener('click', bulkHandler);
      filterWrap.addEventListener('click', bulkHandler);
    }
    const prev = pager.querySelector('#empPrev');
    const next = pager.querySelector('#empNext');
    prev.addEventListener('click', () => {
      if (state.page > 1) { state.page -= 1; renderRows();
        try {
          const p = new URLSearchParams();
          if (state.q) p.set('q', state.q);
          if (state.dept) p.set('dept', state.dept);
          if (state.role) p.set('role', state.role);
          if (state.status) p.set('status', state.status);
          if (state.hireFrom) p.set('hireFrom', state.hireFrom);
          if (state.hireTo) p.set('hireTo', state.hireTo);
          if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
          if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
          if (state.page && state.page > 1) p.set('page', String(state.page));
          const s = p.toString();
          history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
        } catch {} }
        try { const tb = filterWrap.querySelector('.emp-del-toolbar'); if (tb) tb.style.display = content.querySelectorAll('.empSel').length ? '' : 'none'; } catch {}
    });
    next.addEventListener('click', () => {
      const total = applyFilterSort().length;
      const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page < maxPage) { state.page += 1; renderRows();
        try {
          const p = new URLSearchParams();
          if (state.q) p.set('q', state.q);
          if (state.dept) p.set('dept', state.dept);
          if (state.role) p.set('role', state.role);
          if (state.status) p.set('status', state.status);
          if (state.hireFrom) p.set('hireFrom', state.hireFrom);
          if (state.hireTo) p.set('hireTo', state.hireTo);
          if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
          if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
          if (state.page && state.page > 1) p.set('page', String(state.page));
          const s = p.toString();
          history.replaceState(null, '', (s ? `?tab=employees&${s}` : `?tab=employees`) + '#list');
        } catch {} }
        try { const tb = filterWrap.querySelector('.emp-del-toolbar'); if (tb) tb.style.display = content.querySelectorAll('.empSel').length ? '' : 'none'; } catch {}
    });
    content.addEventListener('click', async (e) => {
      const a = e.target?.closest?.('a');
      if (a) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('/ui/admin?tab=employees&detail=') || href.startsWith('/ui/admin?tab=employees&edit=')) {
          e.preventDefault();
          const p = new URLSearchParams();
          const qv = (filterWrap.querySelector('#empSearchName')?.value || '').trim().toLowerCase();
          const dv = filterWrap.querySelector('#empDeptFilter')?.value || '';
          const rv = filterWrap.querySelector('#empRoleFilter')?.value || '';
          const sv = filterWrap.querySelector('#empStatusFilter')?.value || '';
          const hf = filterWrap.querySelector('#empHireFrom')?.value || '';
          const ht = filterWrap.querySelector('#empHireTo')?.value || '';
          if (qv) p.set('q', qv);
          if (dv) p.set('dept', dv);
          if (rv) p.set('role', rv);
          if (sv) p.set('status', sv);
          if (hf) p.set('hireFrom', hf);
          if (ht) p.set('hireTo', ht);
          if (state && state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
          if (state && state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
          if (state && state.page && state.page > 1) p.set('page', String(state.page));
          const s = p.toString();
          const url = href + (s ? '&' + s : '');
          window.location.href = url;
          return;
        }
      }
      const delId = e.target?.getAttribute?.('data-delete');
      if (delId) {
        if (confirm('この社員を無効化しますか？')) {
          try {
            await deleteEmployee(delId);
            const u = users.find(x => String(x.id) === String(delId));
            if (u) u.employment_status = 'inactive';
            alert('無効化しました（状態: 無効/休職）');
            renderRows();
          } catch (err) {
            alert(String(err?.message || '無効化に失敗しました'));
          }
        }
      }
    });
    hideNavSpinner();
  }
  async function renderAttendance() {
    const users = await listUsers();
    content.innerHTML = '<h3>勤怠管理</h3>';
    const form = document.createElement('form');
    form.innerHTML = `
      <select id="tsUser">${users.map(u=>`<option value="${u.id}">${u.id} ${u.username||u.email}</option>`).join('')}</select>
      <input id="tsFrom" placeholder="From(YYYY-MM-DD)">
      <input id="tsTo" placeholder="To(YYYY-MM-DD)">
      <button type="submit">表示</button>
      <button type="button" id="tsExport">CSV</button>
    `;
    const resultDiv = document.createElement('div');
    const detailDiv = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = parseInt(document.querySelector('#tsUser').value, 10);
      const from = document.querySelector('#tsFrom').value.trim();
      const to = document.querySelector('#tsTo').value.trim();
      const r = await getTimesheet(userId, from, to);
      resultDiv.innerHTML = '';
      detailDiv.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>日付</th><th>通常</th><th>残業</th><th>深夜</th><th>操作</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const d of (r.days||[])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${d.date}</td><td>${d.regularMinutes}</td><td>${d.overtimeMinutes}</td><td>${d.nightMinutes}</td><td><button data-day="${d.date}">詳細</button></td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      resultDiv.appendChild(table);
      resultDiv.addEventListener('click', async (ev) => {
        const date = ev.target?.getAttribute?.('data-day');
        if (date) {
          const q = await getAttendanceDay(userId, date);
          detailDiv.innerHTML = `<h4>${date} 編集</h4>`;
          const t2 = document.createElement('table');
          t2.style.width = '100%';
          t2.innerHTML = '<thead><tr><th>ID</th><th>出勤</th><th>退勤</th><th>保存</th></tr></thead>';
          const b2 = document.createElement('tbody');
          for (const seg of (q.segments||[])) {
            const tr2 = document.createElement('tr');
            tr2.innerHTML = `
              <td>${seg.id}</td>
              <td><input data-in="${seg.id}" value="${seg.checkIn || ''}"></td>
              <td><input data-out="${seg.id}" value="${seg.checkOut || ''}"></td>
              <td><button data-save-att="${seg.id}">保存</button></td>
            `;
            b2.appendChild(tr2);
          }
          t2.appendChild(b2);
          detailDiv.appendChild(t2);
        }
      });
    });
    form.querySelector('#tsExport').addEventListener('click', () => {
      const userId = parseInt(document.querySelector('#tsUser').value, 10);
      const from = document.querySelector('#tsFrom').value.trim();
      const to = document.querySelector('#tsTo').value.trim();
      const url = buildTimesheetExportURL(String(userId), from, to);
      downloadWithAuth(url, 'timesheet.csv');
    });
    content.appendChild(form);
    content.appendChild(resultDiv);
    content.appendChild(detailDiv);
    content.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-save-att');
      if (id) {
        const inVal = content.querySelector(`input[data-in="${id}"]`)?.value || null;
        const outVal = content.querySelector(`input[data-out="${id}"]`)?.value || null;
        await updateAttendanceSegment(id, { checkIn: inVal, checkOut: outVal });
        alert('保存しました');
      }
    });
  }
  async function renderDbCheck() {
    showNavSpinner();
    try {
      const r = await fetchJSONAuth('/api/admin/db/check');
      content.innerHTML = '<h3>DB検査</h3>';
      const wrap = document.createElement('div');
      const t1 = document.createElement('table');
      t1.style.width = '100%';
      t1.innerHTML = `
        <thead><tr><th>項目</th><th>値</th></tr></thead>
        <tbody>
          <tr><td>Database</td><td>${r.db || ''}</td></tr>
          <tr><td>Version</td><td>${r.version || ''}</td></tr>
          <tr><td>Users</td><td>${r.users?.total || 0}</td></tr>
          <tr><td>Active</td><td>${r.users?.active || 0}</td></tr>
          <tr><td>Inactive</td><td>${r.users?.inactive || 0}</td></tr>
          <tr><td>Retired</td><td>${r.users?.retired || 0}</td></tr>
          <tr><td>Hire set</td><td>${r.users?.hire_set || 0}</td></tr>
          <tr><td>Hire null</td><td>${r.users?.hire_null || 0}</td></tr>
          <tr><td>Departments</td><td>${r.departments?.total || 0}</td></tr>
        </tbody>
      `;
      const t2 = document.createElement('table');
      t2.style.width = '100%';
      t2.innerHTML = '<thead><tr><th>ID</th><th>社員番号</th><th>氏名</th><th>Email</th><th>部署ID</th><th>状態</th><th>入社日</th></tr></thead>';
      const b2 = document.createElement('tbody');
      for (const u of (r.sampleUsers || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.id}</td><td>${u.employee_code||''}</td><td>${u.username||''}</td><td>${u.email||''}</td><td>${u.departmentId||''}</td><td>${u.employment_status||''}</td><td>${u.hire_date||''}</td>`;
        b2.appendChild(tr);
      }
      t2.appendChild(b2);
      const t3 = document.createElement('table');
      t3.style.width = '100%';
      t3.innerHTML = '<thead><tr><th>テーブル</th><th>照合順序</th></tr></thead>';
      const b3 = document.createElement('tbody');
      for (const c of (r.collations || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${c.table}</td><td>${c.collation}</td>`;
        b3.appendChild(tr);
      }
      t3.appendChild(b3);
      wrap.appendChild(t1);
      wrap.appendChild(document.createElement('hr'));
      wrap.appendChild(t2);
      wrap.appendChild(document.createElement('hr'));
      wrap.appendChild(t3);
      content.appendChild(wrap);
    } catch (err) {
      const msg = document.createElement('div');
      msg.style.color = '#b00020';
      msg.textContent = 'DB検査失敗: ' + (err?.message || 'unknown');
      content.appendChild(msg);
    }
    hideNavSpinner();
  }
  async function renderPayslipUpload() {
    content.innerHTML = '<h3>給与アップロード</h3>';
    const users = await listUsers();
    const form = document.createElement('form');
    form.enctype = 'multipart/form-data';
    form.innerHTML = `
      <select id="payUser">${users.map(u=>`<option value="${u.id}">${u.id} ${u.username||u.email}</option>`).join('')}</select>
      <input id="payMonth" placeholder="YYYY-MM">
      <input id="payFile" type="file" accept="application/pdf">
      <button type="submit">アップロード</button>
    `;
    const result = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = parseInt(document.querySelector('#payUser').value, 10);
      const month = document.querySelector('#payMonth').value.trim();
      const fileEl = document.querySelector('#payFile');
      if (!fileEl.files || !fileEl.files[0]) return alert('ファイルを選択してください');
      const fd = new FormData();
      fd.append('userId', String(userId));
      fd.append('month', month);
      fd.append('file', fileEl.files[0]);
      let tok = sessionStorage.getItem('accessToken') || '';
      const res = await fetch('/api/payslips/admin/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok }, body: fd, credentials: 'include' });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.message || msg; } catch {}
        alert(msg); return;
      }
      const r = await res.json();
      result.textContent = `OK: id=${r.id}, user=${r.userId}, month=${r.month}`;
    });
    content.appendChild(form);
    content.appendChild(result);
  }
  async function renderHome() {
    let stats = null;
    try {
      stats = await fetchJSONAuth('/api/admin/home/stats');
    } catch {
      stats = { todayCheckin: 0, lateCount: 0, leaveCount: 0, pendingCount: 0 };
    }

    content.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'dashboard';

    const head = document.createElement('div');
    head.className = 'dashboard-head';
    const title = document.createElement('h3');
    title.textContent = 'Admin Dashboard';
    head.appendChild(title);
    wrap.appendChild(head);

    const kpi = document.createElement('div');
    kpi.className = 'kpi-grid';
    const makeKpi = (t, v, s) => {
      const c = document.createElement('div');
      c.className = 'kpi-card';
      const tt = document.createElement('div');
      tt.className = 'kpi-title';
      tt.textContent = t;
      const vv = document.createElement('div');
      vv.className = 'kpi-value';
      vv.textContent = String(v);
      const ss = document.createElement('div');
      ss.className = 'kpi-sub';
      ss.textContent = s;
      c.appendChild(tt);
      c.appendChild(vv);
      c.appendChild(ss);
      return c;
    };
    kpi.appendChild(makeKpi('Today Work', stats.todayCheckin, '出勤人数'));
    kpi.appendChild(makeKpi('Late', stats.lateCount, '遅刻人数'));
    kpi.appendChild(makeKpi('Leave', stats.leaveCount, '休暇人数'));
    kpi.appendChild(makeKpi('Pending', stats.pendingCount, '未承認申請'));
    wrap.appendChild(kpi);

    const grid = document.createElement('div');
    grid.className = 'dash-grid';
    const chartCard = document.createElement('div');
    chartCard.className = 'dash-card';
    const chartTitle = document.createElement('div');
    chartTitle.className = 'dash-card-title';
    chartTitle.textContent = 'Attendance Chart';
    chartCard.appendChild(chartTitle);
    const chart = document.createElement('div');
    chart.className = 'dash-chart';
    const vals = [stats.todayCheckin, stats.lateCount, stats.leaveCount, stats.pendingCount].map(v => Math.max(0, Number(v) || 0));
    const max = Math.max(1, ...vals);
    for (const v of vals) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.setProperty('--h', `${Math.max(10, Math.round((v / max) * 100))}%`);
      chart.appendChild(bar);
    }
    chartCard.appendChild(chart);
    grid.appendChild(chartCard);

    const recentCard = document.createElement('div');
    recentCard.className = 'dash-card';
    const recentTitle = document.createElement('div');
    recentTitle.className = 'dash-card-title';
    recentTitle.textContent = 'Recent Requests';
    recentCard.appendChild(recentTitle);
    const table = document.createElement('table');
    table.className = 'dash-table';
    table.innerHTML = '<thead><tr><th>User</th><th>Type</th><th>Status</th></tr></thead>';
    const tbody = document.createElement('tbody');
    let rows = [];
    try { rows = await fetchJSONAuth('/api/leave/pending'); } catch { rows = []; }
    for (const r of (Array.isArray(rows) ? rows.slice(0, 6) : [])) {
      const tr = document.createElement('tr');
      const tdU = document.createElement('td');
      tdU.textContent = String(r.userId ?? '');
      const tdT = document.createElement('td');
      tdT.textContent = String(r.type ?? '');
      const tdS = document.createElement('td');
      const pill = document.createElement('span');
      pill.className = 'dash-pill';
      pill.textContent = String(r.status ?? '');
      tdS.appendChild(pill);
      tr.appendChild(tdU);
      tr.appendChild(tdT);
      tr.appendChild(tdS);
      tbody.appendChild(tr);
    }
    if (!tbody.children.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No pending requests';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    recentCard.appendChild(table);
    grid.appendChild(recentCard);
    wrap.appendChild(grid);

    content.appendChild(wrap);
  }
  async function renderApprovals(host, opts) {
    const c = host || content;
    c.innerHTML = '<h3>承認フロー</h3>';
    const rows = await fetchJSONAuth('/api/leave/pending');
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>期間</th><th>種類</th><th>状態</th><th>残数</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.id}</td><td>${r.userId}</td><td>${r.startDate}〜${r.endDate}</td><td>${r.type}</td><td>${r.status}</td><td><button class="btnBalance" data-user="${r.userId}">照会</button></td><td><button data-app="${r.id}" data-s="approved">承認</button> <button data-app="${r.id}" data-s="rejected">却下</button></td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    c.appendChild(table);
    // プロフィール更新申請
    const pcWrap = document.createElement('div');
    pcWrap.innerHTML = '<h4>プロフィール更新申請</h4>';
    const pcr = await fetchJSONAuth('/api/manager/profile-change/pending');
    const pcTable = document.createElement('table');
    pcTable.style.width = '100%';
    pcTable.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>内容</th><th>送信日時</th><th>操作</th></tr></thead>';
    const pcBody = document.createElement('tbody');
    for (const r of pcr) {
      const fields = r.fields || {};
      const summary = Object.keys(fields).slice(0,6).map(k => `${k}: ${String(fields[k]).slice(0,20)}`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.id}</td><td>${r.userId} ${r.username || ''}</td><td>${summary}</td><td>${r.createdAt || ''}</td><td><button data-pc="${r.id}" data-s="approved">承認</button> <button data-pc="${r.id}" data-s="rejected">却下</button></td>`;
      pcBody.appendChild(tr);
    }
    pcTable.appendChild(pcBody);
    pcWrap.appendChild(pcTable);
    c.appendChild(pcWrap);
    c.addEventListener('click', async (e) => {
      const id = e.target?.getAttribute?.('data-app');
      const s = e.target?.getAttribute?.('data-s');
      const u = e.target?.getAttribute?.('data-user');
      const pcId = e.target?.getAttribute?.('data-pc');
      if (u) {
        try {
          const r = await fetchJSONAuth(`/api/leave/user-balance?userId=${encodeURIComponent(u)}`);
          alert(`User ${u} 残数: ${r.totalAvailable}日`);
        } catch (err) {
          alert('残数取得失敗: ' + (err?.message || 'error'));
        }
        return;
      }
      if (id && s) {
        await fetchJSONAuth(`/api/leave/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
        await renderApprovals(c, opts);
      }
      if (pcId && s) {
        await fetchJSONAuth(`/api/manager/profile-change/${pcId}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) });
        await renderApprovals(c, opts);
      }
    });
  }
  async function renderReports() {
    content.innerHTML = '<h3>レポート</h3>';
    const block = document.createElement('div');
    block.innerHTML = `
      <h4>勤怠CSV</h4>
      <input id="repUserIds" placeholder="userIds (comma)">
      <input id="repFrom" placeholder="From(YYYY-MM-DD)">
      <input id="repTo" placeholder="To(YYYY-MM-DD)">
      <button id="repExport">エクスポート</button>
      <h4>休日ICS/CSV</h4>
      <input id="repYear" placeholder="Year" value="${new Date().getUTCFullYear()}">
      <button id="repHolidaysIcs">ICS</button>
      <button id="repHolidaysCsv">CSV</button>
    `;
    block.querySelector('#repExport').addEventListener('click', () => {
      const ids = document.querySelector('#repUserIds').value.trim();
      const from = document.querySelector('#repFrom').value.trim();
      const to = document.querySelector('#repTo').value.trim();
      const url = `/api/admin/export/timesheet.csv?userIds=${encodeURIComponent(ids)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      downloadWithAuth(url, 'timesheet.csv');
    });
    block.querySelector('#repHolidaysIcs').addEventListener('click', () => {
      const year = parseInt(document.querySelector('#repYear').value, 10);
      const url = `/api/admin/calendar/export?year=${year}`;
      downloadWithAuth(url, `holidays_${year}.ics`);
    });
    block.querySelector('#repHolidaysCsv').addEventListener('click', () => {
      const year = parseInt(document.querySelector('#repYear').value, 10);
      const url = `/api/admin/calendar/export.csv?year=${year}`;
      downloadWithAuth(url, `holidays_${year}.csv`);
    });
    content.appendChild(block);
  }
  async function renderLeaveAdmin() {
    content.innerHTML = '<h3>有給休暇管理</h3>';
    const data = await fetchJSONAuth('/api/leave/summary');
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>User</th><th>部門</th><th>付与合計</th><th>使用</th><th>残</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const r of data) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.userId} ${r.name || ''}</td><td>${r.departmentId ?? ''}</td><td>${r.totalGranted}</td><td>${r.usedDays}</td><td>${r.remainingDays}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    content.appendChild(table);
  }
  async function renderLeaveGrant(host, opts) {
    const c = host || content;
    c.innerHTML = '<h3>有給付与</h3>';
    const nav = document.createElement('div');
    if (opts?.hub) {
      nav.innerHTML = `
        <span class="btn">有給付与</span>
        <button class="btn" id="goApprovals">有給申請承認</button>
        <button class="btn" id="goBalance">有給残日数一覧</button>
        <button id="btnAutoGrant" class="btn">自動付与 実行</button>
      `;
    } else {
      nav.innerHTML = `
        <a class="btn" href="/ui/admin?tab=leave_grant">有給付与</a>
        <a class="btn" href="/ui/admin?tab=approvals">有給申請承認</a>
        <a class="btn" href="/ui/admin?tab=leave_balance">有給残日数一覧</a>
        <button id="btnAutoGrant" class="btn">自動付与 実行</button>
      `;
    }
    c.appendChild(nav);
    const users = await listUsers();
    const form = document.createElement('form');
    const today = new Date();
    function fmt(d){ return d.toISOString().slice(0,10); }
    const exp = new Date(Date.UTC(today.getUTCFullYear()+2, today.getUTCMonth(), today.getUTCDate()-1));
    form.innerHTML = `
      <label>User</label>
      <select id="grantUser"></select>
      <label>Days</label>
      <input id="grantDays" type="number" min="1" value="10">
      <label>Grant date</label>
      <input id="grantDate" type="date" value="${fmt(today)}">
      <label>Expire date</label>
      <input id="expireDate" type="date" value="${fmt(exp)}">
      <button type="submit">付与</button>
    `;
    const sel = form.querySelector('#grantUser');
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.id} ${u.username || u.email}`;
      sel.appendChild(opt);
    }
    form.querySelector('#grantDate').addEventListener('change', (e) => {
      try {
        const d = new Date(e.target.value + 'T00:00:00Z');
        const tmp = new Date(Date.UTC(d.getUTCFullYear()+2, d.getUTCMonth(), d.getUTCDate()-1));
        form.querySelector('#expireDate').value = fmt(tmp);
      } catch {}
    });
    const result = document.createElement('div');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const userId = parseInt(sel.value, 10);
      const days = parseInt(form.querySelector('#grantDays').value, 10);
      const grantDate = form.querySelector('#grantDate').value;
      const expiryDate = form.querySelector('#expireDate').value;
      try {
        await fetchJSONAuth('/api/leave/grant', { method:'POST', body: JSON.stringify({ userId, days, grantDate, expiryDate }) });
        result.textContent = '付与しました';
      } catch (err) {
        result.textContent = '付与失敗: ' + (err?.message || 'error');
      }
    });
    nav.querySelector('#btnAutoGrant').addEventListener('click', async () => {
      try {
        const r = await fetchJSONAuth('/api/leave/auto-grant/run', { method:'POST' });
        alert(`自動付与 実行: ${r.ok || 0}/${r.processed || 0}`);
      } catch (err) {
        alert('自動付与失敗: ' + (err?.message || 'error'));
      }
    });
    if (opts?.hub) {
      const btnA = nav.querySelector('#goApprovals');
      const btnB = nav.querySelector('#goBalance');
      if (btnA) btnA.addEventListener('click', () => renderApprovals(c, { hub: true }));
      if (btnB) btnB.addEventListener('click', () => renderLeaveBalance(c, { hub: true }));
    }
    c.appendChild(form);
    c.appendChild(result);
  }
  async function renderLeaveBalance(host, opts) {
    const c = host || content;
    c.innerHTML = '<h3>有給残日数一覧</h3>';
    const nav = document.createElement('div');
    if (opts?.hub) {
      nav.innerHTML = `
        <button class="btn" id="goGrant">有給付与</button>
        <button class="btn" id="goApprovals">有給申請承認</button>
        <span class="btn">有給残日数一覧</span>
        <button id="btnExportCsv" class="btn">CSV</button>
      `;
    } else {
      nav.innerHTML = `
        <a class="btn" href="/ui/admin?tab=leave_grant">有給付与</a>
        <a class="btn" href="/ui/admin?tab=approvals">有給申請承認</a>
        <a class="btn" href="/ui/admin?tab=leave_balance">有給残日数一覧</a>
        <button id="btnExportCsv" class="btn">CSV</button>
      `;
    }
    c.appendChild(nav);
    const data = await fetchJSONAuth('/api/leave/summary');
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>User</th><th>部門</th><th>付与合計</th><th>使用</th><th>残</th><th>有効期限(近日)</th><th>義務残</th></tr></thead>';
    const tbody = document.createElement('tbody');
    const today = new Date();
    for (const r of data) {
      const tr = document.createElement('tr');
      if (r.nearestExpiry && new Date(r.nearestExpiry) - today < 1000*60*60*24*30) {
        tr.style.background = '#fff4e5';
      }
      tr.innerHTML = `<td>${r.userId} ${r.name || ''}</td><td>${r.departmentId ?? ''}</td><td>${r.totalGranted}</td><td>${r.usedDays}</td><td>${r.remainingDays}</td><td>${r.nearestExpiry || ''} (${r.nearestExpiryRemaining || 0})</td><td>${r.obligationRemaining || 0}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    c.appendChild(table);
    if (opts?.hub) {
      const g = nav.querySelector('#goGrant');
      const a = nav.querySelector('#goApprovals');
      if (g) g.addEventListener('click', () => renderLeaveGrant(c, { hub: true }));
      if (a) a.addEventListener('click', () => renderApprovals(c, { hub: true }));
    }
    nav.querySelector('#btnExportCsv').addEventListener('click', () => {
      let csv = 'userId,name,departmentId,granted,used,remaining,nearest_expiry,nearest_expiry_remaining,obligation_remaining\n';
      for (const r of data) {
        csv += `${r.userId},${(r.name||'').replace(/,/g,' ')},${r.departmentId ?? ''},${r.totalGranted},${r.usedDays},${r.remainingDays},${r.nearestExpiry || ''},${r.nearestExpiryRemaining || 0},${r.obligationRemaining || 0}\n`;
      }
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url; a2.download = 'paid_leave_balance.csv'; a2.click();
      setTimeout(()=>URL.revokeObjectURL(url), 800);
    });
  }
  async function renderLeaveHub() {
    const c = content;
    c.innerHTML = '<h3>有給休暇</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin">戻る</a>
      <button class="btn" id="lvGrant">有給付与</button>
      <button class="btn" id="lvApprove">有給申請承認</button>
      <button class="btn" id="lvBalance">有給残日数一覧</button>
    `;
    c.appendChild(nav);
    const body = document.createElement('div');
    c.appendChild(body);
    const showGrant = () => { renderLeaveGrant(body, { hub: true }); };
    const showApprove = () => { renderApprovals(body, { hub: true }); };
    const showBalance = () => { renderLeaveBalance(body, { hub: true }); };
    function setHashAndRender(hash) {
      if (location.hash !== hash) location.hash = hash;
      if (hash.includes('grant')) showGrant();
      else if (hash.includes('approve')) showApprove();
      else showBalance();
    }
    nav.querySelector('#lvGrant').addEventListener('click', () => setHashAndRender('#leave=grant'));
    nav.querySelector('#lvApprove').addEventListener('click', () => setHashAndRender('#leave=approve'));
    nav.querySelector('#lvBalance').addEventListener('click', () => setHashAndRender('#leave=balance'));
    const initial = (location.hash || '').toLowerCase();
    if (initial.includes('grant')) showGrant();
    else if (initial.includes('approve')) showApprove();
    else showBalance();
    window.addEventListener('hashchange', () => {
      const h = (location.hash || '').toLowerCase();
      if (h.includes('grant')) showGrant();
      else if (h.includes('approve')) showApprove();
      else showBalance();
    }, { once: false });
  }
  async function renderSalaryList() {
    content.innerHTML = '<h3>給与一覧</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="salUserId" type="number" placeholder="userId(任意)">
      <input id="salMonth" placeholder="YYYY-MM(任意)">
      <button type="submit">表示</button>
    `;
    const result = document.createElement('div');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userId = document.querySelector('#salUserId').value.trim();
      const month = document.querySelector('#salMonth').value.trim();
      const qs = [];
      if (userId) qs.push(`userId=${encodeURIComponent(userId)}`);
      if (month) qs.push(`month=${encodeURIComponent(month)}`);
      const r = await fetchJSONAuth(`/api/admin/salary/history${qs.length ? '?' + qs.join('&') : ''}`);
      result.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>Month</th><th>Created</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const row of (r.data || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${row.id}</td><td>${row.userId}</td><td>${row.month}</td><td>${row.created_at}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      result.appendChild(table);
    });
    content.appendChild(form);
    content.appendChild(result);
  }
  async function renderSalaryCalc() {
    content.innerHTML = '<h3>給与計算</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const users = await listUsers();
    const sel = document.createElement('select');
    sel.id = 'salaryUserIds';
    sel.multiple = true;
    sel.style.minWidth = '280px';
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.id} ${u.username || u.email}`;
      sel.appendChild(opt);
    }
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="salaryMonth" placeholder="YYYY-MM">
      <button type="submit">プレビュー</button>
      <button type="button" id="btnCloseMonth">月締め</button>
      <button type="button" id="btnExportCsv">CSV</button>
    `;
    content.appendChild(sel);
    content.appendChild(form);
    const result = document.createElement('div');
    content.appendChild(result);
    function getSelectedIds() {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ids = getSelectedIds();
      const month = document.querySelector('#salaryMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const r = await fetchJSONAuth(`/api/admin/salary?userIds=${encodeURIComponent(ids.join(','))}&month=${encodeURIComponent(month)}`);
      result.innerHTML = '';
      const table = document.createElement('table');
      table.style.width = '100%';
      table.innerHTML = '<thead><tr><th>User</th><th>氏名</th><th>月</th><th>総支給額</th><th>差引支給額</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const e1 of (r.employees || [])) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${e1.userId}</td><td>${e1.氏名 || ''}</td><td>${e1.対象年月}</td><td>${e1.合計?.総支給額 || 0}</td><td>${e1.合計?.差引支給額 || 0}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      result.appendChild(table);
      result.dataset.csv = JSON.stringify(r.employees || []);
    });
    form.querySelector('#btnCloseMonth').addEventListener('click', async () => {
      const ids = getSelectedIds();
      const month = document.querySelector('#salaryMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const r = await fetchJSONAuth('/api/admin/salary/close-month', { method: 'POST', body: JSON.stringify({ userIds: ids.join(','), month }) });
      alert(`締め処理: ${r.closed} 件`);
    });
    form.querySelector('#btnExportCsv').addEventListener('click', () => {
      try {
        const arr = JSON.parse(result.dataset.csv || '[]');
        let csv = 'userId,name,month,total_gross,total_net\n';
        for (const e1 of arr) {
          csv += `${e1.userId},${e1.氏名 || ''},${e1.対象年月},${e1.合計?.総支給額 || 0},${e1.合計?.差引支給額 || 0}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'salary.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    });
  }
  async function renderPayslipSend() {
    content.innerHTML = '<h3>給与明細送信</h3>';
    const nav = document.createElement('div');
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=salary_list">給与一覧</a>
      <a class="btn" href="/ui/admin?tab=salary_calc">給与計算</a>
      <a class="btn" href="/ui/admin?tab=salary_send">給与明細送信</a>
    `;
    content.appendChild(nav);
    const users = await listUsers();
    const sel = document.createElement('select');
    sel.id = 'sendUserIds';
    sel.multiple = true;
    sel.style.minWidth = '280px';
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = String(u.id);
      opt.textContent = `${u.id} ${u.username || u.email}`;
      sel.appendChild(opt);
    }
    const form = document.createElement('form');
    form.innerHTML = `
      <input id="sendMonth" placeholder="YYYY-MM">
      <button type="submit">検索</button>
      <button type="button" id="btnOpenAll">全て開く</button>
      <button type="button" id="btnExportLinks">CSVリンク</button>
    `;
    const result = document.createElement('div');
    const list = document.createElement('ul');
    result.appendChild(list);
    content.appendChild(sel);
    content.appendChild(form);
    content.appendChild(result);
    function getSelectedIds() {
      return Array.from(sel.selectedOptions).map(o => o.value);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      list.innerHTML = '';
      const ids = getSelectedIds();
      const month = document.querySelector('#sendMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const links = [];
      for (const id of ids) {
        try {
          const r = await fetchJSONAuth(`/api/payslips/admin/list?userId=${encodeURIComponent(id)}&month=${encodeURIComponent(month)}&page=1&pageSize=1`);
          const it = (r.data || [])[0];
          if (it) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = it.secureUrl;
            a.target = '_blank';
            a.textContent = `${id} ${it.originalName || it.month}`;
            li.appendChild(a);
            list.appendChild(li);
            links.push({ userId: id, month: it.month, url: location.origin + it.secureUrl });
          } else {
            const li = document.createElement('li');
            li.textContent = `${id} 該当月の明細なし`;
            list.appendChild(li);
          }
        } catch (err) {
          const li = document.createElement('li');
          li.textContent = `${id} 取得失敗: ${err?.message || 'error'}`;
          list.appendChild(li);
        }
      }
      result.dataset.links = JSON.stringify(links);
    });
    form.querySelector('#btnOpenAll').addEventListener('click', () => {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        for (const l of links) {
          window.open(l.url, '_blank');
        }
      } catch {}
    });
    form.querySelector('#btnExportLinks').addEventListener('click', () => {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        let csv = 'userId,month,url\n';
        for (const l of links) {
          csv += `${l.userId},${l.month},${l.url}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payslip_links.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    });
  }
  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1') {
      showNavSpinner();
    }
  } catch {}
  try {
    if (tab === 'employees') await renderEmployees();
    else if (tab === 'users') await renderUsers();
    else if (tab === 'dbcheck') await renderDbCheck();
    else if (tab === 'departments') await renderDepartments();
    else if (tab === 'attendance') await renderAttendance();
    else if (tab === 'approvals') await renderApprovals();
    else if (tab === 'leave') await renderLeaveHub();
    else if (tab === 'reports') await renderReports();
    else if (tab === 'leave_admin') await renderLeaveBalance();
    else if (tab === 'leave_grant') await renderLeaveGrant();
    else if (tab === 'leave_balance') await renderLeaveBalance();
    else if (tab === 'settings') await renderSettings();
    else if (tab === 'audit') await renderAudit();
    else if (tab === 'refresh') await renderRefresh();
    else if (tab === 'calendar') await renderCalendar();
    else if (tab === 'shifts') await renderShifts();
    else if (tab === 'routes') await renderRoutes();
    else if (tab === 'salary_list') await renderSalaryList();
    else if (tab === 'salary_calc') await renderSalaryCalc();
    else if (tab === 'salary_send') await renderPayslipSend();
    else if (tab === 'payslip_upload') await renderPayslipUpload();
    else { await renderHome(); }
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: ' + (e?.message || 'unknown'); }
  } finally {
    hideNavSpinner();
    try { sessionStorage.removeItem('navSpinner'); } catch {}
  }
  if (status) status.textContent = '';
});
