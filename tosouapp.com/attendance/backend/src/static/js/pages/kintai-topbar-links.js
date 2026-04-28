(function () {
  if (document.documentElement && document.documentElement.dataset.kintaiTopbarLinks === '1') return;
  try { document.documentElement.dataset.kintaiTopbarLinks = '1'; } catch {}

  function getCookie(name) {
    try {
      const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
      return m ? decodeURIComponent(m[2]) : null;
    } catch {
      return null;
    }
  }

  async function doLogout() {
    try {
      const csrf = getCookie('csrfToken') || '';
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify({})
        });
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
    } finally {
      try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('[data-action="logout"]');
    if (!a) return;
    e.preventDefault();
    doLogout();
  });

  const isMobile = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  let navLoadHideTimer = null;
  let navLoadShowTimer = null;

  const ensureNavLoadingStyle = () => {
    if (document.getElementById('navTransitionSpinnerStyle')) return;
    const st = document.createElement('style');
    st.id = 'navTransitionSpinnerStyle';
    st.textContent = `
      .nav-transition-spinner{
        position:fixed;inset:0;background:transparent;display:grid;place-items:center;z-index:99999;pointer-events:none
      }
      .nav-transition-spinner[hidden]{display:none}
      .nav-transition-ring{
        width:44px;height:44px;border-radius:999px;border:4px solid #dbeafe;border-top-color:#2563eb;
        animation:nav-spin .8s linear infinite
      }
      @keyframes nav-spin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(st);
  };

  const ensureNavLoadingEl = () => {
    let el = document.getElementById('navTransitionSpinner');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'navTransitionSpinner';
    el.className = 'nav-transition-spinner';
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="nav-transition-ring"></div>';
    document.body.appendChild(el);
    return el;
  };

  const hideNavLoading = () => {
    try {
      const el = document.getElementById('navTransitionSpinner');
      if (el) el.setAttribute('hidden', '');
      if (navLoadShowTimer) clearTimeout(navLoadShowTimer);
      navLoadShowTimer = null;
      if (navLoadHideTimer) clearTimeout(navLoadHideTimer);
      navLoadHideTimer = null;
    } catch {}
  };

  const showNavLoading = (delayMs = 1200) => {
    try {
      if (navLoadShowTimer) clearTimeout(navLoadShowTimer);
      navLoadShowTimer = setTimeout(() => {
        ensureNavLoadingStyle();
        const el = ensureNavLoadingEl();
        el.removeAttribute('hidden');
        if (navLoadHideTimer) clearTimeout(navLoadHideTimer);
        navLoadHideTimer = setTimeout(() => hideNavLoading(), 4000);
      }, Math.max(0, Number(delayMs) || 0));
    } catch {}
  };

  const shouldShowForAnchor = (a, e) => {
    if (!a) return false;
    if (a.dataset?.noNavSpinner === '1') return false;
    if (a.hasAttribute('download')) return false;
    const target = String(a.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return false;
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return false;
    const hrefRaw = String(a.getAttribute('href') || '').trim();
    if (!hrefRaw || hrefRaw === '#' || hrefRaw.startsWith('#')) return false;
    if (/^(mailto:|tel:|javascript:)/i.test(hrefRaw)) return false;
    let to = null;
    try { to = new URL(hrefRaw, location.href); } catch { return false; }
    if (to.origin !== location.origin) return false;
    if (to.pathname === location.pathname && to.search === location.search && (to.hash || '') === (location.hash || '')) return false;
    if (to.pathname === location.pathname && to.search === location.search && to.hash && to.hash !== location.hash) return false;
    return true;
  };

  const bindGlobalNavLoading = () => {
    if (document.documentElement.dataset.navTransitionBound === '1') return;
    document.documentElement.dataset.navTransitionBound = '1';
    // Disable global nav loading overlay to avoid topbar/search flicker on page transitions.
    window.addEventListener('pageshow', () => hideNavLoading());
  };

  const targetEl = (e) => {
    const t = e && e.target;
    if (!t) return null;
    return t.nodeType === 3 ? t.parentElement : t;
  };

  const ensureMobileMenu = () => {
    const brand = document.querySelector('.kintai-brand');
    if (!brand) return;
    if (document.getElementById('mobileMenuBtn')) return;
    const nameText = String(
      (document.querySelector('#staffName')?.textContent || '') ||
      (globalThis.AttendanceMonthly && globalThis.AttendanceMonthly.Controller && globalThis.AttendanceMonthly.Controller.ctx && (globalThis.AttendanceMonthly.Controller.ctx.profile?.username || globalThis.AttendanceMonthly.Controller.ctx.profile?.email)) ||
      '—'
    ).trim();
    const btn = document.createElement('button');
    btn.id = 'mobileMenuBtn';
    btn.className = 'mobile-btn';
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'menu');
    btn.setAttribute('aria-controls', 'mobileDrawer');
    btn.textContent = '☰';
      const logo = brand.querySelector('.kintai-logo');
      if (logo) brand.insertBefore(btn, logo);
      else brand.insertBefore(btn, brand.firstChild);
    let backdrop = document.getElementById('mobileDrawerBackdrop');
    let drawer = document.getElementById('mobileDrawer');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobileDrawerBackdrop';
      backdrop.className = 'mobile-drawer-backdrop';
      document.body.appendChild(backdrop);
    }
    if (!drawer) {
      drawer = document.createElement('aside');
      drawer.id = 'mobileDrawer';
      drawer.className = 'mobile-drawer';
      drawer.innerHTML = `
        <div class="mobile-drawer-header">
          <div class="mobile-drawer-user">
            <span class="mobile-drawer-user-name">${nameText}</span>
          </div>
          <button class="mobile-drawer-close" type="button" aria-label="閉じる">×</button>
        </div>
        <input id="mobileDrawerSearch" class="mobile-drawer-search" type="text" placeholder="Search...">
        <div class="mobile-menu-list" id="mobileMenuList">
          <div class="drawer-group">
            <button class="drawer-group-btn" type="button" data-group="att">勤怠入力 <span class="drawer-chev" aria-hidden="true">›</span></button>
            <div class="drawer-group-list" data-group-panel="att" hidden>
              <a href="/ui/attendance">個人カレンダー登録画面</a>
              <a href="/ui/attendance/monthly">月次勤怠入力へ</a>
              <a href="/ui/attendance/simple">簡易登録画面</a>
            </div>
          </div>
          <div class="drawer-group">
            <button class="drawer-group-btn" type="button" data-group="leave">有給管理 <span class="drawer-chev" aria-hidden="true">›</span></button>
            <div class="drawer-group-list" data-group-panel="leave" hidden>
              <a href="/ui/leave-ledger">休暇欠勤台帳</a>
            </div>
          </div>
          <div class="drawer-group">
            <button class="drawer-group-btn" type="button" data-group="common">共通機能 <span class="drawer-chev" aria-hidden="true">›</span></button>
            <div class="drawer-group-list" data-group-panel="common" hidden>
              <a href="/ui/admin?tab=settings">パスワード変更画面</a>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(drawer);
      const search = drawer.querySelector('#mobileDrawerSearch');
      const list = drawer.querySelector('#mobileMenuList');
      if (search && list) {
        search.addEventListener('input', () => {
          const q = search.value.toLowerCase();
          list.querySelectorAll('a').forEach(a => {
            const t = a.textContent.toLowerCase();
            a.style.display = t.includes(q) ? '' : 'none';
          });
        });
      }
      const closeBtn = drawer.querySelector('.mobile-drawer-close');
      closeBtn?.addEventListener('click', () => {
        document.body.classList.remove('mobile-drawer-open');
        btn.setAttribute('aria-expanded', 'false');
      });
      backdrop.addEventListener('click', () => {
        document.body.classList.remove('mobile-drawer-open');
        btn.setAttribute('aria-expanded', 'false');
        drawer.style.transform = 'translateX(-100%)';
        backdrop.style.display = 'none';
      });
      drawer.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => closeMenu());
      });
      drawer.querySelectorAll('.drawer-group-btn').forEach(btn2 => {
        btn2.addEventListener('click', () => {
          const key = btn2.dataset.group || '';
          const panel = drawer.querySelector(`.drawer-group-list[data-group-panel="${CSS.escape(key)}"]`);
          if (!panel) return;
          const open = panel.hasAttribute('hidden');
          if (open) {
            panel.removeAttribute('hidden');
            btn2.classList.add('open');
          } else {
            panel.setAttribute('hidden', '');
            btn2.classList.remove('open');
          }
        });
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.body.classList.remove('mobile-drawer-open');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    const closeMenu = () => {
        btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('mobile-drawer-open');
      if (drawer) drawer.style.transform = 'translateX(-100%)';
      const bp = document.getElementById('mobileDrawerBackdrop');
      if (bp) bp.style.display = 'none';
      };
      const toggleMenu = () => {
      const open = !document.body.classList.contains('mobile-drawer-open');
        if (open) {
          btn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('mobile-drawer-open');
        if (drawer) drawer.style.transform = 'translateX(0)';
        const bp = document.getElementById('mobileDrawerBackdrop');
        if (bp) bp.style.display = 'block';
        } else {
          closeMenu();
        }
      };
    const handler = (e) => { e.preventDefault(); e.stopPropagation(); toggleMenu(); };
    btn.addEventListener('click', handler, { passive: false });
    btn.addEventListener('touchstart', handler, { passive: false });
      document.addEventListener('click', (e) => {
        const t = targetEl(e);
        if (!t) return;
        if (!t.closest('.kintai-top') || t.closest('#mobileMenuBtn')) return;
        closeMenu();
      });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    if (!document.documentElement.dataset.mobileDrawerGestures) {
      document.documentElement.dataset.mobileDrawerGestures = '1';
      let sx = null, sy = null;
      document.addEventListener('touchstart', (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        sx = t.clientX; sy = t.clientY;
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        const t = e.touches && e.touches[0];
        if (!t || sx == null) return;
        const dx = t.clientX - sx;
        const ady = Math.abs((t.clientY || 0) - (sy || 0));
        if (!document.body.classList.contains('mobile-drawer-open')) {
          if (sx < 20 && dx > 40 && ady < 30) {
            e.preventDefault();
            btn.click();
            sx = null; sy = null;
          }
        } else {
          if (dx < -40 && ady < 30) {
            e.preventDefault();
            closeMenu();
            sx = null; sy = null;
          }
        }
      }, { passive: false });
      document.addEventListener('touchend', () => { sx = null; sy = null; }, { passive: true });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    try { document.body.classList.add('nav-js'); } catch {}
    try { bindGlobalNavLoading(); } catch {}
    try { ensureMobileMenu(); } catch {}
    window.addEventListener('resize', () => { try { ensureMobileMenu(); } catch {} }, { passive: true });
    try {
      if (document.documentElement?.dataset?.kintaiTopNavDdBound === '1') return;
      document.documentElement.dataset.kintaiTopNavDdBound = '1';
      const nav = document.querySelector('.kintai-nav');
      if (nav) {
        const dds = Array.from(nav.querySelectorAll('.kintai-nav-dd'));
        const closeAll = () => {
          dds.forEach(dd2 => {
            dd2.classList.remove('open');
            const panel2 = dd2.querySelector('.kintai-dd');
            panel2?.setAttribute('hidden', '');
            panel2?.classList?.remove?.('show');
            try {
              panel2.style.removeProperty('display');
              panel2.style.removeProperty('visibility');
              panel2.style.removeProperty('opacity');
              panel2.style.removeProperty('pointer-events');
              panel2.style.removeProperty('position');
              panel2.style.removeProperty('top');
              panel2.style.removeProperty('left');
              panel2.style.removeProperty('right');
              panel2.style.removeProperty('max-width');
              panel2.style.removeProperty('max-height');
              panel2.style.removeProperty('overflow');
              panel2.style.removeProperty('z-index');
              panel2.style.removeProperty('transform');
            } catch {}
            const btn2 = dd2.querySelector('.kintai-nav-btn');
            btn2?.setAttribute('aria-expanded', 'false');
          });
        };
        dds.forEach(dd2 => {
          const btn2 = dd2.querySelector('.kintai-nav-btn');
          const panel2 = dd2.querySelector('.kintai-dd');
          if (!btn2 || !panel2) return;
          let lastToggleAt = 0;
          const toggleDropdown = (e) => {
            try { e.preventDefault(); e.stopPropagation(); } catch {}
            const isOpen = !panel2.hasAttribute('hidden');
            closeAll();
            if (!isOpen) {
              dd2.classList.add('open');
              panel2.removeAttribute('hidden');
              try { panel2.hidden = false; } catch {}
              try {
                panel2.classList.add('show');
                panel2.style.setProperty('display', 'block', 'important');
                panel2.style.setProperty('visibility', 'visible', 'important');
                panel2.style.setProperty('opacity', '1', 'important');
                panel2.style.setProperty('pointer-events', 'auto', 'important');
                if (isMobile()) {
                  const r = btn2.getBoundingClientRect();
                  const gap = 4;
                  const top = Math.round(r.bottom + gap);
                  let left = Math.round(r.left);
                  panel2.style.position = 'fixed';
                  panel2.style.top = `${top}px`;
                  panel2.style.left = `${left}px`;
                  panel2.style.right = 'auto';
                  panel2.style.zIndex = '3200';
                  panel2.style.maxWidth = '90vw';
                  panel2.style.maxHeight = 'calc(100vh - 72px)';
                  panel2.style.overflow = 'auto';
                  try {
                    const w = panel2.offsetWidth || 0;
                    const maxLeft = Math.max(6, (window.innerWidth || 0) - w - 6);
                    left = Math.min(left, maxLeft);
                    panel2.style.left = `${left}px`;
                  } catch {}
                  try { panel2.style.transform = 'none'; } catch {}
                }
              } catch {}
              btn2.setAttribute('aria-expanded', 'true');
            }
          };
          const onTouchLike = (e) => {
            const now = Date.now();
            if (now - lastToggleAt < 300) {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              return;
            }
            lastToggleAt = now;
            toggleDropdown(e);
          };
          const onClick = (e) => {
            const now = Date.now();
            if (now - lastToggleAt < 700) {
              try { e.preventDefault(); e.stopPropagation(); } catch {}
              return;
            }
            lastToggleAt = now;
            toggleDropdown(e);
          };
          btn2.addEventListener('pointerdown', onTouchLike, { passive: false });
          btn2.addEventListener('touchstart', onTouchLike, { passive: false });
          btn2.addEventListener('click', onClick, { passive: false });
          btn2.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') toggleDropdown(e);
          }, { passive: false });
          // Close menus only when clicking outside or pressing Escape; avoid closing on mouseenter to prevent flicker
        });
        document.addEventListener('click', (e) => {
          const t = targetEl(e);
          if (!t) return;
          if (t.closest('.kintai-nav')) return;
          closeAll();
        }, { passive: true });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); }, { passive: true });
      }
    } catch {}
  });

  // Auto-logout on inactivity (idle timeout)
  (function setupIdleTimeout() {
    const IDLE_MS = 15 * 60 * 1000; // 15 minutes
    let idleTimer = null;
    const resetIdle = () => {
      try { clearTimeout(idleTimer); } catch {}
      idleTimer = setTimeout(() => {
        try { doLogout(); } catch {}
        try { location.href = '/ui/login?timeout=1'; } catch {}
      }, IDLE_MS);
    };
    ['click','keydown','mousemove','touchstart','scroll','visibilitychange'].forEach(ev => {
      document.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  })();
})();
