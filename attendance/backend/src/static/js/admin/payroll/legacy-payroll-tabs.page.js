import { delegate } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';

function ensurePayrollNavStyle() {
  try {
    if (document.getElementById('payrollNavStyle')) return;
    const st = document.createElement('style');
    st.id = 'payrollNavStyle';
    st.textContent = `
      .pe-nav{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px 0}
      .pe-nav a{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#0f172a;font-weight:900;text-decoration:none}
      .pe-nav a:hover{border-color:#94a3b8}
      .pe-nav a.active{background:#0f172a;border-color:#0f172a;color:#fff}
    `;
    document.head.appendChild(st);
  } catch {}
}

function tabHref(tab) {
  const p = String(window.location.pathname || '');
  const base = p.startsWith('/admin/payroll') ? p : '/ui/admin';
  return `${base}?tab=${encodeURIComponent(String(tab || ''))}`;
}

function mountNav(activeTab) {
  const nav = document.createElement('div');
  nav.className = 'pe-nav';
  nav.innerHTML = `
    <a class="${activeTab === 'salary_list' ? 'active' : ''}" href="${tabHref('salary_list')}">給与一覧</a>
    <a class="${activeTab === 'salary_calc' ? 'active' : ''}" href="${tabHref('salary_calc')}">給与計算</a>
    <a class="${activeTab === 'payroll_editor' ? 'active' : ''}" href="${tabHref('payroll_editor')}">給与入力</a>
    <a class="${activeTab === 'salary_send' ? 'active' : ''}" href="${tabHref('salary_send')}">給与明細送信</a>
  `;
  return nav;
}

export async function mountSalaryList({ content }) {
  if (!content) return;
  content.innerHTML = '<h3>給与一覧</h3>';
  ensurePayrollNavStyle();
  content.appendChild(mountNav('salary_list'));

  const form = document.createElement('form');
  form.innerHTML = `
    <input id="salUserId" type="number" placeholder="userId(任意)">
    <input id="salMonth" placeholder="YYYY-MM(任意)">
    <button type="submit">表示</button>
  `;
  const result = document.createElement('div');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.querySelector('#salUserId').value.trim();
    const month = document.querySelector('#salMonth').value.trim();
    const qs = [];
    if (userId) qs.push(`userId=${encodeURIComponent(userId)}`);
    if (month) qs.push(`month=${encodeURIComponent(month)}`);
    const r = await api.get(`/api/admin/salary/history${qs.length ? '?' + qs.join('&') : ''}`);
    result.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>Month</th><th>Created</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const row of ((r && Array.isArray(r.data)) ? r.data : [])) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.id}</td><td>${row.userId}</td><td>${row.month}</td><td>${row.created_at}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    result.appendChild(table);
  });
  content.appendChild(form);
  content.appendChild(result);
}

