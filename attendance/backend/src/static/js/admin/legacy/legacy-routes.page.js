import { fetchJSONAuth } from '../../api/http.api.js';

export async function mountRoutes({ content }) {
  const r = await fetchJSONAuth('/api/debug/routes');
  content.innerHTML = '<h3>API一覧</h3>';
  const table = document.createElement('table');
  table.style.width = '100%';
  table.innerHTML = '<thead><tr><th>Path</th><th>Methods</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const it of (r.routes || [])) {
    const tr = document.createElement('tr');
    const methods = Array.isArray(it.methods) ? it.methods.join(', ').toUpperCase() : Object.keys(it.methods || {}).join(', ').toUpperCase();
    tr.innerHTML = `<td>${it.path}</td><td>${methods}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  content.appendChild(table);
}
