import { me, refresh, logout } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function ensureAuthProfile() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) {
    try { profile = await me(token); } catch {}
  }
  if (!profile) {
    try {
      const r = await refresh();
      sessionStorage.setItem('accessToken', r.accessToken);
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

  try {
    const userName = $('#userName');
    if (userName) userName.textContent = profile.username || profile.email || 'ユーザー';
  } catch {}

  const goLogin = async () => {
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
    try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
  };

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
  try { $('#btnLogout')?.addEventListener('click', goLogin); } catch {}
  try { $('#drawerLogout')?.addEventListener('click', goLogin); } catch {}

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

  const params = new URLSearchParams(window.location.search);
  const date = isISODate(params.get('date')) ? String(params.get('date')) : todayJST();

  const root = $('#workReport');
  if (!root) return;

  try {
    const st = await fetchJSONAuth(`/api/attendance/status?date=${encodeURIComponent(date)}`);
    const open = !!st?.open;
    const hasOut = Array.isArray(st?.timesheet?.days) && st.timesheet.days.length > 0;
    if (open || !hasOut) {
      root.innerHTML = `
        <div class="wr-wrap">
          <div class="wr-title">作業報告</div>
          <div class="wr-date">${date}</div>
          <div class="wr-card">
            <div class="wr-status">退勤後に作業報告を入力してください。</div>
            <div class="wr-actions">
              <a class="btn" href="/ui/today-work">本日の出勤へ</a>
              <a class="btn" href="/ui/portal">ホームへ</a>
            </div>
          </div>
        </div>
      `;
      return;
    }
  } catch {}

  let existing = null;
  let closed = false;
  try {
    const r = await fetchJSONAuth(`/api/work-reports/my?date=${encodeURIComponent(date)}`);
    existing = r?.report || null;
    closed = !!r?.closed;
  } catch {}

  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const siteVal = esc(existing?.site || '');
  const workVal = esc(existing?.work || '');

  root.innerHTML = `
    <div class="wr-wrap">
      <div class="wr-title">作業報告</div>
      <div class="wr-date">${date}</div>
      <div class="wr-card">
        <form id="reportForm">
          <div class="wr-row">
            <div class="wr-label">現場</div>
            <div><input id="site" class="wr-input" placeholder="現場名" value="${siteVal}" ${closed ? 'disabled' : ''} required></div>
          </div>
          <div class="wr-row">
            <div class="wr-label">作業内容</div>
            <div><textarea id="work" class="wr-textarea" placeholder="本日の作業内容を入力してください" ${closed ? 'disabled' : ''} required>${workVal}</textarea></div>
          </div>
          <div class="wr-actions">
            <button type="submit" class="btn" ${closed ? 'disabled' : ''}>保存</button>
            <a class="btn" href="/ui/today-work">本日の出勤へ</a>
          </div>
          <div class="wr-note">${closed ? 'この月は締め済みのため編集できません。' : '退勤後の作業報告は必須です。'}</div>
          <div id="status" class="wr-status"></div>
        </form>
      </div>
    </div>
  `;

  const form = $('#reportForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr('');
    const status = $('#status');
    if (status) status.textContent = '保存中…';
    if (closed) {
      if (status) status.textContent = '';
      showErr('この月は締め済みのため編集できません。');
      return;
    }
    const site = String($('#site')?.value || '').trim();
    const work = String($('#work')?.value || '').trim();
    if (!site || !work) {
      if (status) status.textContent = '';
      showErr('現場と作業内容を入力してください。');
      return;
    }
    try {
      await fetchJSONAuth('/api/work-reports', { method: 'POST', body: JSON.stringify({ date, site, work }) });
      if (status) status.textContent = '保存しました。';
    } catch (err) {
      if (status) status.textContent = '';
      showErr('保存に失敗しました: ' + (err?.message || 'unknown'));
    }
  });

  try { if (pageSpinner) pageSpinner.setAttribute('hidden', ''); } catch {}
});
