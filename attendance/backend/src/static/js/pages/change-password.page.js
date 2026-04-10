const getCookie = (name) => {
  try {
    const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return m ? decodeURIComponent(m[2]) : null;
  } catch { return null; }
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('pwForm');
  const err = document.getElementById('pwError');
  const ok = document.getElementById('pwOk');
  const currentPwd = document.getElementById('currentPwd');
  const newPwd = document.getElementById('newPwd');
  const confirmPwd = document.getElementById('confirmPwd');
  const showErr = (msg) => { err.textContent = msg || ''; err.style.display = msg ? '' : 'none'; };
  const showOk = (msg) => { ok.textContent = msg || ''; ok.style.display = msg ? '' : 'none'; };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showErr(''); showOk('');
    const cur = String(currentPwd.value || '');
    const np = String(newPwd.value || '');
    const cp = String(confirmPwd.value || '');
    if (!cur || !np || !cp) { showErr('未入力の項目があります'); return; }
    if (np !== cp) { showErr('新しいパスワードが一致しません'); return; }
    const okConfirm = window.confirm('パスワードを変更します。よろしいですか？\n変更後は再ログインが必要になります。');
    if (!okConfirm) return;
    try {
      const csrf = getCookie('csrfToken') || '';
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: cur, newPassword: np })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showErr(j.message || '変更に失敗しました');
        return;
      }
      showOk('パスワードを変更しました。再ログインしてください。');
      try {
        await fetch('/api/auth/revoke-all', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } });
      } catch {}
      setTimeout(() => { try { location.href = '/ui/login'; } catch {} }, 1500);
    } catch (ex) {
      showErr(String(ex?.message || 'エラーが発生しました'));
    }
  });
});
