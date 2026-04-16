import { logout } from '../api/auth.api.js';

const qs = (sel) => document.querySelector(sel);

export function wireAdminShell({ logoutRedirect = '/ui/login' } = {}) {
  wireTopbarHeightVar();
  wireUserMenu();
  wireMobileDrawer();
  wireLogout(logoutRedirect);
  wireTopbarSearch();
  wireUserInitials();
}

function firstChar(s) {
  try {
    const t = String(s || '').trim();
    if (!t) return '';
    const arr = Array.from(t);
    return arr.length ? arr[0] : '';
  } catch { return ''; }
}

export function wireUserInitials() {
  try {
    const btn = document.getElementById('userBtnInitial');
    const dd  = document.getElementById('userInitial');
    const nameEl = document.getElementById('userName');
    const apply = (full) => {
      const ch = firstChar(full);
      if (nameEl && full && !nameEl.textContent) nameEl.textContent = full;
      if (btn) { btn.textContent = ''; btn.setAttribute('data-initial', ch); }
      if (dd)  { dd.textContent  = ''; dd.setAttribute('data-initial', ch); }
    };
    let full = '';
    try {
      const uStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
      if (uStr) {
        const u = JSON.parse(uStr);
        full = (u && u.username) ? String(u.username).trim() : (u && u.email ? String(u.email).trim() : '');
      }
    } catch {}
    if (!full && nameEl && nameEl.textContent) full = nameEl.textContent.trim();
    if (full) {
      apply(full);
    } else {
      fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
        .then(r => r && r.ok ? r.json() : null)
        .then(p => {
          if (!p) return;
          try { sessionStorage.setItem('user', JSON.stringify(p)); } catch {}
          const f = String(p.username || '').trim() || String(p.email || '').trim();
          apply(f);
        })
        .catch(() => {});
    }
  } catch {}
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
      if (!dd.hasAttribute('hidden')) dd.setAttribute('hidden', '');
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    });
    document.addEventListener('click', (e) => {
      const a = e && e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (!dd.hasAttribute('hidden')) dd.setAttribute('hidden', '');
      try { btn.setAttribute('aria-expanded', 'false'); } catch {}
    }, true);

    // Theme submenu wiring (idempotent)
    const themeDrop = qs('#themeDropdown');
    if (themeDrop && themeDrop.dataset.bound !== '1') {
      themeDrop.dataset.bound = '1';
      const applyTheme = (val) => {
        if (val === 'system' || val === '') { try { document.documentElement.removeAttribute('data-theme'); } catch {} }
        else { document.documentElement.dataset.theme = val; }
        try { localStorage.setItem('theme', val); } catch {}
        Array.from(themeDrop.querySelectorAll('.theme-item')).forEach(el => {
          const v = el.getAttribute('data-value') || '';
          if (v === val) el.classList.add('sel'); else el.classList.remove('sel');
        });
      };
      try {
        const cur = (localStorage.getItem('theme') || 'system');
        applyTheme(cur);
      } catch { applyTheme('system'); }
      document.addEventListener('click', (e) => {
        const openBtn = e && e.target && e.target.closest ? e.target.closest('#btnTheme') : null;
        if (openBtn) { e.preventDefault(); e.stopPropagation(); themeDrop.removeAttribute('hidden'); return; }
        const backBtn = e && e.target && e.target.closest ? e.target.closest('#themeBack') : null;
        if (backBtn) { e.preventDefault(); themeDrop.setAttribute('hidden', ''); return; }
        const item = e && e.target && e.target.closest ? e.target.closest('.theme-item') : null;
        if (item && themeDrop.contains(item)) {
          e.preventDefault();
          const v = item.getAttribute('data-value') || 'system';
          applyTheme(v);
          return;
        }
      });
    }
  } catch {}
}

export function wireTopbarSearch() {
  try {
    const input = document.querySelector('.topbar .search input');
    if (!input) return;
    if (input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    const go = () => {
      const q = String(input.value || '').trim();
      const url = q ? `/admin/employees?q=${encodeURIComponent(q)}` : `/admin/employees`;
      try { window.location.assign(url); } catch { window.location.href = url; }
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
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
      try { window.location.replace(logoutRedirect); } catch { window.location.href = logoutRedirect; }
    });
  } catch {}
}
