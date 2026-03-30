import { fetchJSONAuth } from '../api/http.api.js';
import { wireAdminShell } from '../shell/admin-shell.js';

const $ = (sel) => document.querySelector(sel);

async function ensureProfile() {
  const profile = await fetchJSONAuth('/api/auth/me').catch(() => null);
  return profile || null;
}

function showErr(msg) {
  const el = $('#error');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
}

function normalize(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function codeOf(u) {
  return String(u.employee_code || u.employeeCode || (u.id ? ('EMP' + String(u.id).padStart(3, '0')) : '')).trim();
}

function nameOf(u) {
  return String(u.username || u.email || '').trim();
}

function roleOf(u) {
  return String(u.role || '').toLowerCase();
}

function statusOf(u) {
  return String(u.employment_status || u.employmentStatus || 'active').toLowerCase();
}

function currentMonthJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

function showFrameSpinner(show) {
  try {
    const el = document.querySelector('#frameSpinner');
    if (!el) return;
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  } catch {}
}

function openMonthlyInFrame(uid, month) {
  const frame = $('#monthlyFrame');
  if (!frame) return;
  const id = String(uid || '').trim();
  if (!id) return;
  const ym = String(month || '').trim();
  const url = new URL('/ui/attendance/monthly', window.location.origin);
  url.searchParams.set('userId', id);
  if (/^\d{4}-\d{2}$/.test(ym)) url.searchParams.set('month', ym);
  url.searchParams.set('embed', '1');
  showFrameSpinner(true);
  frame.src = url.pathname + url.search;
}

function renderList(users, month, statuses = []) {
  const host = $('#list');
  if (!host) return;
  host.innerHTML = '';

  const statusMap = new Map(statuses.map(s => [String(s.userId), s]));

  const table = document.createElement('table');
  table.className = 'excel-table admin-monthly-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:140px;">社員番号</th>
        <th>氏名</th>
        <th style="width:140px;">ステータス</th>
        <th style="width:140px;">操作</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  for (const u of users) {
    const tr = document.createElement('tr');
    const id = String(u.id || '').trim();
    const code = codeOf(u);
    const name = nameOf(u);
    const email = String(u.email || '').trim();
    
    const s = statusMap.get(id);
    const stVal = String(s?.status || 'draft');
    
    const tdCode = document.createElement('td');
    tdCode.textContent = code;
    const tdName = document.createElement('td');
    const aName = document.createElement('a');
    aName.href = '#';
    aName.className = 'admin-monthly-user-link';
    aName.setAttribute('data-user-id', id);
    aName.textContent = name;
    tdName.appendChild(aName);
    
    const tdStatus = document.createElement('td');
    const stPill = document.createElement('span');
    const ready = !!(s && (s.ready === true || String(s.ready) === 'true'));
    let pillClass = stVal;
    let pillText = '未承認';
    if (stVal === 'approved') { pillText = '承認済み'; pillClass = 'approved'; }
    else if (stVal === 'submitted') { pillText = '承認待ち'; pillClass = 'submitted'; }
    else if (ready) { pillText = '済み'; pillClass = 'ready'; }
    stPill.className = 'admin-monthly-status-pill ' + pillClass;
    stPill.textContent = pillText;
    tdStatus.appendChild(stPill);

    const tdAct = document.createElement('td');
    const aAct = document.createElement('a');
    aAct.href = '#';
    aAct.className = 'admin-monthly-action';
    aAct.setAttribute('data-user-id', id);
    aAct.textContent = '開く';
    tdAct.appendChild(aAct);

    if (stVal === 'submitted') {
      const btnApprove = document.createElement('button');
      btnApprove.type = 'button';
      btnApprove.className = 'admin-monthly-btn-approve';
      btnApprove.textContent = '承認';
      btnApprove.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`${name}さんの${month}分を承認しますか？`)) return;
        try {
          const [year, m] = month.split('-');
          await fetchJSONAuth('/api/attendance/month/approve', {
            method: 'POST',
            body: JSON.stringify({ userId: id, year, month: m })
          });
          alert('承認しました。');
          // Refresh list
          const q = normalize(($('#q') && $('#q').value != null) ? $('#q').value : '');
          const base = String(window.location.pathname).includes('/admin/') ? '/api/admin/users' : '/api/manager/users'; // Simplified role check
          // Actually we can just call rebuild() if it was in scope, but it's in DOMContentLoaded
          // For now, let's just trigger a change event on month picker to refresh
          $('#month').dispatchEvent(new Event('change'));
        } catch (err) {
          alert('承認に失敗しました: ' + (err.message || 'unknown'));
        }
      });
      tdAct.appendChild(document.createTextNode(' | '));
      tdAct.appendChild(btnApprove);
    }

    tr.appendChild(tdCode);
    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  host.appendChild(table);

  host.querySelectorAll('a[data-user-id]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const uid = String(a.getAttribute('data-user-id') || '').trim();
      if (!uid) return;
      openMonthlyInFrame(uid, month);
    });
  });
}