export async function mountSalaryCalc({ content, listUsers }) {
  if (!content) return;
  content.innerHTML = '<h3>給与計算</h3>';
  ensurePayrollNavStyle();
  content.appendChild(mountNav('salary_calc'));

  const users = await listUsers();
  const sel = document.createElement('select');
  sel.id = 'salaryUserIds';
  sel.multiple = true;
  sel.style.minWidth = '280px';
  for (const u of users) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = `${u.id} ${u.username || u.email}`;
    sel.appendChild(opt);
  }
  const form = document.createElement('form');
  form.innerHTML = `
    <input id="salaryMonth" placeholder="YYYY-MM">
    <button type="submit">プレビュー</button>
    <button type="button" data-action="close-month">月締め</button>
    <button type="button" data-action="export-csv">CSV</button>
  `;
  content.appendChild(sel);
  content.appendChild(form);
  const result = document.createElement('div');
  content.appendChild(result);

  function getSelectedIds() {
    return Array.from(sel.selectedOptions).map(o => o.value);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ids = getSelectedIds();
    const month = document.querySelector('#salaryMonth').value.trim();
    if (!ids.length || !month) return alert('ユーザーと月を選択');
    const r = await api.get(`/api/admin/salary?userIds=${encodeURIComponent(ids.join(','))}&month=${encodeURIComponent(month)}`);
    result.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>User</th><th>氏名</th><th>月</th><th>総支給額</th><th>差引支給額</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const e1 of ((r && Array.isArray(r.employees)) ? r.employees : [])) {
      const tr = document.createElement('tr');
      const totals = (e1 && e1['合計'] && typeof e1['合計'] === 'object') ? e1['合計'] : {};
      tr.innerHTML = `<td>${e1.userId}</td><td>${e1.氏名 || ''}</td><td>${e1.対象年月}</td><td>${totals['総支給額'] || 0}</td><td>${totals['差引支給額'] || 0}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    result.appendChild(table);
    result.dataset.csv = JSON.stringify((r && Array.isArray(r.employees)) ? r.employees : []);
  });
  delegate(form, 'button[data-action]', 'click', async (_e, btn) => {
    const action = btn.dataset.action || '';
    if (action === 'close-month') {
      const ids = getSelectedIds();
      const month = document.querySelector('#salaryMonth').value.trim();
      if (!ids.length || !month) return alert('ユーザーと月を選択');
      const r = await api.post('/api/admin/salary/close-month', { userIds: ids.join(','), month });
      alert(`締め処理: ${r.closed} 件`);
      return;
    }
    if (action === 'export-csv') {
      try {
        const arr = JSON.parse(result.dataset.csv || '[]');
        let csv = 'userId,name,month,total_gross,total_net\n';
        for (const e1 of arr) {
          const totals = (e1 && e1['合計'] && typeof e1['合計'] === 'object') ? e1['合計'] : {};
          csv += `${e1.userId},${e1.氏名 || ''},${e1.対象年月},${totals['総支給額'] || 0},${totals['差引支給額'] || 0}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'salary.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    }
  });
}

export async function mountPayslipSend({ content, listUsers }) {
  if (!content) return;
  content.innerHTML = '<h3>給与明細送信</h3>';
  ensurePayrollNavStyle();
  content.appendChild(mountNav('salary_send'));

  const users = await listUsers();
  const sel = document.createElement('select');
  sel.id = 'sendUserIds';
  sel.multiple = true;
  sel.style.minWidth = '280px';
  for (const u of users) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = `${u.id} ${u.username || u.email}`;
    sel.appendChild(opt);
  }
  const form = document.createElement('form');
  form.innerHTML = `
    <input id="sendMonth" placeholder="YYYY-MM">
    <button type="submit">検索</button>
    <button type="button" data-action="open-all">全て開く</button>
    <button type="button" data-action="export-links">CSVリンク</button>
  `;
  const result = document.createElement('div');
  const list = document.createElement('ul');
  result.appendChild(list);
  content.appendChild(sel);
  content.appendChild(form);
  content.appendChild(result);

  function getSelectedIds() {
    return Array.from(sel.selectedOptions).map(o => o.value);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    list.innerHTML = '';
    const ids = getSelectedIds();
    const month = document.querySelector('#sendMonth').value.trim();
    if (!ids.length || !month) return alert('ユーザーと月を選択');
    const links = [];
    for (const id of ids) {
      try {
          const r = await api.get(`/api/payslips/admin/list?userId=${encodeURIComponent(id)}&month=${encodeURIComponent(month)}&page=1&pageSize=1`);
        const it = ((r && Array.isArray(r.data)) ? r.data : [])[0];
        if (it) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = it.secureUrl;
          a.target = '_blank';
          a.textContent = `${id} ${it.originalName || it.month}`;
          li.appendChild(a);
          list.appendChild(li);
          links.push({ userId: id, month: it.month, url: location.origin + it.secureUrl });
        } else {
          const li = document.createElement('li');
          li.textContent = `${id} 該当月の明細なし`;
          list.appendChild(li);
        }
      } catch (err) {
        const li = document.createElement('li');
        li.textContent = `${id} 取得失敗: ${(err && err.message) ? err.message : 'error'}`;
        list.appendChild(li);
      }
    }
    result.dataset.links = JSON.stringify(links);
  });
  delegate(form, 'button[data-action]', 'click', (_e, btn) => {
    const action = btn.dataset.action || '';
    if (action === 'open-all') {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        for (const l of links) {
          window.open(l.url, '_blank');
        }
      } catch {}
      return;
    }
    if (action === 'export-links') {
      try {
        const links = JSON.parse(result.dataset.links || '[]');
        let csv = 'userId,month,url\n';
        for (const l of links) {
          csv += `${l.userId},${l.month},${l.url}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'payslip_links.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {}
    }
  });
}
