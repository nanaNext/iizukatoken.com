import { delegate } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';

const rowsByContent = new WeakMap();
const depsByContent = new WeakMap();

function ensureUserClickHandler(content) {
  try {
    if (!content || content.dataset.usersBound === '1') return;
    content.dataset.usersBound = '1';
    delegate(content, '[data-action]', 'click', async (_e, btn) => {
      const action = btn.dataset.action || '';
      const id = btn.dataset.id || '';
      const rows = rowsByContent.get(content) || [];
      const deps = depsByContent.get(content) || {};
      const { listUsers, deleteUserAccount, resetUserPassword } = deps;

      if (action === 'delete') {
        if (confirm('削除しますか？')) {
          await deleteUserAccount(id);
          await mountUsers({ content, fetchJSONAuth, listUsers, deleteUserAccount, resetUserPassword });
        }
        return;
      }
      if (action === 'resetpw') {
        const newPw = prompt('新しいパスワードを入力');
        if (newPw && newPw.length >= 6) {
          await resetUserPassword(id, newPw);
          alert('PW更新しました');
        }
        return;
      }
      if (action === 'lock') {
        const minsStr = prompt('ロック分数 (既定: 60)');
        const minutes = parseInt(minsStr || '60', 10);
        await api.patch(`/api/admin/users/${id}/lock`, { minutes });
        alert('ロックしました');
        return;
      }
      if (action === 'unlock') {
        await api.patch(`/api/admin/users/${id}/unlock`);
        alert('ロック解除しました');
        return;
      }
      if (action === 'detail') {
        const u = rows.find(x => String(x.id) === String(id));
        if (u) {
          alert(`ID: ${u.id}\n名前: ${u.username || ''}\nEmail: ${u.email || ''}\nRole: ${u.role || ''}`);
        }
      }
    });
  } catch {}
}

export async function mountUsers({ content, listUsers, deleteUserAccount, resetUserPassword }) {
  if (!content) return;
  const rows = await listUsers();
  depsByContent.set(content, { listUsers, deleteUserAccount, resetUserPassword });
  rowsByContent.set(content, rows);
  ensureUserClickHandler(content);
  content.innerHTML = '<h3>ユーザー一覧</h3>';
  const table = document.createElement('table');
  table.style.width = 'auto';
  table.style.minWidth = '880px';
  table.style.tableLayout = 'auto';
  table.innerHTML = '<thead><tr><th>ID</th><th>名前</th><th>Email</th><th>Role</th><th>操作</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.username || ''}</td>
      <td>${r.email || ''}</td>
      <td>${r.role || ''}</td>
      <td>
        <button data-action="detail" data-id="${r.id}">詳細</button>
        <button data-action="resetpw" data-id="${r.id}">PWリセット</button>
        <button data-action="lock" data-id="${r.id}">ロック</button>
        <button data-action="unlock" data-id="${r.id}">ロック解除</button>
        <button data-action="delete" data-id="${r.id}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  content.appendChild(table);
}
