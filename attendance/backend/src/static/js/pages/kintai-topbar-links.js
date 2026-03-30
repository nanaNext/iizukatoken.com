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
      const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
      const csrf = getCookie('csrfToken') || '';
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          credentials: 'include',
          body: JSON.stringify(rt ? { refreshToken: rt } : {})
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
})();
