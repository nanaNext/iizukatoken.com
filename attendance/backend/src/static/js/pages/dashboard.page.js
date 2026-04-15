import { me, refresh, logout } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function showSpinner() {
  try {
    const el = $('#pageSpinner');
    if (!el) return;
    el.removeAttribute('hidden');
    el.style.display = 'grid';
  } catch {}
}

function hideSpinner() {
  try {
    const el = $('#pageSpinner');
    if (!el) return;
    el.setAttribute('hidden', '');
    el.style.display = 'none';
  } catch {}
}

function showError(msg) {
  const el = $('#error');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg || 'エラーが発生しました。';
}

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

async function ensureAuthProfile() {
  let token = '';
  try { token = sessionStorage.getItem('accessToken') || ''; } catch {}
  if (token) {
    try {
      const p = await me(token);
      return p;
    } catch {}
  }
  try {
    const r = await refresh();
    token = r?.accessToken || '';
    if (token) {
      try { sessionStorage.setItem('accessToken', token); } catch {}
      const p2 = await me(token);
      return p2;
    }
  } catch {}
  return null;
}

function wireUserMenu() {
  const btn = document.querySelector('.user .user-btn');
  const dd = $('#userDropdown');
  if (!btn || !dd) return;
  btn.addEventListener('click', () => {
    const isHidden = dd.hasAttribute('hidden');
    if (isHidden) dd.removeAttribute('hidden');
    else dd.setAttribute('hidden', '');
  });
  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('.user-menu')) return;
    dd.setAttribute('hidden', '');
  });
  const btnLogout = $('#btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
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
      window.location.replace('/ui/login');
    });
  }
}

function wireDrawer() {
  const btn = $('#mobileMenuBtn');
  const drawer = $('#mobileDrawer');
  const close = $('#mobileClose');
  const backdrop = $('#drawerBackdrop');
  if (!btn || !drawer) return;
  const open = () => {
    drawer.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.removeAttribute('hidden');
  };
  const shut = () => {
    drawer.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.setAttribute('hidden', '');
  };
  btn.addEventListener('click', () => {
    if (drawer.hasAttribute('hidden')) open();
    else shut();
  });
  if (close) close.addEventListener('click', shut);
  if (backdrop) backdrop.addEventListener('click', shut);
}

function renderProfile(profile) {
  const tiles = $('#tiles');
  if (!tiles) return;
  tiles.classList.remove('employee-portal');
  tiles.classList.add('dashboard-profile-host');
  // Force dashboard container to full-width block layout (avoid inheriting tile grid on mobile).
  tiles.style.display = 'block';
  tiles.style.gridTemplateColumns = 'none';
  tiles.style.width = '100%';
  tiles.style.maxWidth = '100%';
  tiles.style.margin = '0';
  tiles.style.gap = '0';
  tiles.style.justifyContent = 'stretch';

  if (!document.getElementById('dashboardProfileStyle')) {
    const style = document.createElement('style');
    style.id = 'dashboardProfileStyle';
    style.textContent = `
      .dashboard-profile-card{
        max-width:900px;
        width:100%;
        background:#fff;
        border:1px solid #d7e4f5;
        border-radius:12px;
        padding:16px 18px;
      }
      .dashboard-profile-host{
        display:block !important;
        grid-template-columns:none !important;
        max-width:980px;
        margin:0 auto;
      }
      .dashboard-profile-title{
        margin:0 0 10px;
        font-size:18px;
        color:#0d2c5b;
      }
      .dashboard-profile-grid{
        display:grid;
        grid-template-columns:minmax(90px,130px) 1fr;
        row-gap:10px;
        column-gap:12px;
      }
      .dashboard-profile-grid .k{
        color:#64748b;
        font-size:13px;
      }
      .dashboard-profile-grid .v{
        color:#0f172a;
        font-weight:600;
        font-size:13px;
        word-break:break-word;
      }
      @media (max-width:480px){
        .dashboard-profile-host{
          max-width:100%;
        }
        .dashboard-profile-card{
          padding:12px 12px;
          border-radius:10px;
        }
        .dashboard-profile-title{
          font-size:16px;
          margin-bottom:8px;
        }
        .dashboard-profile-grid{
          grid-template-columns:96px 1fr;
          row-gap:8px;
          column-gap:10px;
        }
        .dashboard-profile-grid .k,
        .dashboard-profile-grid .v{
          font-size:12px;
          line-height:1.35;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const name = profile?.username || profile?.name || profile?.email || 'ユーザー';
  const email = profile?.email || '-';
  const role = profile?.role || '-';
  const employeeCode = profile?.employee_code || profile?.employeeCode || '-';
  const department = profile?.department_name || profile?.departmentName || profile?.department || '-';

  tiles.innerHTML = `
    <section class="card dashboard-profile-card" style="width:100%;box-sizing:border-box;">
      <h2 class="dashboard-profile-title">現在の登録情報</h2>
      <div class="dashboard-profile-grid">
        <div class="k">ユーザー名</div><div class="v">${esc(name)}</div>
        <div class="k">メール</div><div class="v">${esc(email)}</div>
        <div class="k">権限</div><div class="v">${esc(role)}</div>
        <div class="k">社員コード</div><div class="v">${esc(employeeCode)}</div>
        <div class="k">部署</div><div class="v">${esc(department)}</div>
      </div>
    </section>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  showSpinner();
  wireUserMenu();
  wireDrawer();

  try {
    const profile = await ensureAuthProfile();
    if (!profile) {
      hideSpinner();
      window.location.replace('/ui/login');
      return;
    }
    try {
      const s = JSON.stringify(profile || {});
      sessionStorage.setItem('user', s);
      localStorage.setItem('user', s);
    } catch {}
    const nameEl = $('#userName');
    if (nameEl) nameEl.textContent = profile.username || profile.email || 'ユーザー';
    renderProfile(profile);
  } catch (e) {
    showError(`読込エラー: ${e?.message || 'unknown'}`);
  } finally {
    hideSpinner();
  }
});
