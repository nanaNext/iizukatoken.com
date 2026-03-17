import { fetchJSONAuth } from '../../api/http.api.js';

export async function requireAdmin() {
  let profile = null;
  try {
    profile = await fetchJSONAuth('/api/auth/me');
  } catch {}
  const role = String(profile?.role || '').toLowerCase();
  if (!profile || (role !== 'admin' && role !== 'manager')) {
    try {
      const err = document.querySelector('#error');
      if (err) {
        err.style.display = 'block';
        err.textContent = profile ? '管理者権限が必要です。従業員ポータルへ移動してください。' : 'ログインが必要です。もう一度ログインしてください。';
      }
    } catch {}
    try {
      const sp = document.querySelector('#pageSpinner');
      if (sp) { sp.setAttribute('hidden', ''); sp.style.display = 'none'; }
    } catch {}
    try { window.location.replace('/ui/login'); } catch {}
    return null;
  }
  return profile;
}
