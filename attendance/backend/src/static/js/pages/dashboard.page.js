import { me, refresh, logout } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function getCookie(name) {
  const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : null;
}

async function ensureProfile() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) {
    try { profile = await me(token); } catch {}
  }
  if (!profile) {
    try {
      const r = await refresh();
      sessionStorage.setItem('accessToken', r.accessToken);
      token = r.accessToken;
      profile = await me(token);
    } catch {}
  }
  if (!profile) {
    try {
      const userStr = sessionStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && user.role) {
        return { username: user.username, email: user.email, role: user.role };
      }
    } catch {}
    window.location.href = '/static/html/login.html';
    return null;
  }
  return profile;
}

function renderProfile(profile) {
  const tiles = $('#tiles');
  if (!tiles) return;
  tiles.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'card';
  const pad = (s) => String(s || '');
  card.innerHTML = `
    <h3>現在の登録情報</h3>
    <div>氏名: ${pad(profile.username) || '(未設定)'}</div>
    <div>Email: ${pad(profile.email) || '(未設定)'}</div>
    <div>権限: ${pad(profile.role)}</div>
  `;
  tiles.appendChild(card);
}

document.addEventListener('DOMContentLoaded', async () => {
  const pageSpinner = document.querySelector('#pageSpinner');
  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const minDelayMs = 900;
  const waitMinDelay = async () => {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = now - startTime;
    if (elapsed < minDelayMs) {
      await new Promise(r => setTimeout(r, minDelayMs - elapsed));
    }
  };
  const showNavSpinner = () => {
    try {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      let el = document.querySelector('#pageSpinner');
      if (!el) {
        el = document.createElement('div');
        el.id = 'pageSpinner';
        el.className = 'page-spinner';
        el.innerHTML = '<div class="lds-spinner" aria-hidden="true"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>';
        document.body.appendChild(el);
      } else {
        el.removeAttribute('hidden');
      }
    } catch {}
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
  let profile = null;
  try {
    profile = await ensureProfile();
  } catch (e) {
    const err = $('#error');
    if (err) { err.style.display = 'block'; err.textContent = '認証エラー: ' + ((e && e.message) ? e.message : 'unknown'); }
    await waitMinDelay();
    if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  }
  if (!profile) { await waitMinDelay(); if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); } return; }
  $('#userName').textContent = profile.username || profile.email || 'ユーザー';
  renderProfile(profile);
  await waitMinDelay();
  if (pageSpinner) { pageSpinner.setAttribute('hidden', ''); }
  if (status) { /* no status update */ }
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
        try { await logout(); } catch {}
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        window.location.href = '/ui/login';
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
  try {
    const brand = document.querySelector('.topbar .brand');
    if (brand) {
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/ui/portal';
      });
    }
  } catch {}
  document.addEventListener('click', (e) => {
    const t = e && e.target;
    const a = (t && t.closest) ? t.closest('a') : null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('/ui/portal')) {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      showNavSpinner();
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
});
