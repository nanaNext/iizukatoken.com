import { me, refresh, logout } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

async function ensureAuthProfile() {
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
      try {
        sessionStorage.setItem('refreshToken', r.refreshToken || rt);
        localStorage.setItem('refreshToken', r.refreshToken || rt);
      } catch {}
      profile = await me(r.accessToken);
    } catch {}
  }
  if (!profile) {
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && (user.role === 'admin' || user.role === 'manager' || user.role === 'employee')) {
        profile = user;
      }
    } catch {}
  }
  return profile || null;
}

const showErr = (msg) => {
  const err = $('#error');
  if (!err) return;
  err.style.display = msg ? 'block' : 'none';
  err.textContent = msg || '';
};

const fmtTime = (dt) => {
  if (!dt) return '—';
  const s = String(dt);
  if (s.length >= 16) return s.slice(11, 16);
  return s;
};

const statusLabel = (k) => {
  if (k === 'working') return '出勤中';
  if (k === 'checked_out') return '退勤済';
  return '未出勤';
};

const render = (profile, summary, roster) => {
  const root = $('#todayWork');
  if (!root) return;
  const c = summary?.counts || {};
  const me0 = summary?.me || {};
  const date = summary?.date || '';
  const role = String(profile?.role || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'manager';
  const statusKey = me0.checkIn ? (me0.checkOut ? 'checked_out' : 'working') : 'not_checked_in';
  const tIn = fmtTime(me0.checkIn);
  const tOut = fmtTime(me0.checkOut);

  const rosterItems = Array.isArray(roster?.items) ? roster.items : [];
  const tableRows = rosterItems.map(it => {
    const code = it.employeeCode || `EMP${String(it.userId).padStart(3, '0')}`;
    const name = it.username || '';
    const dept = it.departmentName || '—';
    const cin = fmtTime(it.attendance?.checkIn);
    const cout = fmtTime(it.attendance?.checkOut);
    const st = it.status || 'not_checked_in';
    return `
      <tr>
        <td>${code}</td>
        <td>${name}</td>
        <td>${dept}</td>
        <td>${cin}</td>
        <td>${cout}</td>
        <td><span class="tw-pill ${st}">${statusLabel(st)}</span></td>
      </tr>
    `;
  }).join('');

  const rosterBlock = isAdmin ? `
    <div class="tw-card">
      <div class="tw-section-title">本日の出勤者一覧</div>
      ${tableRows ? `
        <table class="tw-table">
          <thead>
            <tr><th>社員番号</th><th>氏名</th><th>部署</th><th>出勤</th><th>退勤</th><th>状態</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      ` : `
        <div class="tw-empty"><div style="font-size:28px;">🗂️</div><div>データがありません</div></div>
      `}
    </div>
  ` : '';

  root.innerHTML = `
    <div class="today-wrap">
      <div class="today-title">本日の出勤</div>
      <div class="today-date">${date}</div>
      <div class="tw-kpi-grid">
        <div class="tw-card"><div class="tw-kpi-title">対象人数</div><div class="tw-kpi-value">${c.targetEmployees ?? 0}</div><div class="tw-kpi-sub">Số người dự kiến đi làm trong ngày</div></div>
        <div class="tw-card"><div class="tw-kpi-title">出勤人数</div><div class="tw-kpi-value">${c.checkIn ?? 0}</div><div class="tw-kpi-sub">Số người đã check-in (bắt đầu làm)</div></div>
        <div class="tw-card"><div class="tw-kpi-title">未出勤</div><div class="tw-kpi-value">${c.notCheckedIn ?? 0}</div><div class="tw-kpi-sub">Chưa check-in (đầu ngày đi làm)</div></div>
        <div class="tw-card"><div class="tw-kpi-title">未退勤</div><div class="tw-kpi-value">${c.notCheckedOut ?? 0}</div><div class="tw-kpi-sub">Chưa check-out (cuối ngày đi làm)</div></div>
      </div>
      <div class="tw-grid">
        ${rosterBlock}
        <div class="tw-card">
          <div class="tw-section-title">あなたの状況</div>
          <div class="tw-row">
            <div class="tw-label">状態</div><div class="tw-strong">${statusLabel(statusKey)}</div>
            <div class="tw-label">出勤</div><div>${tIn}</div>
            <div class="tw-label">退勤</div><div>${tOut}</div>
          </div>
          <div class="tw-actions">
            <a class="btn" href="/ui/attendance">勤怠入力へ</a>
            <a class="btn" href="/ui/portal">ホームへ</a>
          </div>
        </div>
      </div>
    </div>
  `;
};

document.addEventListener('DOMContentLoaded', async () => {
  const pageSpinner = $('#pageSpinner');
  try { if (pageSpinner) pageSpinner.removeAttribute('hidden'); } catch {}

  const setTopbarHeightVar = () => {
    try {
      const topbar = document.querySelector('.topbar');
      if (!topbar) return;
      const h = Math.round(topbar.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    } catch {}
  };
  setTopbarHeightVar();
  try { window.addEventListener('resize', setTopbarHeightVar); } catch {}

  const profile = await ensureAuthProfile();
  if (!profile) {
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
    return;
  }

  const goLogin = async () => {
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
  };

  try {
    const p = String(window.location.pathname || '');
    if ((p === '/ui/today-work' || p === '/ui/portal' || p === '/ui/dashboard') && document.body.dataset.backLoginBound !== '1') {
      document.body.dataset.backLoginBound = '1';
      try { history.pushState({ back_to_login_guard: true }, '', window.location.href); } catch {}
      window.addEventListener('popstate', async () => {
        await goLogin();
      });
    }
  } catch {}

  try {
    if (document.body.dataset.navSpinBound !== '1') {
      document.body.dataset.navSpinBound = '1';
      document.addEventListener('click', (e) => {
        const a = e.target?.closest?.('a[href]');
        if (!a) return;
        if (a.target === '_blank') return;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        if (href.startsWith('http')) return;
        try { sessionStorage.setItem('navSpinner', '1'); } catch {}
        try { if (pageSpinner) pageSpinner.removeAttribute('hidden'); } catch {}
      });
    }
  } catch {}

  try {
    const userName = $('#userName');
    if (userName) userName.textContent = profile.username || profile.email || 'ユーザー';
  } catch {}

  try {
    const btn = document.querySelector('.user-btn');
    const dd = $('#userDropdown');
    if (btn && dd && btn.dataset.bound !== '1') {
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
    }
  } catch {}

  const doLogout = async () => {
    await goLogin();
  };
  try { $('#btnLogout')?.addEventListener('click', doLogout); } catch {}
  try { $('#drawerLogout')?.addEventListener('click', doLogout); } catch {}

  try {
    const mobileBtn = $('#mobileMenuBtn');
    const mobileDrawer = $('#mobileDrawer');
    const mobileClose = $('#mobileClose');
    const mobileBackdrop = $('#drawerBackdrop');
    if (mobileBtn && mobileDrawer) {
      const toggleDrawer = (open) => {
        const isHidden = mobileDrawer.hasAttribute('hidden');
        const shouldOpen = typeof open === 'boolean' ? open : isHidden;
        if (shouldOpen) {
          mobileDrawer.removeAttribute('hidden');
          mobileBtn.setAttribute('aria-expanded', 'true');
          document.body.classList.add('drawer-open');
          if (mobileBackdrop) mobileBackdrop.removeAttribute('hidden');
        } else {
          mobileDrawer.setAttribute('hidden', '');
          mobileBtn.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('drawer-open');
          if (mobileBackdrop) mobileBackdrop.setAttribute('hidden', '');
        }
      };
      mobileBtn.addEventListener('click', () => toggleDrawer());
      if (mobileClose) mobileClose.addEventListener('click', () => toggleDrawer(false));
    }
  } catch {}

  try {
    const summary = await fetchJSONAuth('/api/attendance/today-summary');
    const role = String(profile?.role || '').toLowerCase();
    let roster = null;
    if (role === 'admin' || role === 'manager') {
      try { roster = await fetchJSONAuth('/api/attendance/today-roster'); } catch {}
    }
    render(profile, summary, roster);
    try {
      const me0 = summary?.me || {};
      const canReport = role === 'employee' || role === 'manager';
      if (canReport && me0?.checkOut) {
        const date = summary?.date || '';
        const r = await fetchJSONAuth(`/api/work-reports/my?date=${encodeURIComponent(date)}`);
        if (!r?.report) {
          try { window.location.replace(`/ui/work-report?date=${encodeURIComponent(date)}`); } catch { window.location.href = `/ui/work-report?date=${encodeURIComponent(date)}`; }
          return;
        }
      }
    } catch {}
  } catch (e) {
    showErr('データ取得に失敗しました: ' + (e?.message || 'unknown'));
  } finally {
    try { if (pageSpinner) pageSpinner.setAttribute('hidden', ''); } catch {}
  }
});
