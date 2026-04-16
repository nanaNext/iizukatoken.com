import { delegate } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';

export async function mountApprovals({ host, content, opts, mountApprovalsFn }) {
  const c = host || content;
  c.innerHTML = '<h3>承認フロー</h3>';

  const rows = await api.get('/api/leave/pending');
  const table = document.createElement('table');
  table.style.width = '100%';
  table.innerHTML =
    '<thead><tr><th>ID</th><th>User</th><th>期間</th><th>種類</th><th>状態</th><th>残数</th><th>操作</th></tr></thead>';
  const tbody = document.createElement('tbody');

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.userId}</td>
      <td>${r.startDate}〜${r.endDate}</td>
      <td>${r.type}</td>
      <td>${r.status}</td>
      <td><button data-action="balance" data-user="${r.userId}">照会</button></td>
      <td>
        <button data-action="approve" data-app="${r.id}">承認</button>
        <button data-action="reject" data-app="${r.id}">却下</button>
      </td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  c.appendChild(table);

  // プロフィール更新申請
  const pcWrap = document.createElement('div');
  pcWrap.innerHTML = '<h4>プロフィール更新申請</h4>';

  const pcr = await api.get('/api/manager/profile-change/pending');
  const pcTable = document.createElement('table');
  pcTable.style.width = '100%';
  pcTable.innerHTML =
    '<thead><tr><th>ID</th><th>User</th><th>内容</th><th>送信日時</th><th>操作</th></tr></thead>';
  const pcBody = document.createElement('tbody');

  for (const r of pcr) {
    const fields = r.fields || {};
    const summary = Object.keys(fields)
      .slice(0, 6)
      .map(k => `${k}: ${String(fields[k]).slice(0, 20)}`)
      .join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.userId} ${r.username || ''}</td>
      <td>${summary}</td>
      <td>${r.createdAt || ''}</td>
      <td>
        <button data-action="pc-approve" data-pc="${r.id}">承認</button>
        <button data-action="pc-reject" data-pc="${r.id}">却下</button>
      </td>`;
    pcBody.appendChild(tr);
  }

  pcTable.appendChild(pcBody);
  pcWrap.appendChild(pcTable);
  c.appendChild(pcWrap);

  delegate(c, '[data-action]', 'click', async (e, el) => {
    const action = el.dataset.action;

    if (action === 'balance') {
      const u = el.dataset.user;
      try {
        const r = await api.get(`/api/leave/user-balance?userId=${encodeURIComponent(u)}`);
        alert(`User ${u} 残数: ${r.totalAvailable}日`);
      } catch (err) {
        alert('残数取得失敗: ' + ((err && err.message) ? err.message : 'error'));
      }
      return;
    }

    if (action === 'approve' || action === 'reject') {
      const id = el.dataset.app;
      const s = action === 'approve' ? 'approved' : 'rejected';
      await api.patch(`/api/leave/${id}/status`, { status: s });
      // 再描画: 正しい引数形式で呼び直す
      await mountApprovalsFn({ host, content, opts, mountApprovalsFn });
      return;
    }

    if (action === 'pc-approve' || action === 'pc-reject') {
      const pcId = el.dataset.pc;
      const s = action === 'pc-approve' ? 'approved' : 'rejected';
      await api.patch(`/api/manager/profile-change/${pcId}/status`, { status: s });
      // 再描画
      await mountApprovalsFn({ host, content, opts, mountApprovalsFn });
      return;
    }
  });
}

export async function mountLeaveAdmin({ content }) {
  content.innerHTML = '<h3>有給休暇管理</h3>';
  const data = await api.get('/api/leave/summary');

  const table = document.createElement('table');
  table.style.width = '100%';
  table.innerHTML =
    '<thead><tr><th>User</th><th>部門</th><th>付与合計</th><th>使用</th><th>残</th></tr></thead>';
  const tbody = document.createElement('tbody');

  for (const r of data) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.userId} ${r.name || ''}</td>
      <td>${r.departmentId == null ? '' : r.departmentId}</td>
      <td>${r.totalGranted}</td>
      <td>${r.usedDays}</td>
      <td>${r.remainingDays}</td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  content.appendChild(table);
}

export async function mountLeaveGrant({
  host,
  content,
  opts,
  listUsers,
  mountApprovalsFn,
  mountLeaveBalanceFn,
}) {
  const c = host || content;
  c.innerHTML = '<h3>有給付与</h3>';

  const nav = document.createElement('div');
  if (opts && opts.hub) {
    nav.innerHTML = `
      <span class="btn">有給付与</span>
      <button class="btn" data-action="go-approvals">有給申請承認</button>
      <button class="btn" data-action="go-balance">有給残日数一覧</button>
      <button class="btn" data-action="auto-grant">自動付与 実行</button>
    `;
  } else {
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=leave_grant">有給付与</a>
      <a class="btn" href="/ui/admin?tab=approvals">有給申請承認</a>
      <a class="btn" href="/ui/admin?tab=leave_balance">有給残日数一覧</a>
      <button class="btn" data-action="auto-grant">自動付与 実行</button>
    `;
  }
  c.appendChild(nav);

  delegate(nav, '[data-action]', 'click', async (e, el) => {
    const action = el.dataset.action;

    if (action === 'auto-grant') {
      try {
        const r = await api.post('/api/leave/auto-grant/run');
        alert(`自動付与 実行: ${r.ok || 0}/${r.processed || 0}`);
      } catch (err) {
        alert('自動付与失敗: ' + ((err && err.message) ? err.message : 'error'));
      }
    } else if (action === 'go-approvals' && opts && opts.hub) {
      mountApprovalsFn(c, { hub: true });
    } else if (action === 'go-balance' && opts && opts.hub) {
      mountLeaveBalanceFn(c, { hub: true });
    }
  });

  const users = await listUsers();
  const form = document.createElement('form');
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const exp = new Date(
    Date.UTC(today.getUTCFullYear() + 2, today.getUTCMonth(), today.getUTCDate() - 1),
  );

  form.innerHTML = `
    <label>User</label>
    <select id="grantUser"></select>
    <label>Days</label>
    <input id="grantDays" type="number" min="1" value="10">
    <label>Grant date</label>
    <input id="grantDate" type="date" value="${fmt(today)}">
    <label>Expire date</label>
    <input id="expireDate" type="date" value="${fmt(exp)}">
    <button type="submit">付与</button>
  `;

  const sel = form.querySelector('#grantUser');
  for (const u of users) {
    const opt = document.createElement('option');
    opt.value = String(u.id);
    opt.textContent = `${u.id} ${u.username || u.email}`;
    sel.appendChild(opt);
  }

  form.querySelector('#grantDate').addEventListener('change', e => {
    try {
      const d = new Date(e.target.value + 'T00:00:00Z');
      const tmp = new Date(
        Date.UTC(d.getUTCFullYear() + 2, d.getUTCMonth(), d.getUTCDate() - 1),
      );
      form.querySelector('#expireDate').value = fmt(tmp);
    } catch {
      // ignore
    }
  });

  const result = document.createElement('div');

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const userId = parseInt(sel.value, 10);
    const days = parseInt(form.querySelector('#grantDays').value, 10);
    const grantDate = form.querySelector('#grantDate').value;
    const expiryDate = form.querySelector('#expireDate').value;

    try {
      await api.post('/api/leave/grant', { userId, days, grantDate, expiryDate });
      result.textContent = '付与しました';
    } catch (err) {
      result.textContent = '付与失敗: ' + ((err && err.message) ? err.message : 'error');
    }
  });

  c.appendChild(form);
  c.appendChild(result);
}