function wireFrameLoading() {
  try {
    const frame = document.querySelector('#monthlyFrame');
    if (!frame) return;
    if (frame.dataset.bound === '1') return;
    frame.dataset.bound = '1';
    frame.addEventListener('load', () => {
      showFrameSpinner(false);
    });
    frame.addEventListener('error', () => {
      showFrameSpinner(false);
      showErr('読み込みに失敗しました。もう一度お試しください。');
    });
  } catch {}
}

document.addEventListener('DOMContentLoaded', async () => {
  showErr('');
  wireAdminShell({ logoutRedirect: '/ui/login' });
  const profile = await ensureProfile();
  if (!profile) {
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
    return;
  }
  const role = String(profile.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    showErr('管理者権限が必要です。');
    return;
  }
  try { $('#userName').textContent = profile.username || profile.email || '管理者'; } catch {}
  wireFrameLoading();

  const monthEl = $('#month');
  const qEl = $('#q');
  const ym0 = currentMonthJST();
  if (monthEl) monthEl.value = ym0;

  let currentUsers = [];
  let fetchSeq = 0;
  let qTimer = null;
  const fetchUsers = async (q) => {
    const seq = ++fetchSeq;
    const base = role === 'admin' ? '/api/admin/users' : '/api/manager/users';
    const url = new URL(base, window.location.origin);
    url.searchParams.set('role', 'employee');
    url.searchParams.set('employmentStatus', 'active');
    url.searchParams.set('limit', '500');
    url.searchParams.set('offset', '0');
    if (q) url.searchParams.set('q', q);
    const r = await fetchJSONAuth(url.pathname + url.search).catch(() => null);
    if (seq !== fetchSeq) return;
    const rows = Array.isArray(r) ? r : ((r && Array.isArray(r.rows)) ? r.rows : []);
    currentUsers = rows
      .filter(u => roleOf(u) === 'employee')
      .filter(u => statusOf(u) !== 'inactive' && statusOf(u) !== 'retired')
      .sort((a, b) => {
        const c = codeOf(a).localeCompare(codeOf(b));
        if (c) return c;
        return nameOf(a).localeCompare(nameOf(b));
      });
    const ym = (monthEl && monthEl.value) ? monthEl.value : ym0;
    const [year, monthVal] = ym.split('-');
    const uids = currentUsers.map(u => u.id).join(',');
    let statuses = [];
    if (uids) {
      const sUrl = new URL('/api/attendance/month/status-bulk', window.location.origin);
      sUrl.searchParams.set('userIds', uids);
      sUrl.searchParams.set('year', year);
      sUrl.searchParams.set('month', monthVal);
      statuses = await fetchJSONAuth(sUrl.pathname + sUrl.search).catch(() => []);
    }
    renderList(currentUsers, ym, statuses);
  };
  const rebuild = () => {
    const q = normalize((qEl && qEl.value != null) ? qEl.value : '');
    void fetchUsers(q);
  };
  if (qEl) qEl.addEventListener('input', () => {
    if (qTimer) clearTimeout(qTimer);
    qTimer = setTimeout(rebuild, 240);
  });
  if (monthEl) monthEl.addEventListener('change', async () => {
    const ym = monthEl.value || ym0;
    const [year, monthVal] = ym.split('-');
    const uids = currentUsers.map(u => u.id).join(',');
    let statuses = [];
    if (uids) {
      const sUrl = new URL('/api/attendance/month/status-bulk', window.location.origin);
      sUrl.searchParams.set('userIds', uids);
      sUrl.searchParams.set('year', year);
      sUrl.searchParams.set('month', monthVal);
      statuses = await fetchJSONAuth(sUrl.pathname + sUrl.search).catch(() => []);
    }
    renderList(currentUsers, ym, statuses);
    try {
      const frame = $('#monthlyFrame');
      if (!frame) return;
      const u = new URL(frame.src || '', window.location.origin);
      const uid = String(u.searchParams.get('userId') || '').trim();
      if (!uid) return;
      openMonthlyInFrame(uid, ym);
    } catch {}
  });
  await fetchUsers('');
});
