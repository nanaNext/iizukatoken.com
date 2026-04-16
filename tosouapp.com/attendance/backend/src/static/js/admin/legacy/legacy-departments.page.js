import { delegate, $ } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';

export async function mountDepartments({ content, listDepartments, listUsers }) {
  if (!content) return;
  const rows = await listDepartments();
  const users = await listUsers();
  content.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'dept-page';
  page.innerHTML = `
    <div class="dept-head">
      <h3 class="dept-title">部門管理</h3>
      <form id="deptCreateForm" class="dept-create">
        <label class="dept-label" for="deptName">新規</label>
        <input id="deptName" class="dept-input" placeholder="例: 総務部">
        <button type="submit" class="dept-btn primary">作成</button>
      </form>
    </div>
  `;
  content.appendChild(page);

  const form = page.querySelector('#deptCreateForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = page.querySelector('#deptName');
    const name = String((nameEl && nameEl.value != null) ? nameEl.value : '').trim();
    if (!name) return;
    await api.post('/api/admin/departments', { name });
    await mountDepartments({ content, listDepartments, listUsers });
  });

  const table = document.createElement('table');
  table.className = 'dept-table';
  table.innerHTML = '<thead><tr><th style="width:80px;">ID</th><th style="width:160px;">コード</th><th>名前</th><th style="width:260px;">操作</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const d of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.id}</td>
      <td><input class="dept-input dept-input-sm" data-dept-code="${d.id}" value="${d.code || ''}" placeholder="例: HR, ENG"></td>
      <td><input class="dept-input" data-dept-name="${d.id}" value="${d.name}"></td>
      <td>
        <div class="dept-actions">
          <button class="dept-btn" type="button" data-action="save" data-id="${d.id}">保存</button>
          <button class="dept-btn danger" type="button" data-action="delete" data-id="${d.id}">削除</button>
          <button class="dept-btn" type="button" data-action="users" data-id="${d.id}">社員一覧</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const tableWrap = document.createElement('div');
  tableWrap.className = 'dept-table-wrap';
  tableWrap.appendChild(table);
  page.appendChild(tableWrap);

  const listDiv = document.createElement('div');
  listDiv.className = 'dept-users';
  page.appendChild(listDiv);

  delegate(page, 'button[data-action]', 'click', async (_e, btn) => {
    const action = btn.dataset.action || '';
    const id = btn.dataset.id || '';
    if (action === 'save') {
      const nameEl = $(`input[data-dept-name="${id}"]`, page);
      const codeEl = $(`input[data-dept-code="${id}"]`, page);
      const name = String((nameEl && nameEl.value != null) ? nameEl.value : '').trim();
      const code = String((codeEl && codeEl.value != null) ? codeEl.value : '').trim() || null;
      await api.patch(`/api/admin/departments/${id}`, { name, code });
      alert('保存しました');
      return;
    }
    if (action === 'delete') {
      if (confirm('削除しますか？')) {
        await api.del(`/api/admin/departments/${id}`);
        await mountDepartments({ content, listDepartments, listUsers });
      }
      return;
    }
    if (action === 'users') {
      const list = users.filter(u => String(u.departmentId || '') === String(id));
      listDiv.innerHTML = '<h4 class="dept-users-title">所属社員</h4>';
      const ul = document.createElement('ul');
      ul.className = 'dept-users-list';
      for (const u of list) {
        const li = document.createElement('li');
        li.textContent = `${u.id} ${u.username || u.email}`;
        ul.appendChild(li);
      }
      listDiv.appendChild(ul);
    }
  });
}
