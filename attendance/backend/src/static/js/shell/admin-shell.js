import { logout } from '../api/auth.api.js';

const qs = (sel) => document.querySelector(sel);

export function wireAdminShell({ logoutRedirect = '/ui/login' } = {}) {
  wireTopbarHeightVar();
  wireUserMenu();
  wireMobileDrawer();
  wireLogout(logoutRedirect);
}

export function wireTopbarHeightVar() {
  const sync = () => {
    try {
      if (document.body.classList.contains('drawer-open')) return;
      const topbar = document.querySelector('.topbar');
      const h = topbar ? Math.round(topbar.getBoundingClientRect().height || 0) : 0;
      if (h > 0) document.documentElement.style.setProperty('--topbar-height', `${h}px`);
    } catch {}
  };
  sync();
  try { window.addEventListener('resize', sync); } catch {}
}

export function wireUserMenu() {
  try {
    const btn = qs('.user-btn');
    const dd = qs('#userDropdown');
    if (!btn || !dd) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (dd.hasAttribute('hidden')) dd.removeAttribute('hidden');
      else dd.setAttribute('hidden', '');
      try { btn.setAttribute('aria-expanded', dd.hasAttribute('hidden') ? 'false' : 'true'); } catch {}
    });
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      if (t && t.closest && t.closest('.user-menu')) return;
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    });
  } catch {}
}

export function wireMobileDrawer() {
  try {
    const btn = qs('#mobileMenuBtn');
    const drawer = qs('#mobileDrawer');
    const mount = qs('#drawerNavMount');
    const backdrop = qs('#drawerBackdrop');
    const closeBtn = qs('#mobileClose');
    if (!btn || !drawer || !backdrop) return;
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    const open = () => {
      try { drawer.removeAttribute('hidden'); } catch {}
      try { backdrop.removeAttribute('hidden'); } catch {}
      try { document.body.classList.add('drawer-open'); } catch {}
      try { btn.setAttribute('aria-expanded', 'true'); } catch {}
    };
    const close = () => {
      try { drawer.setAttribute('hidden', ''); } catch {}
      try { backdrop.setAttribute('hidden', ''); } catch {}
      try { document.body.classList.remove('drawer-open'); } catch {}
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    };
    const toggle = () => {
      const isOpen = !drawer.hasAttribute('hidden');
      if (isOpen) close();
      else open();
    };
    btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); close(); });
    backdrop.addEventListener('click', (e) => { e.preventDefault(); close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    try {
      if (mount && !mount.dataset.filled) {
        const src = document.querySelector('.sidebar .sidebar-nav');
        if (src) {
          const clone = src.cloneNode(true);
          clone.removeAttribute('style');
          clone.classList.add('drawer-nav');
          mount.appendChild(clone);
          mount.dataset.filled = '1';
        }
      }
    } catch {}
  } catch {}
}

export function wireLogout(logoutRedirect = '/ui/login') {
  try {
    const btnLogout = qs('#btnLogout');
    if (!btnLogout) return;
    if (btnLogout.dataset.bound === '1') return;
    btnLogout.dataset.bound = '1';
    btnLogout.addEventListener('click', async () => {
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
      try { window.location.replace(logoutRedirect); } catch { window.location.href = logoutRedirect; }
    });
  } catch {}
}
