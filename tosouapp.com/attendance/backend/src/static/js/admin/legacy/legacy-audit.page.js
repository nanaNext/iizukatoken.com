import { fetchJSONAuth } from '../../api/http.api.js';

export async function mountAudit({ content }) {
  const r = await fetchJSONAuth('/api/admin/audit');
  content.innerHTML = '<h3>監査ログ</h3>';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(r, null, 2);
  content.appendChild(pre);
}
