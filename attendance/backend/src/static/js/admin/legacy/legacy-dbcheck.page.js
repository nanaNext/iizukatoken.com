import { fetchJSONAuth } from '../../api/http.api.js';

export async function mountDbCheck({ content, hideNavSpinner }) {
  try {
    const r = await fetchJSONAuth('/api/admin/db/check');
    content.innerHTML = '<h3>DB検査</h3>';
    const wrap = document.createElement('div');
    const t1 = document.createElement('table');
    t1.style.width = '100%';
    t1.innerHTML = `
      <thead><tr><th>項目</th><th>値</th></tr></thead>
      <tbody>
        <tr><td>Database</td><td>${r.db || ''}</td></tr>
        <tr><td>Version</td><td>${r.version || ''}</td></tr>
        <tr><td>Users</td><td>${(r && r.users && r.users.total != null) ? r.users.total : 0}</td></tr>
        <tr><td>Active</td><td>${(r && r.users && r.users.active != null) ? r.users.active : 0}</td></tr>
        <tr><td>Inactive</td><td>${(r && r.users && r.users.inactive != null) ? r.users.inactive : 0}</td></tr>
        <tr><td>Retired</td><td>${(r && r.users && r.users.retired != null) ? r.users.retired : 0}</td></tr>
        <tr><td>Hire set</td><td>${(r && r.users && r.users.hire_set != null) ? r.users.hire_set : 0}</td></tr>
        <tr><td>Hire null</td><td>${(r && r.users && r.users.hire_null != null) ? r.users.hire_null : 0}</td></tr>
        <tr><td>Departments</td><td>${(r && r.departments && r.departments.total != null) ? r.departments.total : 0}</td></tr>
      </tbody>
    `;
    const t2 = document.createElement('table');
    t2.style.width = '100%';
    t2.innerHTML = '<thead><tr><th>ID</th><th>社員番号</th><th>氏名</th><th>Email</th><th>部署ID</th><th>状態</th><th>入社日</th></tr></thead>';
    const b2 = document.createElement('tbody');
    for (const u of (r.sampleUsers || [])) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.id}</td><td>${u.employee_code || ''}</td><td>${u.username || ''}</td><td>${u.email || ''}</td><td>${u.departmentId || ''}</td><td>${u.employment_status || ''}</td><td>${u.hire_date || ''}</td>`;
      b2.appendChild(tr);
    }
    t2.appendChild(b2);
    const t3 = document.createElement('table');
    t3.style.width = '100%';
    t3.innerHTML = '<thead><tr><th>テーブル</th><th>照合順序</th></tr></thead>';
    const b3 = document.createElement('tbody');
    for (const c of (r.collations || [])) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.table}</td><td>${c.collation}</td>`;
      b3.appendChild(tr);
    }
    t3.appendChild(b3);
    wrap.appendChild(t1);
    wrap.appendChild(document.createElement('hr'));
    wrap.appendChild(t2);
    wrap.appendChild(document.createElement('hr'));
    wrap.appendChild(t3);
    content.appendChild(wrap);
  } catch (err) {
    const msg = document.createElement('div');
    msg.style.color = '#b00020';
    msg.textContent = 'DB検査失敗: ' + ((err && err.message) ? err.message : 'unknown');
    content.appendChild(msg);
  }
  if (hideNavSpinner) hideNavSpinner();
}
