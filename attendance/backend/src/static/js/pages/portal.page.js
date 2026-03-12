import { me, refresh, logout } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

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
      token = r.accessToken;
      profile = await me(token);
    } catch {}
  }
  if (!profile) { return null; }
  return profile;
}

document.addEventListener('DOMContentLoaded', async () => {
  const pageSpinner = document.querySelector('#pageSpinner');
  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const minDelayMs = 900;
  try {
    const navEntry = (typeof performance !== 'undefined' && performance.getEntriesByType) ? performance.getEntriesByType('navigation')[0] : null;
    const navType = navEntry?.type || (performance && performance.navigation && performance.navigation.type === 2 ? 'back_forward' : '');
    if (navType === 'back_forward') {
      if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
      try { sessionStorage.removeItem('navSpinner'); } catch {}
    }
    window.addEventListener('pageshow', () => {
      try { sessionStorage.removeItem('navSpinner'); } catch {}
      if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
    });
  } catch {}
  try {
    /* giữ spinner đến khi xác thực xong, không auto-hide theo thời gian */
  } catch {}
  try {
    const f = sessionStorage.getItem('navSpinner');
    if (f === '1' && pageSpinner) {
      pageSpinner.removeAttribute('hidden');
    }
    sessionStorage.removeItem('navSpinner');
  } catch {}
  const waitMinDelay = async () => {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = now - startTime;
    if (elapsed < minDelayMs) {
      await new Promise(r => setTimeout(r, minDelayMs - elapsed));
    }
  };
  const setTopbarHeightVar = () => {
    try {
      if (document.body.classList.contains('drawer-open')) return;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 480px)').matches) return;
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        const h = Math.round(topbar.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--topbar-height', `${h}px`);
      }
    } catch {}
  };
  setTopbarHeightVar();
  window.addEventListener('resize', setTopbarHeightVar);
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
    await waitMinDelay();
    if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  }
  if (!profile) { await waitMinDelay(); if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); } window.location.replace('/ui/login'); return; }
  try {
    const rt = sessionStorage.getItem('refreshToken') || '';
    const userStr = sessionStorage.getItem('user') || '';
    if (rt) { localStorage.setItem('refreshToken', rt); }
    if (userStr) { localStorage.setItem('user', userStr); }
  } catch {}
  const role = String(profile.role || '').toLowerCase();
  $('#userName').textContent = profile.username || profile.email || 'ユーザー';
  await waitMinDelay();
  if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  try {
    history.replaceState({ iz_portal: true }, '');
    history.pushState({ iz_portal: true }, '');
    window.addEventListener('popstate', () => {
      window.location.replace('/ui/login');
    });
  } catch {}
  if (role === 'admin') {
    const tiles = document.querySelector('.tiles');
    if (tiles) {
      tiles.innerHTML = `
        <a class="tile" href="/ui/employees" target="_blank" rel="noopener"><div class="icon">👤</div><div class="title">社員管理</div></a>
        <a class="tile" href="/ui/admin?tab=users" target="_blank" rel="noopener"><div class="icon">👥</div><div class="title">ユーザー管理</div></a>
        <a class="tile" href="/ui/admin?tab=departments" target="_blank" rel="noopener"><div class="icon">🏢</div><div class="title">部門管理</div></a>
        <a class="tile" href="/ui/admin?tab=attendance" target="_blank" rel="noopener"><div class="icon">⏱</div><div class="title">勤怠管理</div></a>
        <a class="tile" href="/ui/admin?tab=approvals" target="_blank" rel="noopener"><div class="icon">✅</div><div class="title">承認フロー</div></a>
        <a class="tile" href="/ui/admin?tab=reports" target="_blank" rel="noopener"><div class="icon">📊</div><div class="title">レポート</div></a>
        <a class="tile" href="/ui/admin?tab=salary_list" target="_blank" rel="noopener"><div class="icon">💴</div><div class="title">給与管理</div></a>
        <a class="tile" href="/ui/admin?tab=settings" target="_blank" rel="noopener"><div class="icon">⚙️</div><div class="title">システム設定</div></a>
        <a class="tile" href="/ui/admin?tab=audit" target="_blank" rel="noopener"><div class="icon">📝</div><div class="title">監査ログ</div></a>
        <a class="tile" href="/ui/admin?tab=refresh" target="_blank" rel="noopener"><div class="icon">🔑</div><div class="title">トークン管理</div></a>
        <a class="tile" href="/ui/admin?tab=calendar" target="_blank" rel="noopener"><div class="icon">📅</div><div class="title">カレンダー</div></a>
        <a class="tile" href="/ui/admin?tab=shifts" target="_blank" rel="noopener"><div class="icon">🗓️</div><div class="title">シフト</div></a>
        <a class="tile" href="/ui/admin?tab=routes" target="_blank" rel="noopener"><div class="icon">🔗</div><div class="title">API一覧</div></a>
      `;
    }
    const drawer = document.querySelector('#mobileDrawer');
    if (drawer) {
      drawer.innerHTML = `
        <div class="drawer-header">
          <button id="mobileClose" class="mobile-close" aria-label="close">✕</button>
        </div>
        <a href="/ui/portal" class="drawer-item">ホーム</a>
        <a href="/ui/employees" class="drawer-item">社員管理</a>
        <a href="/ui/admin?tab=users" class="drawer-item">ユーザー管理</a>
        <a href="/ui/admin?tab=departments" class="drawer-item">部門管理</a>
        <a href="/ui/admin?tab=attendance" class="drawer-item">勤怠管理</a>
        <a href="/ui/admin?tab=approvals" class="drawer-item">承認フロー</a>
        <a href="/ui/admin?tab=reports" class="drawer-item">レポート</a>
        <a href="/ui/admin?tab=salary_list" class="drawer-item">給与管理</a>
        <a href="/ui/admin?tab=settings" class="drawer-item">システム設定</a>
        <a href="/ui/admin?tab=audit" class="drawer-item">監査ログ</a>
        <a href="/ui/admin?tab=refresh" class="drawer-item">トークン管理</a>
        <a href="/ui/admin?tab=calendar" class="drawer-item">カレンダー</a>
        <a href="/ui/admin?tab=shifts" class="drawer-item">シフト</a>
        <a href="/ui/admin?tab=routes" class="drawer-item">API一覧</a>
        <button id="drawerLogout" class="drawer-item" type="button">ログアウト</button>
      `;
    }
  } else if (role === 'manager') {
    const tiles = document.querySelector('.tiles');
    if (tiles) {
      tiles.innerHTML = `
        <a class="tile" href="#"><div class="icon">👥</div><div class="title">従業員概要</div></a>
        <a class="tile" href="#"><div class="icon">👤</div><div class="title">従業員管理</div></a>
        <a class="tile" href="#"><div class="icon">⏱</div><div class="title">勤怠管理</div></a>
        <a class="tile" href="#"><div class="icon">💴</div><div class="title">給与管理</div></a>
        <a class="tile" href="#"><div class="icon">📝</div><div class="title">休暇管理</div></a>
        <a class="tile" href="#"><div class="icon">📣</div><div class="title">お知らせ</div></a>
      `;
    }
  } else {
    try {
      const adminTile = document.querySelector('#tile-admin');
      if (adminTile) adminTile.remove();
    } catch {}
  }
  // Add explicit "Back to Login" control
  try {
    const nav = document.querySelector('.subnav');
    if (nav && !document.querySelector('#goLogin')) {
      const a = document.createElement('a');
      a.id = 'goLogin';
      a.textContent = 'ログインへ';
      a.href = '/ui/login';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('user');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        } catch {}
        window.location.replace('/ui/login');
      });
      nav.appendChild(a);
    }
  } catch {}
  /* dùng biến pageSpinner đã khai báo ở đầu scope */
  function navigateWithSpinner(href) {
    try { sessionStorage.setItem('navSpinner', '1'); } catch {}
    if (pageSpinner) { pageSpinner.removeAttribute('hidden'); }
    setTimeout(() => { window.location.href = href; }, 600);
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
        try {
          const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
          await logout(rt);
        } catch {}
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
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
        try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
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
});
