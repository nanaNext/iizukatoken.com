import { requireAdmin } from '../_shared/require-admin.js';
import { listEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee } from '../../api/employees.api.js';
import { listDepartments } from '../../api/departments.api.js';
import { listUsers, deleteUser as deleteUserHard } from '../../api/users.api.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

function ensureEmployeePillStyle() {
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
        .admin .card table#list tbody tr.emp-row.inactive td .text-pill { background: transparent; border-color: transparent; color: #7c2d12; }
        .admin .card table#list tbody tr.emp-row.inactive td .text-pill a { color: inherit; }
        .admin .card table#list tbody tr.emp-row.retired td { background: #f8fafc; color: #475569; }
        @media (max-width: 640px) {
          .admin.employees-wide .card table#list:not(.emp-del-list) thead,
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead,
          .admin.employees-wide .card table#list:not(.emp-del-list) thead th,
          .admin:not(.employees-wide) .card table#list:not(.emp-del-list) thead th {
            top: auto !important;
            position: static !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
  } catch {}
}

const showNavSpinner = () => {
  try { sessionStorage.removeItem('navSpinner'); } catch {}
};

const hideNavSpinner = () => {
  try {
    const c = document.querySelector('#adminContent');
    if (c) c.style.visibility = '';
  } catch {}
};

let employeesRenderSeq = 0;

function getEmployeesMode(pathname, hash, detailId, editId, summaryId, createFlag) {
  if (editId) return 'edit';
  if (summaryId) return 'summary';
  if (detailId) return 'detail';
  if (createFlag) return 'add';
  if (pathname === '/admin/employees/add') return 'add';
  if (pathname === '/admin/employees/delete') return 'delete';
  if (hash === '#add') return 'add';
  if (hash === '#delete') return 'delete';
  if (hash === '#edit') return 'edit';
  if (hash === '#summary') return 'summary';
  return 'list';
}

