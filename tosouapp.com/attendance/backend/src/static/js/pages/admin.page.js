import { me, refresh } from '../api/auth.api.js';
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from '../api/employees.api.js';
import { listDepartments } from '../api/departments.api.js';
import { listUsers, deleteUser as deleteUserAccount, resetUserPassword } from '../api/users.api.js';
import { getTimesheet, getAttendanceDay, updateAttendanceSegment, buildTimesheetExportURL } from '../api/attendance.api.js';

// Layout System
import { 
  initLayout, 
  setTopbarHeightVar, 
  setSidebarActive, 
  showNavSpinner, 
  hideNavSpinner,
  ensureSpinnerStyle,
  ensureJapanSafeColorsStyle,
  ensureEmployeePillStyle
} from '../shared/layout/layout.js';

const $ = (sel) => document.querySelector(sel);

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
  if (p.indexOf('v=') >= 0) return p;
  return p + (p.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(assetV);
};

async function ensureAdmin() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) {
    try { profile = await me(token); } catch { }
  }
  if (!profile) {
    try {
      const r = await refresh();
      sessionStorage.setItem('accessToken', r.accessToken);
      token = r.accessToken;
      profile = await me(token);
    } catch { }
  }
  if (!profile) {
    try {
      const r2 = await refresh();
      sessionStorage.setItem('accessToken', r2.accessToken);
      token = r2.accessToken;
      profile = await me(token);
    } catch { }
  }
  if (!profile) {
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && user.role && (String(user.role).toLowerCase() === 'admin' || String(user.role).toLowerCase() === 'manager')) {
        profile = user;
        try {
          const r3 = await refresh();
          sessionStorage.setItem('accessToken', r3.accessToken);
        } catch { }
      }
    } catch { }
  }
  if (!profile) {
    const err = document.querySelector('#error');
    if (err) { err.style.display = 'block'; err.textContent = 'ログインが必要です。もう一度ログインしてください。'; }
    try {
      const sp = document.querySelector('#pageSpinner');
      if (sp) { sp.setAttribute('hidden', ''); sp.style.display = 'none'; }
    } catch { }
    setTimeout(() => { try { window.location.replace('/ui/login'); } catch { } }, 200);
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
  // Init Shared Styles
  ensureSpinnerStyle();
  ensureJapanSafeColorsStyle();
  ensureEmployeePillStyle();

  // Init Layout DOM Events (topbar, sidebar, mobile drawer, dropdowns)
  initLayout();

  const status = $('#status');
  if (status) status.textContent = '認証を確認しています…';
  
  let profile = null;
  try {
    profile = await ensureAdmin();
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '認証エラー: ' + ((e && e.message) ? e.message : 'unknown'); }
  }
  
  if (!profile) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: Invalid or expired token'; }
    try {
      const sp = document.querySelector('#pageSpinner');
      if (sp) { sp.setAttribute('hidden', ''); sp.style.display = 'none'; }
    } catch { }
    try {
      const st = document.querySelector('#status');
      if (st) st.textContent = '';
    } catch { }
    setTimeout(() => { try { window.location.href = '/ui/login'; } catch { } }, 200);
    return;
  }
  
  $('#userName').textContent = profile.username || profile.email || '管理者';
  try {
    const uname = String(profile.username || '').trim();
    const full = uname || String(profile.email || '').trim();
    const ch = full ? full[0] : '';
    const ddName = document.querySelector('#userDropdownName');
    const ddInit = document.querySelector('#userInitial');
    const btnInit = document.querySelector('#userBtnInitial');
    if (ddName && full) ddName.textContent = full;
    if (ddInit && ch) { ddInit.textContent = ''; ddInit.setAttribute('data-initial', ch); }
    if (btnInit && ch) { btnInit.textContent = ''; btnInit.setAttribute('data-initial', ch); }
  } catch {}
  const content = $('#adminContent');
  
  function getCurrentTab() {
    const params = new URLSearchParams(window.location.search);
    let t = params.get('tab') || '';
    if (!t && window.location.pathname.startsWith('/ui/employees')) t = 'employees';
    return t;
  }
  
  let tab = getCurrentTab();
  if (content) content.className = 'card';
  setSidebarActive(tab);

  try {
    const wrapLegacy = (mountFn) => ({
      async mount(ctx) {
        return mountFn(ctx);
      },
      unmount() { }
    });

    let currentPage = null;

    const loadLeaveModule = async () => await import(withAssetV('../admin/legacy/legacy-leave.page.js'));
    const renderApprovals = async (host, opts) => {
      const mod = await loadLeaveModule();
      return mod.mountApprovals({ host, content, opts, mountApprovalsFn: renderApprovals });
    };
    const renderLeaveGrant = async (host, opts) => {
      const mod = await loadLeaveModule();
      return mod.mountLeaveGrant({ host, content, opts, listUsers, mountApprovalsFn: renderApprovals, mountLeaveBalanceFn: renderLeaveBalance });
    };
    const renderLeaveBalance = async (host, opts) => {
      const mod = await loadLeaveModule();
      return mod.mountLeaveBalance({ host, content, opts, mountLeaveGrantFn: renderLeaveGrant, mountApprovalsFn: renderApprovals });
    };
    const renderLeaveHub = async () => {
      const mod = await loadLeaveModule();
      return mod.mountLeaveHub({ content, mountLeaveGrantFn: renderLeaveGrant, mountApprovalsFn: renderApprovals, mountLeaveBalanceFn: renderLeaveBalance });
    };

    async function renderByTab() {
      tab = getCurrentTab();
      setSidebarActive(tab);
      try {
        document.body.classList.remove('employees-wide');
      } catch { }
      const contentEl2 = document.querySelector('#adminContent');
      if (contentEl2) contentEl2.className = 'card';
      const tilesSection = document.querySelector('.tiles');
      if (tilesSection) tilesSection.style.display = tab ? 'none' : '';
      const subBrand = document.querySelector('.brand .sub');
      if (subBrand) {
        subBrand.style.display = tab === 'settings' ? 'none' : '';
        setTopbarHeightVar();
      }
      
      try {
        let employeesDyn = null;
        let attendanceDyn = null;
        const routes = {
          home: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-home.page.js'));
            return mod.mountHome(ctx);
          }),
          employees: {
            async mount(ctx) {
              const mod = await import(withAssetV('../admin/legacy/legacy-employees.page.js'));
              employeesDyn = mod.employeesPage;
              return employeesDyn.mount(ctx);
            },
            unmount() {
              try { if (employeesDyn && typeof employeesDyn.unmount === 'function') employeesDyn.unmount(); } catch {}
              employeesDyn = null;
            }
          },
          users: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-users.page.js'));
            return mod.mountUsers(ctx);
          }),
          dbcheck: wrapLegacy(async (ctx) => {
            showNavSpinner();
            const mod = await import(withAssetV('../admin/legacy/legacy-dbcheck.page.js'));
            return mod.mountDbCheck({ content, hideNavSpinner, ctx });
          }),
          departments: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-departments.page.js'));
            return mod.mountDepartments(ctx);
          }),
          attendance: {
            async mount(ctx) {
              const mod = await import(withAssetV('../admin/legacy/legacy-attendance.page.js'));
              attendanceDyn = mod.attendancePage;
              return attendanceDyn.mount(ctx);
            },
            unmount() {
              try { if (attendanceDyn && typeof attendanceDyn.unmount === 'function') attendanceDyn.unmount(); } catch {}
              attendanceDyn = null;
            }
          },
          approvals: wrapLegacy(async () => renderApprovals(null, null)),
          leave: wrapLegacy(async () => renderLeaveHub()),
          reports: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-reports.page.js'));
            return mod.mountReports(ctx);
          }),
          leave_grant: wrapLegacy(async () => renderLeaveGrant(null, null)),
          leave_balance: wrapLegacy(async () => renderLeaveBalance(null, null)),
          leave_admin: wrapLegacy(async () => renderLeaveBalance(null, null)),
          settings: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-settings.page.js'));
            return mod.mountSettings(ctx);
          }),
          audit: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-audit.page.js'));
            return mod.mountAudit(ctx);
          }),
          refresh: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-refresh.page.js'));
            return mod.mountRefresh(ctx);
          }),
          calendar: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-calendar.page.js'));
            return mod.mountCalendar(ctx);
          }),
          shifts: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-shifts.page.js'));
            return mod.mountShifts(ctx);
          }),
          routes: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-routes.page.js'));
            return mod.mountRoutes(ctx);
          }),
          salary_list: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/payroll/legacy-payroll-tabs.page.js'));
            return mod.mountSalaryList(ctx);
          }),
          salary_calc: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/payroll/legacy-payroll-tabs.page.js'));
            return mod.mountSalaryCalc(ctx);
          }),
          payroll_editor: wrapLegacy(async () => {
            const mod = await import(withAssetV('../admin/payroll/editor.page.js'));
            return mod.mount();
          }),
          salary_send: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/payroll/legacy-payroll-tabs.page.js'));
            return mod.mountPayslipSend(ctx);
          }),
          payslip_upload: wrapLegacy(async (ctx) => {
            const mod = await import(withAssetV('../admin/legacy/legacy-payslip-upload.page.js'));
            return mod.mountPayslipUpload(ctx);
          })
        };

        const nextPageKey = tab || 'home';
        const nextPage = routes[nextPageKey] || routes.home;

        if (currentPage) {
          try { currentPage.unmount(); } catch { }
        }

        currentPage = nextPage;
        await currentPage.mount({
          content,
          profile,
          listEmployees,
          listUsers,
          listDepartments,
          getEmployee,
          createEmployee,
          updateEmployee,
          deleteEmployee,
          deleteUserAccount,
          resetUserPassword,
          getTimesheet,
          getAttendanceDay,
          updateAttendanceSegment,
          buildTimesheetExportURL,
          showNavSpinner,
          hideNavSpinner,
          renderEmployees: renderByTab
        });
      } catch (e) {
        const err = $('#error');
        if (err) { err.style.display = 'block'; err.textContent = '読み込みエラー: ' + ((e && e.message) ? e.message : 'unknown'); }
      } finally {
        hideNavSpinner();
        try { sessionStorage.removeItem('navSpinner'); } catch { }
      }
    }
    window.addEventListener('hashchange', async () => { hideNavSpinner(); await renderByTab(); });
    window.addEventListener('popstate', async () => { hideNavSpinner(); await renderByTab(); });
    await renderByTab();
  } catch { }

  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1') {
      showNavSpinner();
    }
  } catch { }
  if (status) status.textContent = '';
});
