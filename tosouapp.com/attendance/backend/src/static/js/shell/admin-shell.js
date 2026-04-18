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
    if (document.body.dataset.userMenuDelegated === '1') return;
    document.body.dataset.userMenuDelegated = '1';
    const closeAllUserMenus = () => {
      try {
        document.querySelectorAll('.user .dropdown').forEach((dd) => dd.setAttribute('hidden', ''));
        document.querySelectorAll('.user .user-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      } catch {}
    };
    const closeAllSubMenus = () => {
      try { document.querySelectorAll('.subbar .menu.open').forEach((m) => m.classList.remove('open')); } catch {}
    };
    const placeDropdown = (btn, dd) => {
      try {
        const r = btn.getBoundingClientRect();
        const minW = 220;
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const left = Math.max(8, Math.min((r.right - minW), vw - minW - 8));
        const top = Math.max(8, r.bottom + 6);
        dd.style.position = 'fixed';
        dd.style.left = `${left}px`;
        dd.style.top = `${top}px`;
        dd.style.right = 'auto';
        dd.style.zIndex = '2147483000';
        dd.style.minWidth = `${minW}px`;
      } catch {}
    };
    const clearDropdownPlacement = (dd) => {
      try {
        dd.style.position = '';
        dd.style.left = '';
        dd.style.top = '';
        dd.style.right = '';
        dd.style.zIndex = '';
        dd.style.minWidth = '';
      } catch {}
    };
    const emergencyBtnId = 'emergencyUserBtn';
    const emergencyPanelId = 'emergencyUserPanel';
    const closeEmergencyPanel = () => {
      try {
        const p = document.getElementById(emergencyPanelId);
        if (p) {
          p.setAttribute('hidden', '');
          p.style.display = 'none';
          p.style.visibility = 'hidden';
          p.style.opacity = '0';
        }
      } catch {}
    };
    const openEmergencyPanel = () => {
      try {
        const p = ensureEmergencyUserPanel();
        if (!p) return;
        p.removeAttribute('hidden');
        p.style.display = 'block';
        p.style.visibility = 'visible';
        p.style.opacity = '1';
      } catch {}
    };
    const ensureEmergencyUserPanel = () => {
      try {
        let p = document.getElementById(emergencyPanelId);
        if (p) return p;
        p = document.createElement('div');
        p.id = emergencyPanelId;
        p.setAttribute('hidden', '');
        p.style.position = 'fixed';
        p.style.top = '46px';
        p.style.right = '10px';
        p.style.minWidth = '220px';
        p.style.background = '#fff';
        p.style.border = '1px solid #cfe0f5';
        p.style.borderRadius = '10px';
        p.style.boxShadow = '0 8px 24px rgba(0,0,0,.16)';
        p.style.zIndex = '2147483647';
        p.style.padding = '8px';
        p.style.display = 'none';
        p.style.visibility = 'hidden';
        p.style.opacity = '0';
        p.innerHTML = `
          <a href="/admin/system/settings" style="display:block;padding:10px 12px;border-radius:8px;text-decoration:none;color:#0f172a;">Account settings</a>
          <button type="button" id="emergencyLogoutBtn" style="display:block;width:100%;text-align:left;padding:10px 12px;border:0;background:transparent;border-radius:8px;cursor:pointer;color:#0f172a;">Sign out</button>
        `;
        document.body.appendChild(p);
        const outBtn = p.querySelector('#emergencyLogoutBtn');
        if (outBtn) {
          outBtn.addEventListener('click', async () => {
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
          });
        }
        return p;
      } catch {}
      return null;
    };
    const toggleEmergencyPanel = () => {
      try {
        closeAllSubMenus();
        closeAllUserMenus();
        const p = ensureEmergencyUserPanel();
        if (!p) return;
        const hidden = p.hasAttribute('hidden');
        if (hidden) openEmergencyPanel();
        else closeEmergencyPanel();
      } catch {}
    };
    const ensureEmergencyUserButton = () => {
      try {
        if (document.getElementById(emergencyBtnId)) return;
        const srcBtn = document.querySelector('.user .user-btn');
        if (!srcBtn) return;
        const emBtn = document.createElement('button');
        emBtn.id = emergencyBtnId;
        emBtn.type = 'button';
        emBtn.setAttribute('aria-label', 'user menu');
        emBtn.style.position = 'fixed';
        emBtn.style.top = '8px';
        emBtn.style.right = '10px';
        emBtn.style.width = '34px';
        emBtn.style.height = '34px';
        emBtn.style.borderRadius = '999px';
        emBtn.style.border = '2px solid #0b2c66';
        emBtn.style.background = '#d1fae5';
        emBtn.style.color = '#065f46';
        emBtn.style.fontWeight = '800';
        emBtn.style.fontSize = '12px';
        emBtn.style.lineHeight = '1';
        emBtn.style.display = 'inline-flex';
        emBtn.style.alignItems = 'center';
        emBtn.style.justifyContent = 'center';
        emBtn.style.zIndex = '2147483647';
        emBtn.style.cursor = 'pointer';
        emBtn.style.pointerEvents = 'auto';
        emBtn.style.touchAction = 'manipulation';
        const syncInitial = () => {
          try {
            const initialEl = document.getElementById('userBtnInitial');
            const ch = (initialEl && initialEl.getAttribute('data-initial')) || '';
            emBtn.textContent = String(ch || '人').slice(0, 1);
          } catch {}
        };
        syncInitial();
        setTimeout(syncInitial, 400);
        emBtn.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          toggleEmergencyPanel();
        }, true);
        emBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        }, true);
        document.body.appendChild(emBtn);
        ensureEmergencyUserPanel();
      } catch {}
    };
    ensureEmergencyUserButton();
    document.addEventListener('pointerdown', (e) => {
      const t = e && e.target;
      const hit = t && t.closest ? t.closest(`.user .user-btn, .user #userBtnInitial, .user .ud-avatar, .user .caret`) : null;
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        const btn = (hit.classList && hit.classList.contains('user-btn')
          ? hit
          : (hit.closest && hit.closest('.user') ? hit.closest('.user').querySelector('.user-btn') : null));
        const root = btn && btn.closest ? btn.closest('.user') : null;
        const dd = root ? root.querySelector('.dropdown') : null;
        if (!btn || !dd) return;
        closeAllSubMenus();
        const hidden = dd.hasAttribute('hidden');
        closeAllUserMenus();
        if (hidden) {
          placeDropdown(btn, dd);
          dd.removeAttribute('hidden');
          try { btn.setAttribute('aria-expanded', 'true'); } catch {}
        } else {
          clearDropdownPlacement(dd);
        }
        return;
      }
      const inside = t && t.closest ? t.closest(`.user-menu, #${emergencyBtnId}, #${emergencyPanelId}`) : null;
      if (inside) return;
      closeEmergencyPanel();
      closeAllUserMenus();
    }, true);
    window.addEventListener('resize', () => {
      try {
        const btn = document.querySelector('.user .user-btn[aria-expanded="true"]');
        if (!btn) return;
        const root = btn.closest('.user');
        const dd = root ? root.querySelector('.dropdown') : null;
        if (!dd || dd.hasAttribute('hidden')) return;
        placeDropdown(btn, dd);
      } catch {}
    });
    window.addEventListener('scroll', () => {
      try {
        document.querySelectorAll('.user .dropdown').forEach((dd) => {
          if (dd.hasAttribute('hidden')) return;
          dd.setAttribute('hidden', '');
          clearDropdownPlacement(dd);
        });
        document.querySelectorAll('.user .user-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      } catch {}
      closeEmergencyPanel();
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