async function renderEmployees(profile) {
  try {
    const currentPath = String(location.pathname || '');
    if (currentPath === '/admin/employees/monthly-summary' || currentPath === '/admin/employees/monthly-summary/') {
      try {
        window.location.replace(currentPath + location.search + location.hash);
      } catch {
        window.location.href = currentPath + location.search + location.hash;
      }
      return;
    }
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1') showNavSpinner();
  } catch {}

  const seq = ++employeesRenderSeq;
  const content = $('#adminContent');
  if (!content) return;
  ensureEmployeePillStyle();

  const params = new URLSearchParams(location.search);
  const detailId = params.get('detail');
  const editId = params.get('edit');
  const summaryId = params.get('summary');
  const createFlag = params.get('create');
  const role2 = String((profile && profile.role) || '').toLowerCase();
  const isSuper = false;
  const superEmail = '';

  const pathname = String(location.pathname || '');
  const hash = location.hash || '';
  const mode = getEmployeesMode(pathname, hash, detailId, editId, summaryId, createFlag);
  try {
    if ((pathname === '/admin/employees' || pathname === '/admin/employees/') && !hash && !detailId && !editId && !summaryId && !createFlag) {
      history.replaceState(null, '', '/admin/employees#list');
    }
  } catch {}

  try { document.body.classList.remove('employees-wide'); } catch {}
  try {
    if (mode === 'delete') {
      document.body.classList.add('emp-delete-mode');
      document.documentElement.classList.add('emp-delete-mode');
    } else {
      document.body.classList.remove('emp-delete-mode');
      document.documentElement.classList.remove('emp-delete-mode');
    }
  } catch {}

  if (mode === 'detail' && detailId) {
    const u = await getEmployee(detailId);
    if (seq !== employeesRenderSeq) return;
    let depts2 = [];
    try { depts2 = role2 === 'manager' ? await fetchJSONAuth('/api/manager/departments') : await listDepartments(); } catch { depts2 = []; }
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
    const roleJa3 = roleV === 'admin' ? '管理者' : roleV === 'manager' ? 'マネージャー' : roleV === 'employee' ? '従業員' : (u.role || '');
    const roleCls3 = roleV === 'admin' ? 'admin' : roleV === 'manager' ? 'manager' : 'employee';
    const typeV = String(u.employment_type || '').toLowerCase();
    const typeJa3 = typeV === 'full_time' ? '正社員' : typeV === 'part_time' ? 'パート・アルバイト' : typeV === 'contract' ? '契約社員' : (u.employment_type || '');
    const typeCls3 = typeV === 'full_time' ? 'full' : typeV === 'part_time' ? 'part' : typeV === 'contract' ? 'contract' : '';
    const statusV = String(u.employment_status || '').toLowerCase();
    const statusCls3 = statusV === 'retired' ? 'retired' : statusV === 'inactive' ? 'inactive' : 'active';
    const name3 = (u.username || u.email || '').trim();
    const ini3 = name3 ? name3[0].toUpperCase() : '?';
    let mgrName3 = '';
    try {
      const allUsers3 = role2 === 'manager' ? await fetchJSONAuth('/api/manager/users') : await listUsers();
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
      <div class="detail-row" id="rowShift"><div class="label">シフト</div><div class="value">—</div></div>
      <div class="detail-row"><div class="label">直属マネージャー</div><div class="value">${mgrName3}</div></div>
      <div class="detail-row"><div class="label">レベル</div><div class="value">${u.level || ''}</div></div>
      <div class="detail-row"><div class="label">役割</div><div class="value"><span class="role-pill ${roleCls3}">${roleJa3}</span></div></div>
      <div class="detail-row"><div class="label">雇用形態</div><div class="value"><span class="type-pill ${typeCls3}">${typeJa3}</span></div></div>
      <div class="detail-row"><div class="label">入社日</div><div class="value">${fmtDate2(u.hire_date)}</div></div>
      <div class="detail-row"><div class="label">試用開始</div><div class="value">${fmtDate2(u.probation_date)}</div></div>
      <div class="detail-row"><div class="label">正社員化</div><div class="value">${fmtDate2(u.official_date)}</div></div>
      <div class="detail-row"><div class="label">契約終了</div><div class="value">${fmtDate2(u.contract_end)}</div></div>
      <div class="detail-row"><div class="label">基本給</div><div class="value">${u.base_salary == null ? '' : u.base_salary}</div></div>
      <div class="detail-row"><div class="label">状態</div><div class="value"><span class="status-pill ${statusCls3}">${statusJa2(u.employment_status)}</span></div></div>
      <div class="detail-actions form-actions">
        <a class="btn" id="btnDetailEdit" href="/admin/employees?edit=${u.id}">編集</a>
        <a class="btn" id="btnDetailBack" href="/admin/employees#list">一覧へ</a>
      </div>
    `;
    content.appendChild(panel);
    try {
      const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
      const r = await fetchJSONAuth(`/api/attendance/shifts/assignments?userId=${encodeURIComponent(String(u.id))}&from=1900-01-01&to=2999-12-31`);
      const items = (r && Array.isArray(r.items)) ? r.items : [];
      const active = items.find(it => {
        const sd = String(it.start_date || '').slice(0, 10);
        const ed = String(it.end_date || '').slice(0, 10);
        const okStart = !!sd && sd <= today;
        const okEnd = !ed || ed >= today;
        return okStart && okEnd;
      }) || null;
      let name = '—', st = '—', et = '—';
      const range = `${String(active?.start_date || '—')}${active?.end_date ? ' 〜 ' + String(active.end_date) : ''}`;
      if (active) {
        let def = null;
        if (active.shiftId) {
          try {
            const defs = await fetchJSONAuth('/api/attendance/shifts/definitions');
            def = (defs || []).find(d => String(d.id) === String(active.shiftId)) || null;
          } catch {}
        }
        if (active.shift && typeof active.shift === 'object') {
          name = String(active.shift.name || '');
          st = String(active.shift.start_time || '—');
          et = String(active.shift.end_time || '—');
          if ((!st || st === '—' || !et || et === '—') && def) {
            st = String(def.start_time || st || '—');
            et = String(def.end_time || et || '—');
          }
        } else {
          name = def ? String(def.name || '') : String(active.shift || '');
          st = def ? String(def.start_time || '—') : '—';
          et = def ? String(def.end_time || '—') : '—';
        }
      }
      const rowShift = panel.querySelector('#rowShift .value');
      if (rowShift) {
        const nm = name && name !== '—' ? name : '—';
        const time = (st && st !== '—' && et && et !== '—') ? `${st}-${et}` : '—';
        const rangeText = range && !range.startsWith('—') ? ` ${range}` : '';
        rowShift.innerHTML = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#eef5ff;color:#0b2c66;font-weight:700;margin-right:8px;">${nm}</span><span style="font-weight:700;color:#334155;margin-right:8px;">${time}</span><span style="color:#64748b;">${rangeText}</span>`;
      }
    } catch {}
    try {
      const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page'];
      const keep = new URLSearchParams();
      for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
      const qsKeep = keep.toString();
      const backHref = `/admin/employees${qsKeep ? '?' + qsKeep : ''}#list`;
      const editHref = `/admin/employees?edit=${u.id}${qsKeep ? '&' + qsKeep : ''}`;
      const btnEdit = panel.querySelector('#btnDetailEdit');
      if (btnEdit) btnEdit.setAttribute('href', editHref);
      const btnBack = panel.querySelector('#btnDetailBack');
      if (btnBack) btnBack.setAttribute('href', backHref);
    } catch {}
    hideNavSpinner();
    return;
  }

  if (mode === 'summary' && summaryId) {
    try {
      const month = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
      window.location.replace(`/admin/employees/monthly-summary?userId=${encodeURIComponent(summaryId)}&month=${encodeURIComponent(month)}`);
      return;
    } catch {}
    const u = await getEmployee(summaryId);
    if (seq !== employeesRenderSeq) return;
    content.innerHTML = ``;
    const wrap = document.createElement('div');
    const code = u.employee_code || ('EMP' + String(u.id).padStart(3,'0'));
    const jstYM = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
    wrap.innerHTML = `
      <div style="margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <a class="btn" id="sumBack" href="/admin/employees#list">← 社員一覧へ戻る</a>
        <a class="btn" id="sumToDetail" href="/admin/employees?detail=${u.id}">詳細</a>
        <a class="btn" id="sumToEdit" href="/admin/employees?edit=${u.id}">社員編集</a>
      </div>
      <h4 style="margin:0 0 12px;">社員月次サマリ（${code} / ${u.username || u.email || ''}）</h4>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">月次サマリ</th></tr></thead>
        <tbody>
          <tr>
            <td style="width:180px;">対象年月</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input id="sumMonth" type="month" style="width:180px">
                <button type="button" class="btn" id="btnSumLoad">読込</button>
                <button type="button" class="btn-primary" id="btnSumSave">保存</button>
                <span id="sumStatus" style="margin-left:4px;color:#334155;font-weight:800;"></span>
              </div>
            </td>
          </tr>
          <tr>
            <td>全体</td>
            <td>
              <div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;">
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">所定日数</span><input id="sumAllPlannedDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出勤日数</span><input id="sumAllAttendDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代出休出</span><input id="sumAllHolidayWorkDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">待機日数</span><input id="sumAllStandbyDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総労働時間</span><input id="sumAllTotalWork" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">深夜時間</span><input id="sumAllNight" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総残業時間</span><input id="sumAllOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">法定外時間</span><input id="sumAllLegalOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">有休日数</span><input id="sumAllPaidDays" type="number" step="0.1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代休日数</span><input id="sumAllSubstituteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">無給休暇</span><input id="sumAllUnpaidDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">欠勤日数</span><input id="sumAllAbsentDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">控除時間</span><input id="sumAllDeduction" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出社日数</span><input id="sumAllOnsiteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">在宅日数</span><input id="sumAllRemoteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">現場・出張</span><input id="sumAllSatelliteDays" type="number" step="1" style="width:90px"></label>
              </div>
            </td>
          </tr>
          <tr>
            <td>社内勤務</td>
            <td>
              <div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;">
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">所定日数</span><input id="sumIhPlannedDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出勤日数</span><input id="sumIhAttendDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代出休出</span><input id="sumIhHolidayWorkDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">待機日数</span><input id="sumIhStandbyDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総労働時間</span><input id="sumIhTotalWork" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">深夜時間</span><input id="sumIhNight" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総残業時間</span><input id="sumIhOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">法定外時間</span><input id="sumIhLegalOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">有休日数</span><input id="sumIhPaidDays" type="number" step="0.1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代休日数</span><input id="sumIhSubstituteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">無給休暇</span><input id="sumIhUnpaidDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">欠勤日数</span><input id="sumIhAbsentDays" type="number" step="1" style="width:90px"></label>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">シフト割当</th></tr></thead>
        <tbody>
          <tr>
            <td style="width:180px;">新規割当</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <select id="saShift" style="min-width:220px;"><option value="">シフト</option></select>
                <input id="saStart" type="date">
                <input id="saEnd" type="date">
                <button type="button" class="btn-primary" id="btnSaAdd">追加</button>
                <button type="button" class="btn" id="btnSaReload">再読込</button>
                <span id="saStatus" style="color:#334155;font-weight:700;"></span>
              </div>
            </td>
          </tr>
          <tr>
            <td>一覧</td>
            <td><div id="saTable"></div></td>
          </tr>
        </tbody>
      </table>
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">就業条件明示</th></tr></thead>
        <tbody>
          <tr>
            <td style="width:180px;">入力</td>
            <td>
              <div style="display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:8px;">
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">開始日</span><input id="wdStart" type="date" style="width:180px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">終了日</span><input id="wdEnd" type="date" style="width:180px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">企業名</span><input id="wdCompany" style="width:100%;"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">就業先住所</span><input id="wdAddr" style="width:100%;"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">業務内容</span><input id="wdWork" style="width:100%;"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">役職</span><input id="wdRole" style="width:100%;"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:92px;">責任の程度</span><input id="wdResp" style="width:100%;"></label>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;">
                <button type="button" class="btn-primary" id="btnWdAdd">追加</button>
                <button type="button" class="btn" id="btnWdReload">再読込</button>
                <span id="wdStatus" style="color:#334155;font-weight:700;"></span>
              </div>
            </td>
          </tr>
          <tr>
            <td>一覧</td>
            <td><div id="wdTable"></div></td>
          </tr>
        </tbody>
      </table>
    `;
    content.appendChild(wrap);

    const ymEl = wrap.querySelector('#sumMonth');
    if (ymEl && !ymEl.value) ymEl.value = jstYM();
    const stEl = wrap.querySelector('#sumStatus');
    const status = (msg) => { if (stEl) stEl.textContent = msg || ''; };
    const hmToMin = (s) => {
      const t = String(s || '').trim();
      if (!t) return 0;
      const m = t.match(/^(\d+):(\d{2})$/);
      if (!m) return null;
      const h = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (!Number.isFinite(h) || !Number.isFinite(mm) || mm < 0 || mm >= 60) return null;
      return Math.max(0, (h * 60) + mm);
    };
    const minToHm = (min) => {
      const m = Math.max(0, Number(min || 0));
      const h = Math.floor(m / 60);
      const r = Math.floor(m % 60);
      return `${h}:${String(r).padStart(2, '0')}`;
    };
    const num = (v) => {
      const x = Number(v);
      return Number.isFinite(x) ? x : 0;
    };
    const setAll = (obj) => {
      const x = obj && typeof obj === 'object' ? obj : {};
      wrap.querySelector('#sumAllPlannedDays').value = String(x.plannedDays == null ? '' : x.plannedDays);
      wrap.querySelector('#sumAllAttendDays').value = String(x.attendDays == null ? '' : x.attendDays);
      wrap.querySelector('#sumAllHolidayWorkDays').value = String(x.holidayWorkDays == null ? '' : x.holidayWorkDays);
      wrap.querySelector('#sumAllStandbyDays').value = String(x.standbyDays == null ? '' : x.standbyDays);
      wrap.querySelector('#sumAllTotalWork').value = minToHm(x.totalWorkMinutes == null ? 0 : x.totalWorkMinutes);
      wrap.querySelector('#sumAllNight').value = minToHm(x.nightMinutes == null ? 0 : x.nightMinutes);
      wrap.querySelector('#sumAllOvertime').value = minToHm(x.overtimeMinutes == null ? 0 : x.overtimeMinutes);
      wrap.querySelector('#sumAllLegalOvertime').value = minToHm(x.legalOvertimeMinutes == null ? 0 : x.legalOvertimeMinutes);
      wrap.querySelector('#sumAllPaidDays').value = String(x.paidDays == null ? '' : x.paidDays);
      wrap.querySelector('#sumAllSubstituteDays').value = String(x.substituteDays == null ? '' : x.substituteDays);
      wrap.querySelector('#sumAllUnpaidDays').value = String(x.unpaidDays == null ? '' : x.unpaidDays);
      wrap.querySelector('#sumAllAbsentDays').value = String(x.absentDays == null ? '' : x.absentDays);
      wrap.querySelector('#sumAllDeduction').value = minToHm(x.deductionMinutes == null ? 0 : x.deductionMinutes);
      wrap.querySelector('#sumAllOnsiteDays').value = String(x.onsiteDays == null ? '' : x.onsiteDays);
      wrap.querySelector('#sumAllRemoteDays').value = String(x.remoteDays == null ? '' : x.remoteDays);
      wrap.querySelector('#sumAllSatelliteDays').value = String(x.satelliteDays == null ? '' : x.satelliteDays);
    };
    const setIh = (obj) => {
      const x = obj && typeof obj === 'object' ? obj : {};
      wrap.querySelector('#sumIhPlannedDays').value = String(x.plannedDays == null ? '' : x.plannedDays);
      wrap.querySelector('#sumIhAttendDays').value = String(x.attendDays == null ? '' : x.attendDays);
      wrap.querySelector('#sumIhHolidayWorkDays').value = String(x.holidayWorkDays == null ? '' : x.holidayWorkDays);
      wrap.querySelector('#sumIhStandbyDays').value = String(x.standbyDays == null ? '' : x.standbyDays);
      wrap.querySelector('#sumIhTotalWork').value = minToHm(x.totalWorkMinutes == null ? 0 : x.totalWorkMinutes);
      wrap.querySelector('#sumIhNight').value = minToHm(x.nightMinutes == null ? 0 : x.nightMinutes);
      wrap.querySelector('#sumIhOvertime').value = minToHm(x.overtimeMinutes == null ? 0 : x.overtimeMinutes);
      wrap.querySelector('#sumIhLegalOvertime').value = minToHm(x.legalOvertimeMinutes == null ? 0 : x.legalOvertimeMinutes);
      wrap.querySelector('#sumIhPaidDays').value = String(x.paidDays == null ? '' : x.paidDays);
      wrap.querySelector('#sumIhSubstituteDays').value = String(x.substituteDays == null ? '' : x.substituteDays);
      wrap.querySelector('#sumIhUnpaidDays').value = String(x.unpaidDays == null ? '' : x.unpaidDays);
      wrap.querySelector('#sumIhAbsentDays').value = String(x.absentDays == null ? '' : x.absentDays);
    };
    const getAll = () => {
      const totalWorkMinutes = hmToMin(wrap.querySelector('#sumAllTotalWork').value);
      const nightMinutes = hmToMin(wrap.querySelector('#sumAllNight').value);
      const overtimeMinutes = hmToMin(wrap.querySelector('#sumAllOvertime').value);
      const legalOvertimeMinutes = hmToMin(wrap.querySelector('#sumAllLegalOvertime').value);
      const deductionMinutes = hmToMin(wrap.querySelector('#sumAllDeduction').value);
      if (totalWorkMinutes == null || nightMinutes == null || overtimeMinutes == null || legalOvertimeMinutes == null || deductionMinutes == null) return null;
      return {
        plannedDays: num(wrap.querySelector('#sumAllPlannedDays').value),
        attendDays: num(wrap.querySelector('#sumAllAttendDays').value),
        holidayWorkDays: num(wrap.querySelector('#sumAllHolidayWorkDays').value),
        standbyDays: num(wrap.querySelector('#sumAllStandbyDays').value),
        totalWorkMinutes,
        nightMinutes,
        overtimeMinutes,
        legalOvertimeMinutes,
        paidDays: num(wrap.querySelector('#sumAllPaidDays').value),
        substituteDays: num(wrap.querySelector('#sumAllSubstituteDays').value),
        unpaidDays: num(wrap.querySelector('#sumAllUnpaidDays').value),
        absentDays: num(wrap.querySelector('#sumAllAbsentDays').value),
        deductionMinutes,
        onsiteDays: num(wrap.querySelector('#sumAllOnsiteDays').value),
        remoteDays: num(wrap.querySelector('#sumAllRemoteDays').value),
        satelliteDays: num(wrap.querySelector('#sumAllSatelliteDays').value)
      };
    };
    const getIh = () => {
      const totalWorkMinutes = hmToMin(wrap.querySelector('#sumIhTotalWork').value);
      const nightMinutes = hmToMin(wrap.querySelector('#sumIhNight').value);
      const overtimeMinutes = hmToMin(wrap.querySelector('#sumIhOvertime').value);
      const legalOvertimeMinutes = hmToMin(wrap.querySelector('#sumIhLegalOvertime').value);
      if (totalWorkMinutes == null || nightMinutes == null || overtimeMinutes == null || legalOvertimeMinutes == null) return null;
      return {
        plannedDays: num(wrap.querySelector('#sumIhPlannedDays').value),
        attendDays: num(wrap.querySelector('#sumIhAttendDays').value),
        holidayWorkDays: num(wrap.querySelector('#sumIhHolidayWorkDays').value),
        standbyDays: num(wrap.querySelector('#sumIhStandbyDays').value),
        totalWorkMinutes,
        nightMinutes,
        overtimeMinutes,
        legalOvertimeMinutes,
        paidDays: num(wrap.querySelector('#sumIhPaidDays').value),
        substituteDays: num(wrap.querySelector('#sumIhSubstituteDays').value),
        unpaidDays: num(wrap.querySelector('#sumIhUnpaidDays').value),
        absentDays: num(wrap.querySelector('#sumIhAbsentDays').value)
      };
    };
    const load = async () => {
      const ym = String((ymEl && ymEl.value != null) ? ymEl.value : '').trim();
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      const y = parseInt(ym.slice(0, 4), 10);
      const m = parseInt(ym.slice(5, 7), 10);
      status('読込中...');
      const r = await fetchJSONAuth(`/api/attendance/month/summary?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(String(u.id))}`);
      setAll((r && r.all) ? r.all : {});
      setIh((r && r.inhouse) ? r.inhouse : {});
      status('読込完了');
    };
    const save = async () => {
      const ym = String((ymEl && ymEl.value != null) ? ymEl.value : '').trim();
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      const y = parseInt(ym.slice(0, 4), 10);
      const m = parseInt(ym.slice(5, 7), 10);
      const all = getAll();
      const inhouse = getIh();
      if (!all || !inhouse) { status('時間はH:MMで入力してください'); return; }
      status('保存中...');
      await fetchJSONAuth(`/api/attendance/month/summary?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(String(u.id))}`, {
        method: 'PUT',
        body: JSON.stringify({ year: y, month: m, userId: u.id, all, inhouse })
      });
      status('保存しました');
    };
    const btnSumLoad = wrap.querySelector('#btnSumLoad');
    if (btnSumLoad) btnSumLoad.addEventListener('click', () => { load().catch(e => status(String((e && e.message) ? e.message : '読込失敗'))); });
    const btnSumSave = wrap.querySelector('#btnSumSave');
    if (btnSumSave) btnSumSave.addEventListener('click', () => { save().catch(e => status(String((e && e.message) ? e.message : '保存失敗'))); });
    load().catch(() => {});

    try {
      const saShift = wrap.querySelector('#saShift');
      const saStart = wrap.querySelector('#saStart');
      const saEnd = wrap.querySelector('#saEnd');
      const saTable = wrap.querySelector('#saTable');
      const saStatus = wrap.querySelector('#saStatus');
      const setSaStatus = (msg) => { if (saStatus) saStatus.textContent = msg || ''; };
      let defs = [];
      try { defs = await fetchJSONAuth('/api/attendance/shifts/definitions'); } catch { defs = []; }
      const opt = (defs || []).map(d => `<option value="${d.id}">${d.name} ${d.start_time}-${d.end_time}</option>`).join('');
      if (saShift) saShift.innerHTML = `<option value="">シフト</option>${opt}`;
      if (saStart && !saStart.value) {
        const ym = String((ymEl && ymEl.value != null) ? ymEl.value : '').trim();
        saStart.value = (/^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : '');
      }
      const fmtHm2 = (min) => {
        const m = Math.max(0, Number(min || 0));
        const h = Math.floor(m / 60);
        const r = Math.floor(m % 60);
        return `${h}:${String(r).padStart(2, '0')}`;
      };
      const renderSa = (items) => {
        const rows = Array.isArray(items) ? items : [];
        if (!saTable) return;
        if (!rows.length) { saTable.innerHTML = ''; return; }
        const table = document.createElement('table');
        table.className = 'excel-table';
        table.style.margin = '0';
        table.innerHTML = `
          <thead><tr>
            <th style="width:50px;white-space:nowrap;">No</th>
            <th style="min-width:140px;white-space:nowrap;">シフト</th>
            <th style="width:90px;white-space:nowrap;">開始時刻</th>
            <th style="width:90px;white-space:nowrap;">終了時刻</th>
            <th style="width:90px;white-space:nowrap;">休憩時間</th>
            <th style="width:130px;white-space:nowrap;">所定労働時間</th>
            <th style="width:120px;white-space:nowrap;">適用開始日</th>
            <th style="width:120px;white-space:nowrap;">適用終了日</th>
            <th style="width:90px;white-space:nowrap;">操作</th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              const s = (r && r.shift) ? r.shift : null;
              const name = s ? (s.name || '') : ((r && r.shiftName) ? r.shiftName : '');
              const st = s ? (s.start_time || '—') : '—';
              const et = s ? (s.end_time || '—') : '—';
              const br = s ? fmtHm2(s.break_minutes || 0) : '—';
              const std = s ? fmtHm2(s.standard_minutes || 0) : '—';
              const sd = (r && r.start_date) ? r.start_date : '—';
              const ed = (r && r.end_date) ? r.end_date : '—';
              return `<tr>
                <td>${i + 1}</td>
                <td>${name || '—'}</td>
                <td>${st}</td>
                <td>${et}</td>
                <td>${br}</td>
                <td>${std}</td>
                <td>${sd}</td>
                <td>${ed}</td>
                <td><button type="button" class="btn" data-sa-del="${r.id}">削除</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        `;
        saTable.innerHTML = '';
        saTable.appendChild(table);
        saTable.querySelectorAll('button[data-sa-del]').forEach((b) => {
          b.addEventListener('click', async () => {
            const id = b.getAttribute('data-sa-del');
            if (!id) return;
            if (!confirm('削除します。よろしいですか？')) return;
            setSaStatus('削除中...');
            try {
              await fetchJSONAuth(`/api/attendance/shifts/assignments/${encodeURIComponent(String(id))}?userId=${encodeURIComponent(String(u.id))}`, { method: 'DELETE' });
              await loadSa();
              setSaStatus('削除しました');
            } catch (e) {
              setSaStatus(String((e && e.message) ? e.message : '削除失敗'));
            }
          });
        });
      };
      const loadSa = async () => {
        setSaStatus('読込中...');
        try {
          const r = await fetchJSONAuth(`/api/attendance/shifts/assignments?userId=${encodeURIComponent(String(u.id))}&from=1900-01-01&to=2999-12-31`);
          renderSa((r && Array.isArray(r.items)) ? r.items : []);
          setSaStatus('');
        } catch (e) {
          renderSa([]);
          setSaStatus(String((e && e.message) ? e.message : '読込失敗'));
        }
      };
      const btnSaReload = wrap.querySelector('#btnSaReload');
      if (btnSaReload) btnSaReload.addEventListener('click', () => { loadSa().catch(e => setSaStatus(String((e && e.message) ? e.message : '読込失敗'))); });
      const btnSaAdd = wrap.querySelector('#btnSaAdd');
      if (btnSaAdd) btnSaAdd.addEventListener('click', async () => {
        const shiftId = saShift && saShift.value != null ? saShift.value : '';
        const startDate = String(saStart && saStart.value != null ? saStart.value : '').trim();
        const endDate = String(saEnd && saEnd.value != null ? saEnd.value : '').trim();
        if (!shiftId || !startDate) { setSaStatus('shift/start を入力'); return; }
        setSaStatus('保存中...');
        try {
          await fetchJSONAuth(`/api/attendance/shifts/assign`, {
            method: 'POST',
            body: JSON.stringify({ userId: u.id, shiftId, startDate, endDate: endDate || null })
          });
          await loadSa();
          setSaStatus('保存しました');
        } catch (e) {
          setSaStatus(String((e && e.message) ? e.message : '保存失敗'));
        }
      });
      loadSa().catch(() => {});
    } catch {}

    try {
      const wdStatus = wrap.querySelector('#wdStatus');
      const setWdStatus = (msg) => { if (wdStatus) wdStatus.textContent = msg || ''; };
      const wdTable = wrap.querySelector('#wdTable');
      const val = (id) => {
        const el = wrap.querySelector(id);
        return String((el && el.value != null) ? el.value : '').trim();
      };
      const normDate = (s) => {
        const t = String(s || '').trim();
        if (!t) return '';
        const m = t.match(/^(\d{4})[\/-](\d{2})[\/-](\d{2})/);
        if (m) return `${m[1]}-${m[2]}-${m[3]}`;
        return t;
      };
      const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
      const clearWdForm = () => {
        for (const id of ['#wdStart','#wdEnd','#wdCompany','#wdAddr','#wdWork','#wdRole','#wdResp']) {
          const el = wrap.querySelector(id);
          if (el) el.value = '';
        }
      };
      const renderWd = (items) => {
        const rows = Array.isArray(items) ? items : [];
        if (!wdTable) return;
        if (!rows.length) { wdTable.innerHTML = ''; return; }
        const table = document.createElement('table');
        table.className = 'excel-table';
        table.style.margin = '0';
        table.innerHTML = `
          <thead><tr>
            <th style="width:50px;white-space:nowrap;">No</th>
            <th style="min-width:160px;white-space:nowrap;">企業名</th>
            <th style="width:120px;white-space:nowrap;">適用開始日</th>
            <th style="width:120px;white-space:nowrap;">適用終了日</th>
            <th style="min-width:220px;white-space:nowrap;">就業先住所</th>
            <th style="min-width:180px;white-space:nowrap;">業務内容</th>
            <th style="width:120px;white-space:nowrap;">役職</th>
            <th style="width:140px;white-space:nowrap;">責任の程度</th>
            <th style="width:130px;white-space:nowrap;">操作</th>
          </tr></thead>
          <tbody>
            ${rows.map((r, i) => {
              return `<tr>
                <td>${i + 1}</td>
                <td>${r.companyName || ''}</td>
                <td>${r.startDate || '—'}</td>
                <td>${r.endDate || '—'}</td>
                <td>${r.workPlaceAddress || ''}</td>
                <td>${r.workContent || ''}</td>
                <td>${r.roleTitle || ''}</td>
                <td>${r.responsibilityLevel || ''}</td>
                <td>
                  <button type="button" class="btn" data-wd-edit="${r.id}">編集</button>
                  <button type="button" class="btn" data-wd-del="${r.id}">削除</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        `;
        wdTable.innerHTML = '';
        wdTable.appendChild(table);
        table.querySelectorAll('button[data-wd-del]').forEach((b) => {
          b.addEventListener('click', async () => {
            const id = b.getAttribute('data-wd-del');
            if (!id) return;
            if (!confirm('削除します。よろしいですか？')) return;
            setWdStatus('削除中...');
            try {
              await fetchJSONAuth(`/api/attendance/work-details/${encodeURIComponent(String(id))}`, { method: 'DELETE', body: JSON.stringify({ userId: u.id }) });
              await loadWd();
              setWdStatus('削除しました');
            } catch (e) {
              setWdStatus(String((e && e.message) ? e.message : '削除失敗'));
            }
          });
        });
        table.querySelectorAll('button[data-wd-edit]').forEach((b) => {
          b.addEventListener('click', async () => {
            const id = b.getAttribute('data-wd-edit');
            const cur = rows.find(x => String(x.id) === String(id));
            if (!cur) return;
            wrap.querySelector('#wdStart').value = cur.startDate || '';
            wrap.querySelector('#wdEnd').value = cur.endDate || '';
            wrap.querySelector('#wdCompany').value = cur.companyName || '';
            wrap.querySelector('#wdAddr').value = cur.workPlaceAddress || '';
            wrap.querySelector('#wdWork').value = cur.workContent || '';
            wrap.querySelector('#wdRole').value = cur.roleTitle || '';
            wrap.querySelector('#wdResp').value = cur.responsibilityLevel || '';
            wrap.querySelector('#btnWdAdd').textContent = '更新';
            wrap.querySelector('#btnWdAdd').dataset.editing = String(id);
          });
        });
      };
      const loadWd = async () => {
        setWdStatus('読込中...');
        try {
          const r = await fetchJSONAuth(`/api/attendance/work-details?userId=${encodeURIComponent(String(u.id))}&from=1900-01-01&to=2999-12-31`);
          renderWd((r && Array.isArray(r.items)) ? r.items : []);
          setWdStatus('');
        } catch (e) {
          renderWd([]);
          setWdStatus(String((e && e.message) ? e.message : '読込失敗'));
        }
      };
      const btnWdReload = wrap.querySelector('#btnWdReload');
      if (btnWdReload) btnWdReload.addEventListener('click', () => { loadWd().catch(e => setWdStatus(String((e && e.message) ? e.message : '読込失敗'))); });
      const btnWdAdd = wrap.querySelector('#btnWdAdd');
      if (btnWdAdd) btnWdAdd.addEventListener('click', async () => {
        const editing = btnWdAdd.dataset.editing || '';
        const payload = {
          userId: u.id,
          startDate: normDate(val('#wdStart')),
          endDate: normDate(val('#wdEnd')) || null,
          companyName: val('#wdCompany'),
          workPlaceAddress: val('#wdAddr'),
          workContent: val('#wdWork'),
          roleTitle: val('#wdRole'),
          responsibilityLevel: val('#wdResp')
        };
        if (!payload.startDate) { setWdStatus('開始日を入力'); return; }
        if (!isISODate(payload.startDate) || (payload.endDate && !isISODate(payload.endDate))) {
          setWdStatus('日付はYYYY-MM-DD形式で入力してください');
          return;
        }
        setWdStatus('保存中...');
        try {
          if (editing) {
            await fetchJSONAuth(`/api/attendance/work-details/${encodeURIComponent(String(editing))}`, { method: 'PUT', body: JSON.stringify(payload) });
            btnWdAdd.textContent = '追加';
            delete btnWdAdd.dataset.editing;
          } else {
            await fetchJSONAuth('/api/attendance/work-details', { method: 'POST', body: JSON.stringify(payload) });
          }
          clearWdForm();
          await loadWd();
          setWdStatus('保存しました');
        } catch (e) {
          const m = String((e && e.message) ? e.message : '保存失敗');
          if (m === 'Invalid payload') { setWdStatus('日付はYYYY-MM-DD形式で入力してください'); return; }
          setWdStatus(m);
        }
      });
      loadWd().catch(() => {});
    } catch {}
    hideNavSpinner();
    return;
  }

  content.innerHTML = ``;

  let users = [];
  let depts = [];
  let errMsgs = [];
  const isForbiddenErr = (e) => /forbidden|access denied|insufficient permission/i.test(String((e && e.message) || ''));
  const isCountedUser = (u) => {
    const role = String((u && u.role) ? u.role : '').toLowerCase();
    const st = String((u && u.employment_status) ? u.employment_status : 'active').toLowerCase();
    if (st === 'inactive' || st === 'retired') return false;
    if (role2 === 'manager') return role === 'employee';
    return role === 'employee' || role === 'manager' || role === 'admin';
  };
  try {
    if (role2 === 'manager') {
      const res = await fetchJSONAuth('/api/manager/users');
      users = Array.isArray(res) ? res : (res && Array.isArray(res.rows) ? res.rows : []);
    } else {
      users = await listEmployees();
    }
  } catch (e1) {
    if (!isForbiddenErr(e1)) errMsgs.push(`一覧: ${(e1 && e1.message) ? e1.message : 'unknown'}`);
    if (role2 !== 'manager') {
      try {
        const res2 = await fetchJSONAuth('/api/manager/users');
        users = Array.isArray(res2) ? res2 : (res2 && Array.isArray(res2.rows) ? res2.rows : []);
      } catch (eMid) {
        if (!isForbiddenErr(eMid)) errMsgs.push(`一覧(管理者予備): ${(eMid && eMid.message) ? eMid.message : 'unknown'}`);
        try { users = await listUsers(); } catch (e2) { if (!isForbiddenErr(e2)) errMsgs.push(`一覧(予備): ${(e2 && e2.message) ? e2.message : 'unknown'}`); users = []; }
      }
    } else {
      try { users = await listEmployees(); } catch (e2) { if (!isForbiddenErr(e2)) errMsgs.push(`一覧(予備): ${(e2 && e2.message) ? e2.message : 'unknown'}`); users = []; }
    }
  }
  if (seq !== employeesRenderSeq) return;
  try { users = (users || []).filter(isCountedUser); } catch { users = []; }
  
  try {
    depts = role2 === 'manager' ? await fetchJSONAuth('/api/manager/departments') : await listDepartments();
  } catch (e3) {
    if (!isForbiddenErr(e3)) errMsgs.push(`部署: ${(e3 && e3.message) ? e3.message : 'unknown'}`);
    try { depts = role2 === 'manager' ? await listDepartments() : await fetchJSONAuth('/api/manager/departments'); } catch (e4) { if (!isForbiddenErr(e4)) errMsgs.push(`部署(予備): ${(e4 && e4.message) ? e4.message : 'unknown'}`); depts = []; }
  }
  if (seq !== employeesRenderSeq) return;
  if (role2 === 'manager' && (!users || users.length === 0)) {
    try {
      const note = document.createElement('div');
      note.style.color = '#0b2c66';
      note.style.margin = '8px 0';
      note.style.fontWeight = '700';
      note.textContent = '従業員が見つかりません。従業員が未登録か、表示条件に一致しません。';
      content.appendChild(note);
    } catch {}
  }
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
          <tr><td>基本給</td><td><input id="empBaseSalary" type="number" step="0.01" style="width:180px" value="${u.base_salary == null ? '' : u.base_salary}" placeholder="円"></td></tr>
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
      <table class="excel-table" style="margin-bottom:12px;">
        <thead><tr><th colspan="2">月次サマリ（管理者入力）</th></tr></thead>
        <tbody>
          <tr>
            <td style="width:180px;">対象年月</td>
            <td>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input id="msMonth" type="month" style="width:180px">
                <button type="button" class="btn" id="btnMsLoad">読込</button>
                <button type="button" class="btn-primary" id="btnMsSave">保存</button>
                <span id="msStatus" style="margin-left:4px;color:#334155;font-weight:800;"></span>
              </div>
            </td>
          </tr>
          <tr>
            <td>全体</td>
            <td>
              <div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;">
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">所定日数</span><input id="msAllPlannedDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出勤日数</span><input id="msAllAttendDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代出休出</span><input id="msAllHolidayWorkDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">待機日数</span><input id="msAllStandbyDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総労働時間</span><input id="msAllTotalWork" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">深夜時間</span><input id="msAllNight" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総残業時間</span><input id="msAllOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">法定外時間</span><input id="msAllLegalOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">有休日数</span><input id="msAllPaidDays" type="number" step="0.1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代休日数</span><input id="msAllSubstituteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">無給休暇</span><input id="msAllUnpaidDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">欠勤日数</span><input id="msAllAbsentDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">控除時間</span><input id="msAllDeduction" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出社日数</span><input id="msAllOnsiteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">在宅日数</span><input id="msAllRemoteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">現場・出張</span><input id="msAllSatelliteDays" type="number" step="1" style="width:90px"></label>
              </div>
            </td>
          </tr>
          <tr>
            <td>社内勤務</td>
            <td>
              <div style="display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:8px;">
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">所定日数</span><input id="msIhPlannedDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">出勤日数</span><input id="msIhAttendDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代出休出</span><input id="msIhHolidayWorkDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">待機日数</span><input id="msIhStandbyDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総労働時間</span><input id="msIhTotalWork" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">深夜時間</span><input id="msIhNight" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">総残業時間</span><input id="msIhOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">法定外時間</span><input id="msIhLegalOvertime" placeholder="0:00" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">有休日数</span><input id="msIhPaidDays" type="number" step="0.1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">代休日数</span><input id="msIhSubstituteDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">無給休暇</span><input id="msIhUnpaidDays" type="number" step="1" style="width:90px"></label>
                <label style="display:flex;gap:6px;align-items:center;"><span style="min-width:86px;">欠勤日数</span><input id="msIhAbsentDays" type="number" step="1" style="width:90px"></label>
              </div>
            </td>
          </tr>
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
      const backHref = `/admin/employees${qsKeep ? '?' + qsKeep : ''}#list`;
      const backA = formEdit.querySelector('#editBack');
      const cancelA = formEdit.querySelector('#btnCancelEdit');
      if (backA) backA.setAttribute('href', backHref);
      if (cancelA) cancelA.setAttribute('href', backHref);
    } catch {}
    try {
      const ymEl = formEdit.querySelector('#msMonth');
      const btnLoad = formEdit.querySelector('#btnMsLoad');
      const btnSave = formEdit.querySelector('#btnMsSave');
      const stEl = formEdit.querySelector('#msStatus');
      const jstYM = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
      if (ymEl && !ymEl.value) ymEl.value = jstYM();

      const hmToMin = (s) => {
        const t = String(s || '').trim();
        if (!t) return 0;
        const m = t.match(/^(\d+):(\d{2})$/);
        if (!m) return 0;
        const h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        return Math.max(0, (h * 60) + mm);
      };
      const minToHm = (min) => {
        const m = Math.max(0, Number(min || 0));
        const h = Math.floor(m / 60);
        const r = Math.floor(m % 60);
        return `${h}:${String(r).padStart(2, '0')}`;
      };
      const n = (v) => {
        const x = Number(v);
        return Number.isFinite(x) ? x : 0;
      };
      const setAll = (obj) => {
        if (!obj || typeof obj !== 'object') obj = {};
        formEdit.querySelector('#msAllPlannedDays').value = String(obj.plannedDays == null ? '' : obj.plannedDays);
        formEdit.querySelector('#msAllAttendDays').value = String(obj.attendDays == null ? '' : obj.attendDays);
        formEdit.querySelector('#msAllHolidayWorkDays').value = String(obj.holidayWorkDays == null ? '' : obj.holidayWorkDays);
        formEdit.querySelector('#msAllStandbyDays').value = String(obj.standbyDays == null ? '' : obj.standbyDays);
        formEdit.querySelector('#msAllTotalWork').value = minToHm(obj.totalWorkMinutes == null ? 0 : obj.totalWorkMinutes);
        formEdit.querySelector('#msAllNight').value = minToHm(obj.nightMinutes == null ? 0 : obj.nightMinutes);
        formEdit.querySelector('#msAllOvertime').value = minToHm(obj.overtimeMinutes == null ? 0 : obj.overtimeMinutes);
        formEdit.querySelector('#msAllLegalOvertime').value = minToHm(obj.legalOvertimeMinutes == null ? 0 : obj.legalOvertimeMinutes);
        formEdit.querySelector('#msAllPaidDays').value = String(obj.paidDays == null ? '' : obj.paidDays);
        formEdit.querySelector('#msAllSubstituteDays').value = String(obj.substituteDays == null ? '' : obj.substituteDays);
        formEdit.querySelector('#msAllUnpaidDays').value = String(obj.unpaidDays == null ? '' : obj.unpaidDays);
        formEdit.querySelector('#msAllAbsentDays').value = String(obj.absentDays == null ? '' : obj.absentDays);
        formEdit.querySelector('#msAllDeduction').value = minToHm(obj.deductionMinutes == null ? 0 : obj.deductionMinutes);
        formEdit.querySelector('#msAllOnsiteDays').value = String(obj.onsiteDays == null ? '' : obj.onsiteDays);
        formEdit.querySelector('#msAllRemoteDays').value = String(obj.remoteDays == null ? '' : obj.remoteDays);
        formEdit.querySelector('#msAllSatelliteDays').value = String(obj.satelliteDays == null ? '' : obj.satelliteDays);
      };
      const setIh = (obj) => {
        if (!obj || typeof obj !== 'object') obj = {};
        formEdit.querySelector('#msIhPlannedDays').value = String(obj.plannedDays == null ? '' : obj.plannedDays);
        formEdit.querySelector('#msIhAttendDays').value = String(obj.attendDays == null ? '' : obj.attendDays);
        formEdit.querySelector('#msIhHolidayWorkDays').value = String(obj.holidayWorkDays == null ? '' : obj.holidayWorkDays);
        formEdit.querySelector('#msIhStandbyDays').value = String(obj.standbyDays == null ? '' : obj.standbyDays);
        formEdit.querySelector('#msIhTotalWork').value = minToHm(obj.totalWorkMinutes == null ? 0 : obj.totalWorkMinutes);
        formEdit.querySelector('#msIhNight').value = minToHm(obj.nightMinutes == null ? 0 : obj.nightMinutes);
        formEdit.querySelector('#msIhOvertime').value = minToHm(obj.overtimeMinutes == null ? 0 : obj.overtimeMinutes);
        formEdit.querySelector('#msIhLegalOvertime').value = minToHm(obj.legalOvertimeMinutes == null ? 0 : obj.legalOvertimeMinutes);
        formEdit.querySelector('#msIhPaidDays').value = String(obj.paidDays == null ? '' : obj.paidDays);
        formEdit.querySelector('#msIhSubstituteDays').value = String(obj.substituteDays == null ? '' : obj.substituteDays);
        formEdit.querySelector('#msIhUnpaidDays').value = String(obj.unpaidDays == null ? '' : obj.unpaidDays);
        formEdit.querySelector('#msIhAbsentDays').value = String(obj.absentDays == null ? '' : obj.absentDays);
      };
      const getAll = () => ({
        plannedDays: n(formEdit.querySelector('#msAllPlannedDays').value),
        attendDays: n(formEdit.querySelector('#msAllAttendDays').value),
        holidayWorkDays: n(formEdit.querySelector('#msAllHolidayWorkDays').value),
        standbyDays: n(formEdit.querySelector('#msAllStandbyDays').value),
        totalWorkMinutes: hmToMin(formEdit.querySelector('#msAllTotalWork').value),
        nightMinutes: hmToMin(formEdit.querySelector('#msAllNight').value),
        overtimeMinutes: hmToMin(formEdit.querySelector('#msAllOvertime').value),
        legalOvertimeMinutes: hmToMin(formEdit.querySelector('#msAllLegalOvertime').value),
        paidDays: n(formEdit.querySelector('#msAllPaidDays').value),
        substituteDays: n(formEdit.querySelector('#msAllSubstituteDays').value),
        unpaidDays: n(formEdit.querySelector('#msAllUnpaidDays').value),
        absentDays: n(formEdit.querySelector('#msAllAbsentDays').value),
        deductionMinutes: hmToMin(formEdit.querySelector('#msAllDeduction').value),
        onsiteDays: n(formEdit.querySelector('#msAllOnsiteDays').value),
        remoteDays: n(formEdit.querySelector('#msAllRemoteDays').value),
        satelliteDays: n(formEdit.querySelector('#msAllSatelliteDays').value)
      });
      const getIh = () => ({
        plannedDays: n(formEdit.querySelector('#msIhPlannedDays').value),
        attendDays: n(formEdit.querySelector('#msIhAttendDays').value),
        holidayWorkDays: n(formEdit.querySelector('#msIhHolidayWorkDays').value),
        standbyDays: n(formEdit.querySelector('#msIhStandbyDays').value),
        totalWorkMinutes: hmToMin(formEdit.querySelector('#msIhTotalWork').value),
        nightMinutes: hmToMin(formEdit.querySelector('#msIhNight').value),
        overtimeMinutes: hmToMin(formEdit.querySelector('#msIhOvertime').value),
        legalOvertimeMinutes: hmToMin(formEdit.querySelector('#msIhLegalOvertime').value),
        paidDays: n(formEdit.querySelector('#msIhPaidDays').value),
        substituteDays: n(formEdit.querySelector('#msIhSubstituteDays').value),
        unpaidDays: n(formEdit.querySelector('#msIhUnpaidDays').value),
        absentDays: n(formEdit.querySelector('#msIhAbsentDays').value)
      });

      const load = async () => {
        const ym = String((ymEl && ymEl.value != null) ? ymEl.value : '').trim();
        if (!/^\d{4}-\d{2}$/.test(ym)) return;
        const y = parseInt(ym.slice(0, 4), 10);
        const m = parseInt(ym.slice(5, 7), 10);
        if (stEl) stEl.textContent = '読込中...';
        const r = await fetchJSONAuth(`/api/attendance/month/summary?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(String(u.id))}`);
        setAll((r && r.all) ? r.all : {});
        setIh((r && r.inhouse) ? r.inhouse : {});
        if (stEl) stEl.textContent = '読込完了';
      };
      const save = async () => {
        const ym = String((ymEl && ymEl.value != null) ? ymEl.value : '').trim();
        if (!/^\d{4}-\d{2}$/.test(ym)) return;
        const y = parseInt(ym.slice(0, 4), 10);
        const m = parseInt(ym.slice(5, 7), 10);
        if (stEl) stEl.textContent = '保存中...';
        await fetchJSONAuth(`/api/attendance/month/summary?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(String(u.id))}`, {
          method: 'PUT',
          body: JSON.stringify({ year: y, month: m, userId: u.id, all: getAll(), inhouse: getIh() })
        });
        if (stEl) stEl.textContent = '保存しました';
      };

      if (btnLoad) btnLoad.addEventListener('click', () => { load().catch(e => { if (stEl) stEl.textContent = String((e && e.message) ? e.message : '読込失敗'); }); });
      if (btnSave) btnSave.addEventListener('click', () => { save().catch(e => { if (stEl) stEl.textContent = String((e && e.message) ? e.message : '保存失敗'); }); });
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
        history.replaceState(null, '', `/admin/employees${qsKeep ? '?' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees(profile);
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
          await res.json();
          if (statusEl) statusEl.textContent = 'アップロード完了';
        } catch {}
      });
    }
    formEdit.querySelector('#editBack').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        history.replaceState(null, '', `/admin/employees${qsKeep ? '?' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees(profile);
    });
    formEdit.querySelector('#btnCancelEdit').addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const listKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code','showAll'];
        const keep = new URLSearchParams();
        for (const k of listKeys) { const v = params.get(k); if (v) keep.set(k, v); }
        const qsKeep = keep.toString();
        history.replaceState(null, '', `/admin/employees${qsKeep ? '?' + qsKeep : ''}#list`);
      } catch {}
      await renderEmployees(profile);
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
        try { const el = document.querySelector('#editKey'); if (el && el.focus) el.focus(); } catch {}
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
            fetchJSONAuth(role2 === 'manager' ? '/api/manager/users' : '/api/admin/employees'),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
          ]);
          const f = list.find(u => {
            const code = String(u.employee_code || '').toUpperCase();
            const gen = ('EMP' + String(u.id).padStart(3,'0')).toUpperCase();
            return code === key.toUpperCase() || gen === key.toUpperCase();
          });
          if (f) id = f.id;
        } catch (err) {
          alert(String((err && err.message) ? err.message : '読み込みエラー'));
        } finally {
          hideNavSpinner();
        }
      }
      if (!id) return alert('対象が見つかりません');
      window.location.href = `/admin/employees?edit=${id}`;
    });
    content.appendChild(prompt);
    try { const el = document.querySelector('#editKey'); if (el && el.focus) el.focus(); } catch {}
    hideNavSpinner();
    return;
  }

  if (mode === 'add') {
    const form = document.createElement('form');
    form.id = 'add';
    let managers = [];
    if (role2 !== 'manager') {
      try { managers = await listUsers(); } catch { managers = []; }
    }
    if (seq !== employeesRenderSeq) return;
    const managerOptions = (role2 !== 'manager' ? managers.filter(m => String(m.role) === 'manager') : []).map(m => `<option value="${m.id}">${m.username || m.email}</option>`).join('');
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
        setTimeout(() => { window.location.href = '/admin/employees#list'; }, 350);
      } catch (err) {
        const m = String((err && err.message) ? err.message : '');
        const low = m.toLowerCase();
        if (msgEl) {
          msgEl.style.color = '#b00020';
          if (m.includes('社員番号') || low.includes('uniq_employee_code') || low.includes('duplicate entry')) {
            msgEl.textContent = '社員番号が既に存在します。別の番号を入力してください。';
            try { const el = document.querySelector('#empCode'); if (el && el.focus) el.focus(); } catch {}
          } else if (m.includes('Email') || low.includes('email')) {
            msgEl.textContent = m;
            try { const el = document.querySelector('#empEmail'); if (el && el.focus) el.focus(); } catch {}
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
        <div class="fi-label">社員番号</div>
        <input id="empSearchCode" class="fi-code" placeholder="EMP番号/コード">
      </div>
      <div class="fi">
        <div class="fi-label">名前</div>
        <input id="empSearchName" class="fi-name" placeholder="名前">
      </div>
      <div class="fi fi-action">
        <button type="button" id="btnEmpSearch" class="btn">検索</button>
      </div>
    `;
  }
  content.appendChild(filterWrap);
  if (mode === 'delete') {
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
          .emp-del-filter select { height: 36px; border-radius: 10px; background: #fcfdff; border: 1.5px solid #bcd0e6; padding: 6px 12px; box-sizing: border-box; display: block; }
          .emp-del-filter input::placeholder { color: #94a3b8; }
          .emp-del-filter input:focus,
          .emp-del-filter select:focus { border-color: #2b67b3; box-shadow: 0 0 0 3px rgba(43,103,179,.12); outline: none; }
          .emp-del-filter td.actions { text-align: center; }
          .emp-del-filter .date-range { display: flex; align-items: center; gap: 6px; }
          .emp-del-filter .date-range input { flex: 1 1 0; display: inline-block; min-width: 160px; }
          .emp-del-filter .date-range .tilde { width: 12px; text-align: center; color: #64748b; }
          .emp-del-filter .btn-search { height: 36px; border-radius: 10px; padding: 0 16px; background: #2b6cb0; border: 1px solid #1e4e8c; color: #fff; transition: background-color .15s ease, border-color .15s ease; }
          .emp-del-filter .btn-search:hover { background: #255ea7; border-color: #1e4e8c; }
          .emp-del-filter .btn-search:active { background: #1f4e8a; border-color: #163b6e; }
          #empListBox { display:block; width:100%; margin-top:0; overflow: auto; flex: 1 1 auto; min-height: 0; }
          .emp-del-list thead { position: sticky; top: 0; z-index: 199; }
          .emp-del-list thead th { position: sticky; top: 0; z-index: 200; }
          .emp-del-toolbar { display: flex; justify-content: flex-end; margin: 8px 0 0; position: static; top: auto; z-index: auto; background: transparent; }
          .emp-bulk-disable { height: 36px; border-radius: 10px; padding: 0 16px; background: linear-gradient(180deg, #2b6cb0 0%, #255ea7 100%); border: 1px solid #1e4e8c; color: #fff; font-weight: 600; letter-spacing: .03em; box-shadow: 0 1px 2px rgba(16,24,40,.06); transition: background-color .15s ease, border-color .15s ease, transform .02s ease; }
          .emp-bulk-disable:hover { background: linear-gradient(180deg, #336fb3 0%, #2b62a9 100%); border-color: #1e4e8c; }
          .emp-bulk-disable:active { transform: translateY(1px); }
          .emp-bulk-disable:focus { outline: 3px solid rgba(43,103,179,.20); outline-offset: 2px; }
        `;
        document.head.appendChild(style);
      }
    } catch {}
  }

  const state = { showAll: false, searchVisible: false, code: '', q: '', sortKey: 'id', sortDir: 'desc', page: 1, pageSize: 10 };
  try {
    state.showAll = ((params.get('showAll') || '') === '1' || (params.get('showAll') || '').toLowerCase() === 'true');
    state.searchVisible = ((params.get('search') || '') === '1' || (params.get('search') || '').toLowerCase() === 'true');
    state.code = (params.get('code') || '').trim().toLowerCase();
    state.q = (params.get('q') || '').trim().toLowerCase();
    state.sortKey = params.get('sortKey') || state.sortKey;
    state.sortDir = params.get('sortDir') || state.sortDir;
    state.page = parseInt(params.get('page') || String(state.page), 10) || state.page;
  } catch {}
  const updateUrl = (hashValue) => {
    try {
      const p = new URLSearchParams();
      if (state.code) p.set('code', state.code);
      if (mode === 'delete' && state.showAll) p.set('showAll', '1');
      if (mode === 'delete' && state.searchVisible) p.set('search', '1');
      if (state.q) p.set('q', state.q);
      if (state.sortKey && state.sortKey !== 'id') p.set('sortKey', state.sortKey);
      if (state.sortDir && state.sortDir !== 'desc') p.set('sortDir', state.sortDir);
      if (state.page && state.page > 1) p.set('page', String(state.page));
      const qs = p.toString();
      history.replaceState(null, '', `/admin/employees${qs ? '?' + qs : ''}${hashValue || ''}`);
    } catch {}
  };

  const searchHint = document.createElement('div');
  searchHint.id = 'empSearchHint';
  searchHint.style.display = 'none';
  searchHint.style.color = '#b00020';
  searchHint.style.fontWeight = '700';
  searchHint.style.marginTop = '6px';
  searchHint.textContent = '検索条件を入力してください';
  try {
    const tbl = filterWrap.querySelector('table');
    const act = filterWrap.querySelector('.fi-action');
    if (tbl && mode === 'delete') tbl.after(searchHint);
    else if (act) act.after(searchHint);
    else filterWrap.appendChild(searchHint);
  } catch {}

  const table = document.createElement('table');
  table.id = 'list';
  table.className = 'excel-table' + (mode === 'delete' ? ' emp-del-list' : '');
  table.style.tableLayout = 'auto';
  table.style.width = '100%';
  table.style.minWidth = mode === 'delete' ? '100%' : '100%';
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
  `;

  if (mode === 'delete') {
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
    const hdr = document.createElement('div');
    hdr.className = 'form-title';
    hdr.textContent = '【社員一覧】';
    content.appendChild(hdr);
    content.appendChild(table);
    content.appendChild(pager);
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
    const key = state.sortKey;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    arr.sort((a,b) => {
      const va = key === 'department' ? deptName(a.departmentId) : (key === 'hire_date' ? (a.hire_date||'') : (a[key]||''));
      const vb = key === 'department' ? deptName(b.departmentId) : (key === 'hire_date' ? (b.hire_date||'') : (b[key]||''));
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
      const detailBtn = `<a class="emp-action" href="/admin/employees?detail=${u.id}">👁 詳細</a>`;
      const editBtn = `<a class="emp-action" href="/admin/employees?edit=${u.id}">✏️ 編集</a>`;
      const canManageThis = role2 === 'admin';
      const disableBtn = canManageThis ? `<button type="button" class="emp-action danger" data-delete="${u.id}">🚫 無効化</button>` : ``;
      const hardDeleteBtn = canManageThis ? `<button type="button" class="emp-action danger" data-hard-delete="${u.id}">🗑️ 削除</button>` : ``;
      const ops = mode === 'delete' ? `${detailBtn}${disableBtn}${hardDeleteBtn}` : `${detailBtn}${editBtn}${disableBtn}${hardDeleteBtn}`;
      tr.innerHTML = `
        ${mode==='delete' ? `<td class="sel-col"><input type="checkbox" class="empSel" value="${u.id}"></td>` : ''}
        <td class="col-code"><span class="text-pill neutral">${u.employee_code || fmtEmpNo(u.id)}</span></td>
        <td class="col-name"><span class="text-pill"><a href="/admin/employees?detail=${u.id}">${u.username||''}</a></span></td>
        <td class="col-email"${emailVal ? ` title="${escAttr(emailVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(emailVal)}</span></td>
        <td class="col-dept"${deptVal ? ` title="${escAttr(deptVal)}"` : ''}><span class="text-pill neutral">${dispOrUnreg(deptVal)}</span></td>
        <td>${rolePill(u.role)}</td>
        <td>${typePill(u.employment_type)}</td>
        <td>${statusPill(u.employment_status)}</td>
        <td>${fmtDate(u.hire_date)}</td>
        <td><div class="emp-action-group">${ops}</div></td>
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
  if (mode === 'delete') {
    try {
      const listBox = filterWrap.querySelector('#empListBox');
      const formBody = filterWrap.querySelector('.emp-del-filter tbody');
      const tb = filterWrap.querySelector('.emp-del-toolbar');
      const hasList = state.showAll || state.searchVisible;
      if (listBox) listBox.style.display = hasList ? '' : 'none';
      table.style.display = hasList ? '' : 'none';
      pager.style.display = hasList ? '' : 'none';
      if (tb) tb.style.display = hasList ? '' : 'none';
      if (formBody) formBody.style.display = '';

      const tabSearch = filterWrap.querySelector('#tabSearch');
      const tabShowAll = filterWrap.querySelector('#tabShowAll');
      const setActive = () => {
        const has = state.showAll || state.searchVisible;
        if (state.showAll) {
          if (tabSearch) tabSearch.classList.remove('active');
          if (tabShowAll) tabShowAll.classList.add('active');
        } else {
          if (tabSearch) tabSearch.classList.add('active');
          if (tabShowAll) tabShowAll.classList.remove('active');
        }
        if (listBox) listBox.style.display = has ? '' : 'none';
        table.style.display = has ? '' : 'none';
        pager.style.display = has ? '' : 'none';
        if (tb) tb.style.display = has ? '' : 'none';
        if (formBody) formBody.style.display = '';
      };
      setActive();
      if (tabSearch) tabSearch.addEventListener('click', () => {
        state.showAll = false;
        state.searchVisible = false;
        try { searchHint.style.display = 'none'; } catch {}
        setActive();
        updateUrl('#delete');
      });
      if (tabShowAll) tabShowAll.addEventListener('click', () => {
        state.showAll = true;
        state.searchVisible = false;
        state.page = 1;
        try { searchHint.style.display = 'none'; } catch {}
        setActive();
        renderRows();
        updateUrl('#delete');
      });
    } catch {}
  }

  try {
    const codeEl = filterWrap.querySelector('#empSearchCode'); if (codeEl) codeEl.value = (params.get('code') || '');
    const nameEl = filterWrap.querySelector('#empSearchName'); if (nameEl) nameEl.value = (params.get('q') || '');
    if (searchHint) {
      const hasAny0 = !!((params.get('code') || '').trim() || (params.get('q') || '').trim());
      searchHint.style.display = hasAny0 ? 'none' : 'none';
    }
  } catch {}

  filterWrap.querySelector('#btnEmpSearch').addEventListener('click', () => {
    const codeEl2 = filterWrap.querySelector('#empSearchCode');
    const nameEl2 = filterWrap.querySelector('#empSearchName');
    state.code = String((codeEl2 && codeEl2.value != null) ? codeEl2.value : '').trim().toLowerCase();
    state.q = String((nameEl2 && nameEl2.value != null) ? nameEl2.value : '').trim().toLowerCase();
    state.page = 1;
    const hasAny = !!(state.code || state.q);
    if (!hasAny && !(mode === 'delete' && state.showAll)) {
      try { searchHint.style.display = 'block'; } catch {}
      try { const el = filterWrap.querySelector('#empSearchCode'); if (el && el.focus) el.focus(); } catch {}
      if (mode === 'delete') {
        try {
          const listBox = filterWrap.querySelector('#empListBox');
          if (listBox) listBox.style.display = 'none';
          table.style.display = 'none';
          pager.style.display = 'none';
          const tb = filterWrap.querySelector('.emp-del-toolbar');
          if (tb) tb.style.display = 'none';
        } catch {}
      }
      return;
    }
    try { searchHint.style.display = 'none'; } catch {}
    if (mode === 'delete') {
      state.searchVisible = hasAny;
      if (!hasAny && !state.showAll) {
        try {
          const listBox = filterWrap.querySelector('#empListBox');
          if (listBox) listBox.style.display = 'none';
          table.style.display = 'none';
          pager.style.display = 'none';
          const tb = filterWrap.querySelector('.emp-del-toolbar');
          if (tb) tb.style.display = 'none';
        } catch {}
        return;
      }
      try {
        const listBox = filterWrap.querySelector('#empListBox');
        if (listBox) listBox.style.display = '';
        table.style.display = '';
        pager.style.display = '';
        const tb = filterWrap.querySelector('.emp-del-toolbar');
        if (tb) tb.style.display = '';
      } catch {}
    }
    renderRows();
    updateUrl(mode === 'delete' ? '#delete' : '#list');
  });

  const prev = pager.querySelector('#empPrev');
  const next = pager.querySelector('#empNext');
  prev.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderRows();
      updateUrl(mode === 'delete' ? '#delete' : '#list');
    }
  });
  next.addEventListener('click', () => {
    const total = applyFilterSort().length;
    const maxPage = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page < maxPage) {
      state.page += 1;
      renderRows();
      updateUrl(mode === 'delete' ? '#delete' : '#list');
    }
  });

  if (mode === 'delete') {
    table.addEventListener('click', (e) => {
      const t = e && e.target;
      const td = (t && t.closest) ? t.closest('td') : null;
      if (!td) return;
      if (t && t.closest && t.closest('.emp-action-group')) return;
      if (t && t.closest && t.closest('a')) return;
      if (t && t.matches && t.matches('input, button, select, label')) return;
      const tr = td.closest('tr');
      const cb = tr ? tr.querySelector('.empSel') : null;
      if (cb) cb.checked = !cb.checked;
    });

    const bulkHandler = async (e) => {
      if (!(e.target && e.target.id === 'empBulkDisable')) return;
      const ids = Array.from(content.querySelectorAll('.empSel:checked')).map(i => i.value);
      if (!ids.length) { alert('対象を選択してください'); return; }
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      const listRows = ids.map(id => {
        const u = users.find(x => String(x.id) === String(id));
        const code = (u && u.employee_code) ? u.employee_code : fmtEmpNo(id);
        const name = (u && u.username) ? u.username : '';
        const dept = deptName((u && u.departmentId) ? u.departmentId : null);
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
    };
    filterWrap.addEventListener('click', bulkHandler);
    pager.addEventListener('click', bulkHandler);
  }

  content.addEventListener('click', async (e) => {
    const t = e && e.target;
    const a = (t && t.closest) ? t.closest('a') : null;
    if (a) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('/admin/employees?detail=') || href.startsWith('/admin/employees?edit=')) {
        e.preventDefault();
        const url = new URL(href, window.location.origin);
        const keepKeys = ['q','dept','role','status','hireFrom','hireTo','sortKey','sortDir','page','code'];
        for (const k of keepKeys) {
          const v = params.get(k);
          if (v && !url.searchParams.get(k)) url.searchParams.set(k, v);
        }
        window.location.href = url.pathname + '?' + url.searchParams.toString() + (url.hash || '');
        return;
      }
    }
    const t2 = e && e.target;
    const delId = (t2 && t2.getAttribute) ? t2.getAttribute('data-delete') : null;
    if (delId) {
      if (confirm('この社員を無効化しますか？')) {
        try {
          await deleteEmployee(delId);
          const u = users.find(x => String(x.id) === String(delId));
          if (u) u.employment_status = 'inactive';
          alert('無効化しました（状態: 無効/休職）');
          renderRows();
        } catch (err) {
          alert(String((err && err.message) ? err.message : '無効化に失敗しました'));
        }
      }
      return;
    }
    const hardId = (t2 && t2.getAttribute) ? t2.getAttribute('data-hard-delete') : null;
    if (hardId) {
      if (confirm('この社員を完全に削除しますか？この操作は取り消せません。')) {
        try {
          await deleteUserHard(hardId);
          users = users.filter(x => String(x.id) !== String(hardId));
          renderRows();
        } catch (err) {
          alert(String((err && err.message) ? err.message : '削除に失敗しました'));
        }
      }
    }
  });

  hideNavSpinner();
}

let mounted = false;
let cachedProfile = null;

export async function mount() {
  if (!cachedProfile) {
    cachedProfile = await requireAdmin();
  }
  const profile = cachedProfile;
  if (!profile) return;
  try {
    const userName = document.querySelector('#userName');
    if (userName) userName.textContent = profile.username || profile.email || '管理者';
  } catch {}

  const status = $('#status');
  if (status) status.textContent = '';

  const content = $('#adminContent');
  if (content) content.className = 'card wide';

  await renderEmployees(profile);

  if (!mounted) {
    mounted = true;
    window.addEventListener('hashchange', () => { renderEmployees(profile); });
    window.addEventListener('popstate', () => { renderEmployees(profile); });
  }
}
