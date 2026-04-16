import { fetchJSONAuth } from '../../api/http.api.js';

export async function mountRefresh({ content, profile }) {
  content.innerHTML = '<h3>トークン管理</h3>';
  const q = await fetchJSONAuth(`/api/admin/auth/refresh/list?userId=${encodeURIComponent(profile.id)}&page=1&pageSize=20`);
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(q, null, 2);
  content.appendChild(pre);
}
