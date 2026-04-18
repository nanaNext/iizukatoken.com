import { fetchJSONAuth } from '../api/http.api.js';
import { wireAdminShell } from '../shell/admin-shell.js?v=navy-20260418-menuhotfix7';

async function ensureProfile() {
  const profile = await fetchJSONAuth('/api/auth/me').catch(() => null);
  return profile || null;
}

function q(root, sel) {
  return (root || document).querySelector(sel);
}

function showErr(root, msg) {
  const el = q(root, '#error');
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

function ymToYLabel(ym) {
  const s = String(ym || '');
  if (!/^\d{4}-\d{2}$/.test(s)) return '';
  const y = s.slice(0, 4);
  const m = String(parseInt(s.slice(5, 7), 10));
  return `${y}年${m}月`;
}

async function fetchEmployees(role) {
  const base = role === 'admin' ? '/api/admin/users' : '/api/manager/users';
  const url = new URL(base, window.location.origin);
  url.searchParams.set('role', 'employee');
  url.searchParams.set('employmentStatus', 'active');
  url.searchParams.set('limit', '2000');
  url.searchParams.set('offset', '0');
  const r = await fetchJSONAuth(url.pathname + url.search).catch(() => null);
  const rows = Array.isArray(r) ? r : ((r && Array.isArray(r.rows)) ? r.rows : []);
  return rows
    .filter(u => roleOf(u) === 'employee')
    .filter(u => statusOf(u) !== 'inactive' && statusOf(u) !== 'retired')
    .sort((a, b) => {
      const c = codeOf(a).localeCompare(codeOf(b));
      if (c) return c;
      return nameOf(a).localeCompare(nameOf(b));
    });
}

function showFrameSpinner(root, show) {
  try {
    const el = q(root, '#frameSpinner');
    if (!el) return;
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  } catch {}
}

function openMonthlyInFrame(root, uid, month) {
  const frame = q(root, '#monthlyFrame');
  if (!frame) return;
  const id = String(uid || '').trim();
  const ym = String(month || '').trim();
  const url = new URL('/admin/embed/attendance/monthly', window.location.origin);
  if (id) url.searchParams.set('userId', id);
  if (/^\d{4}-\d{2}$/.test(ym)) url.searchParams.set('month', ym);
  url.searchParams.set('embed', '1');
  showFrameSpinner(root, true);
  frame.src = url.pathname + url.search;
}

function renderSelect(root, users, currentUid = '') {
  const sel = q(root, '#empSelect');
  if (!sel) return;

  sel.innerHTML = '';
  if (!users.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '社員が見つかりません';
    sel.appendChild(opt);
    return;
  }

  for (const u of users) {
    const id   = String(u.id || '').trim();
    const code = codeOf(u);
    const name = nameOf(u);
    const opt  = document.createElement('option');
    opt.value = id;
    opt.textContent = `${name}（${code}）`;
    if (id === currentUid) opt.selected = true;
    sel.appendChild(opt);
  }
}

function wireFrameLoading(root) {
  try {
    const frame = q(root, '#monthlyFrame');
    if (!frame) return;
    if (frame.dataset.bound === '1') return;
    frame.dataset.bound = '1';
    frame.addEventListener('load', () => {
      showFrameSpinner(root, false);
      try {
        const u = new URL(frame.src || '', window.location.origin);
        const uid = String(u.searchParams.get('userId') || '').trim();
        if (/^\d+$/.test(uid)) localStorage.setItem('admin.monthly.lastUserId', uid);
      } catch {}
    });
    frame.addEventListener('error', () => {
      showFrameSpinner(root, false);
      showErr(root, '読み込みに失敗しました。もう一度お試しください。');
    });
  } catch {}
}

function renderScaffold(root) {
  if (!root) return;
  root.className = 'card';
  root.innerHTML = `
    <div id="error" class="admin-monthly-error"></div>
    <div class="admin-monthly-head">
      <div class="admin-monthly-controls">
        <span class="admin-monthly-label">対象年月</span>
        <div id="monthLabel" class="admin-monthly-month-label"></div>
        <input id="month" class="admin-monthly-month" type="month">
      </div>
      <div class="admin-monthly-controls">
        <span class="admin-monthly-label">社員</span>
        <select id="empSelect" class="admin-monthly-emp-select">
          <option value="">読み込み中…</option>
        </select>
      </div>
    </div>
    <div class="admin-monthly-frame-wrap">
      <div id="frameSpinner" class="admin-monthly-frame-spinner" hidden>
        <div class="lds-spinner" aria-hidden="true">
          <div></div><div></div><div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div><div></div><div></div>
        </div>
      </div>
      <iframe id="monthlyFrame" class="admin-monthly-frame" title="月次勤怠入力"></iframe>
    </div>
  `;
}

async function boot(root, { standalone = false } = {}) {
  showErr(root, '');
  if (standalone) wireAdminShell({ logoutRedirect: '/ui/login' });
  const profile = await ensureProfile();
  if (!profile) {
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
    return;
  }
  const role = String(profile.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'manager') {
    showErr(root, '管理者権限が必要です。');
    return;
  }
  try {
    const userName = document.querySelector('#userName');
    if (userName) userName.textContent = profile.username || profile.email || '管理者';
  } catch {}
  wireFrameLoading(root);
  const monthEl   = q(root, '#month');
  const ml        = q(root, '#monthLabel');
  const empSelect = q(root, '#empSelect');

  const ym0 = (() => {
    try {
      const u = new URL(window.location.href);
      const m = String(u.searchParams.get('month') || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) return m;
    } catch {}
    return currentMonthJST();
  })();
  if (monthEl) monthEl.value = ym0;
  if (ml) ml.textContent = ymToYLabel(ym0);

  // ── Load danh sách nhân viên vào dropdown ──
  const users = await fetchEmployees(role).catch(() => []);

  // Xác định userId mặc định
  const lastUid = (() => {
    try { return String(localStorage.getItem('admin.monthly.lastUserId') || '').trim(); } catch { return ''; }
  })();
  const defaultUid = (() => {
    try {
      const u = new URL(window.location.href);
      const qid = String(u.searchParams.get('userId') || '').trim();
      if (/^\d+$/.test(qid) && users.some(row => String(row.id) === qid)) return qid;
    } catch {}
    if (/^\d+$/.test(lastUid) && users.some(u => String(u.id) === lastUid)) return lastUid;
    const first = users[0];
    return first && first.id != null ? String(first.id).trim() : '';
  })();

  renderSelect(root, users, defaultUid);

  // Hàm mở iframe theo giá trị dropdown + tháng
  const loadFrame = () => {
    const month = String(monthEl?.value || ym0).slice(0, 7);
    if (ml) ml.textContent = ymToYLabel(month);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('month', month);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
    const uid = empSelect ? String(empSelect.value || '').trim() : defaultUid;
    if (/^\d+$/.test(uid)) openMonthlyInFrame(root, uid, month);
  };

  // Wire events
  monthEl?.addEventListener('change', loadFrame);
  empSelect?.addEventListener('change', loadFrame);

  // Mở lần đầu
  loadFrame();
}

export async function mount() {
  const root = document.querySelector('#adminContent');
  if (!root) return;
  renderScaffold(root);
  await boot(root, { standalone: false });
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.body;
  if (!q(root, '#monthlyFrame')) return;
  await boot(root, { standalone: true });
});