export async function mountLeaveBalance({
  host,
  content,
  opts,
  mountLeaveGrantFn,
  mountApprovalsFn,
}) {
  const c = host || content;
  c.innerHTML = '<h3>有給残日数一覧</h3>';

  const nav = document.createElement('div');
  if (opts && opts.hub) {
    nav.innerHTML = `
      <button class="btn" data-action="go-grant">有給付与</button>
      <button class="btn" data-action="go-approvals">有給申請承認</button>
      <span class="btn">有給残日数一覧</span>
      <button class="btn" data-action="export-csv">CSV</button>
    `;
  } else {
    nav.innerHTML = `
      <a class="btn" href="/ui/admin?tab=leave_grant">有給付与</a>
      <a class="btn" href="/ui/admin?tab=approvals">有給申請承認</a>
      <a class="btn" href="/ui/admin?tab=leave_balance">有給残日数一覧</a>
      <button class="btn" data-action="export-csv">CSV</button>
    `;
  }
  c.appendChild(nav);

  const data = await api.get('/api/leave/summary');
  const table = document.createElement('table');
  table.style.width = '100%';
  table.innerHTML =
    '<thead><tr><th>User</th><th>部門</th><th>付与合計</th><th>使用</th><th>残</th><th>有効期限(近日)</th><th>義務残</th></tr></thead>';
  const tbody = document.createElement('tbody');
  const today = new Date();

  for (const r of data) {
    const tr = document.createElement('tr');
    if (r.nearestExpiry && new Date(r.nearestExpiry) - today < 1000 * 60 * 60 * 24 * 30) {
      tr.style.background = '#fff4e5';
    }
    tr.innerHTML = `
      <td>${r.userId} ${r.name || ''}</td>
      <td>${r.departmentId == null ? '' : r.departmentId}</td>
      <td>${r.totalGranted}</td>
      <td>${r.usedDays}</td>
      <td>${r.remainingDays}</td>
      <td>${r.nearestExpiry || ''} (${r.nearestExpiryRemaining || 0})</td>
      <td>${r.obligationRemaining || 0}</td>`;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  c.appendChild(table);

  delegate(nav, '[data-action]', 'click', (e, el) => {
    const action = el.dataset.action;

    if (action === 'export-csv') {
      let csv =
        'userId,name,departmentId,granted,used,remaining,nearest_expiry,nearest_expiry_remaining,obligation_remaining\n';
      for (const r of data) {
        csv += `${r.userId},${(r.name || '').replace(/,/g, ' ')},${r.departmentId == null ? '' : r.departmentId},${r.totalGranted},${r.usedDays},${r.remainingDays},${r.nearestExpiry || ''},${r.nearestExpiryRemaining || 0},${r.obligationRemaining || 0}\n`;
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url;
      a2.download = 'paid_leave_balance.csv';
      a2.click();
      setTimeout(() => URL.revokeObjectURL(url), 800);
    } else if (action === 'go-grant' && opts && opts.hub) {
      mountLeaveGrantFn(c, { hub: true });
    } else if (action === 'go-approvals' && opts && opts.hub) {
      mountApprovalsFn(c, { hub: true });
    }
  });
}

export async function mountLeaveHub({
  content,
  mountLeaveGrantFn,
  mountApprovalsFn,
  mountLeaveBalanceFn,
}) {
  const c = content;
  c.innerHTML = '<h3>有給休暇</h3>';

  const nav = document.createElement('div');
  nav.innerHTML = `
    <a class="btn" href="/ui/admin">戻る</a>
    <button class="btn" data-action="nav-grant">有給付与</button>
    <button class="btn" data-action="nav-approve">有給申請承認</button>
    <button class="btn" data-action="nav-balance">有給残日数一覧</button>
  `;
  c.appendChild(nav);

  const body = document.createElement('div');
  c.appendChild(body);

  const showGrant = () => {
    mountLeaveGrantFn(body, { hub: true });
  };
  const showApprove = () => {
    mountApprovalsFn(body, { hub: true });
  };
  const showBalance = () => {
    mountLeaveBalanceFn(body, { hub: true });
  };

  function setHashAndRender(hash) {
    if (location.hash !== hash) location.hash = hash;
    if (hash.includes('grant')) showGrant();
    else if (hash.includes('approve')) showApprove();
    else showBalance();
  }

  delegate(nav, '[data-action]', 'click', (e, el) => {
    const action = el.dataset.action;
    if (action === 'nav-grant') setHashAndRender('#leave=grant');
    else if (action === 'nav-approve') setHashAndRender('#leave=approve');
    else if (action === 'nav-balance') setHashAndRender('#leave=balance');
  });

  const initial = (location.hash || '').toLowerCase();
  if (initial.includes('grant')) showGrant();
  else if (initial.includes('approve')) showApprove();
  else showBalance();

  window.addEventListener(
    'hashchange',
    () => {
      const h = (location.hash || '').toLowerCase();
      if (h.includes('grant')) showGrant();
      else if (h.includes('approve')) showApprove();
      else showBalance();
    },
    { once: false },
  );
}
