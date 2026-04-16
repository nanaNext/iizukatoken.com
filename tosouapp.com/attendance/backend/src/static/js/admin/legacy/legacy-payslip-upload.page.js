import { listUsers } from '../../api/users.api.js';

export async function mountPayslipUpload({ content }) {
  content.innerHTML = '<h3>給与アップロード</h3>';
  const users = await listUsers();
  const form = document.createElement('form');
  form.enctype = 'multipart/form-data';
  form.innerHTML = `
    <select id="payUser">${users.map(u => `<option value="${u.id}">${u.id} ${u.username || u.email}</option>`).join('')}</select>
    <input id="payMonth" placeholder="YYYY-MM">
    <input id="payFile" type="file" accept="application/pdf">
    <button type="submit">アップロード</button>
  `;
  const result = document.createElement('div');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(document.querySelector('#payUser').value, 10);
    const month = document.querySelector('#payMonth').value.trim();
    const fileEl = document.querySelector('#payFile');
    if (!fileEl.files || !fileEl.files[0]) return alert('ファイルを選択してください');
    const fd = new FormData();
    fd.append('userId', String(userId));
    fd.append('month', month);
    fd.append('file', fileEl.files[0]);
    let tok = sessionStorage.getItem('accessToken') || '';
    const res = await fetch('/api/payslips/admin/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + tok }, body: fd, credentials: 'include' });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`; try { const j = await res.json(); msg = j.message || msg; } catch { }
      alert(msg); return;
    }
    const r = await res.json();
    result.textContent = `OK: id=${r.id}, user=${r.userId}, month=${r.month}`;
  });
  content.appendChild(form);
  content.appendChild(result);
}
