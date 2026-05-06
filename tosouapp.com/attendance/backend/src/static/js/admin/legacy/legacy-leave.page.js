import { delegate } from '../_shared/dom.js';
import { api } from '../../shared/api/client.js';

function ensureLeaveUiStyles() {
  if (document.getElementById('leave-unified-style')) return;
  const s = document.createElement('style');
  s.id = 'leave-unified-style';
  s.textContent = `
    .leave-page { color:#0f172a; background:#f8fafc; border-radius:0; padding:10px; }
    .leave-page h3 {
      margin:0 0 10px; font-size:18px; font-weight:700; letter-spacing:0; color:#0b2f6b;
      padding-left:0; border-left:0;
    }
    .leave-section {
      background:#fff; border:1px solid #dbe4f0; border-radius:6px; padding:10px;
      box-shadow:none; min-width:0;
    }
    .leave-section h3, .leave-section h4 {
      margin:0 0 10px; font-size:14px; font-weight:700; color:#0b2f6b;
      padding-bottom:6px; border-bottom:1px solid #eef2f7;
    }
    .leave-toolbar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 10px; }
    .leave-label { font-size:12px; color:#475569; }
    .leave-select, .leave-input {
      min-height:32px; border:1px solid #cbd5e1; border-radius:4px; padding:4px 8px; background:#fff;
      line-height:1.4; font-size:14px; font-family:inherit; box-sizing:border-box;
    }
    .leave-btn {
      min-height:30px; border:1px solid #b9c5d8; border-radius:4px; background:#fff; padding:0 10px; cursor:pointer; font-size:12px;
    }
    .leave-btn-primary { background:#0b2f6b; border-color:#0b2f6b; color:#fff; font-weight:600; }
    .leave-btn-danger { background:#fff1f2; border-color:#fecdd3; color:#9f1239; }
    .leave-btn-subtle { background:#f8fafc; }
    .leave-table-wrap {
      border:1px solid #e6edf7; border-radius:4px; overflow:auto; background:#fff;
      box-shadow:none; max-width:100%;
    }
    .leave-table-wrap.sticky { max-height:260px; }
    .leave-page .leave-table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
    .leave-page .leave-table thead th {
      background:#0b2f6b !important;
      color:#ffffff !important;
      -webkit-text-fill-color:#ffffff !important;
      text-align:left; font-weight:700; padding:8px 8px; border-bottom:1px solid #08234f; white-space:nowrap;
    }
    .leave-page .leave-table thead th * {
      color:#ffffff !important;
      -webkit-text-fill-color:#ffffff !important;
    }
    .leave-table-wrap.sticky .leave-table thead th { position:sticky; top:0; z-index:1; }
    .leave-page .leave-table tbody td { padding:7px 8px; border-bottom:1px solid #edf2f7; vertical-align:middle; }
    .leave-page .leave-table tbody tr:nth-child(even) td { background:#fff; }
    .leave-page .leave-table tbody tr:hover td { background:#f8fafc; }
    .leave-page .leave-table .num { text-align:right; font-variant-numeric:tabular-nums; }
    .leave-badge { display:inline-flex; align-items:center; border-radius:999px; padding:2px 8px; font-size:11px; border:1px solid; }
    .leave-badge.pending { color:#92400e; background:#fff7ed; border-color:#fed7aa; }
    .leave-badge.approved { color:#166534; background:#f0fdf4; border-color:#86efac; }
    .leave-badge.rejected { color:#475569; background:#f8fafc; border-color:#cbd5e1; }
    .leave-grid-main { display:grid; grid-template-columns: minmax(0,2fr) minmax(0,1fr); gap:8px; margin-top:4px; align-items:start; }
    .leave-grid-main > .leave-section { min-width:0; }
    .leave-grid-full { margin-top:8px; }
    .leave-form-grid {
      display:grid; grid-template-columns:80px 1fr; gap:8px 10px; align-items:center; margin-top:8px;
    }
    .leave-form-card {
      margin-top:10px; border-top:1px solid #eef2f7; border-radius:0; padding:10px 0 0; background:transparent;
    }
    .leave-form-card h4 { margin:0 0 8px; font-size:13px; color:#0b2f6b; }
    .leave-mini-note { color:#64748b; font-size:12px; margin-top:8px; }
    .leave-pager { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:6px; }
    .leave-muted { color:#64748b; font-size:12px; }
    @media (max-width: 1180px) {
      .leave-grid-main { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(s);
}

export async function mountApprovals({ host, content, opts, mountApprovalsFn }) {
  const c = host || content;
  const seq = Number(c.dataset.approvalsRenderSeq || 0) + 1;
  c.dataset.approvalsRenderSeq = String(seq);
  const stale = () => String(c.dataset.approvalsRenderSeq || '') !== String(seq);
  ensureLeaveUiStyles();
  c.innerHTML = '<h3>承認フロー</h3>';

  const selectedStatus = String(
    Object.prototype.hasOwnProperty.call(opts || {}, 'status')
      ? (opts?.status || '')
      : 'pending'
  ).trim().toLowerCase();
  const filter = document.createElement('div');
  filter.className = 'leave-toolbar';
  filter.innerHTML = `
    <label style="display:inline-flex;align-items:center;gap:8px;">
      <span class="leave-label">休暇申請フィルター</span>
      <select id="leaveReqStatusFilter" class="leave-select">
        <option value="">すべて</option>
        <option value="pending">承認待ち</option>
        <option value="approved">承認済み</option>
        <option value="rejected">却下</option>
      </select>
    </label>
    <label style="display:inline-flex;align-items:center;gap:8px;">
      <span class="leave-label">月</span>
      <input id="leaveReqMonthFilter" class="leave-input" type="month">
    </label>
  `;
  c.appendChild(filter);
  const statusEl = filter.querySelector('#leaveReqStatusFilter');
  if (statusEl) statusEl.value = selectedStatus;
  const monthEl = filter.querySelector('#leaveReqMonthFilter');

  const q = statusEl && statusEl.value ? `?status=${encodeURIComponent(statusEl.value)}` : '';
  let rows = [];
  let usingLegacyPending = false;
  if (selectedStatus === 'pending') {
    usingLegacyPending = true;
    rows = await api.get('/api/leave/pending').catch(() => []);
    if (stale()) return;
  } else {
    try {
      rows = await api.get(`/api/leave/admin-requests${q}`);
      if (stale()) return;
    } catch {
      rows = [];
      if (stale()) return;
    }
  }
  const tableWrap = document.createElement('div');
  tableWrap.className = 'leave-table-wrap';
  const table = document.createElement('table');
  table.className = 'leave-table leave-table-approvals';
  table.innerHTML = '<thead><tr><th>ID</th><th>User</th><th>期間</th><th>種類</th><th>状態</th><th>残数</th><th>操作</th></tr></thead>';
  const tbody = document.createElement('tbody');
  const pager = document.createElement('div');
  pager.className = 'leave-pager';
  let page = 1;
  const pageSize = 10;
  const allRows = Array.isArray(rows) ? rows : [];
  const renderTableRows = () => {
    const m = String(monthEl?.value || '').trim(); // YYYY-MM
    const matched = allRows.filter((r) => {
      const byM = !m || String(r.startDate || '').startsWith(m) || String(r.endDate || '').startsWith(m);
      return byM;
    });
    const total = matched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const pageRows = matched.slice(start, start + pageSize);

    tbody.innerHTML = '';
    for (const r of pageRows) {
      const canReview = String(r?.status || '') === 'pending';
      const userLabel = `${r.userId}${r?.employee_code ? ` (${r.employee_code})` : ''} ${r?.username || ''}`.trim();
      const tr = document.createElement('tr');
      const status = String(r.status || '').toLowerCase();
      const statusClass = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
      tr.innerHTML = `
        <td class="num">${r.id}</td>
        <td>${userLabel}</td>
        <td>${r.startDate}〜${r.endDate}</td>
        <td>${r.type}</td>
        <td><span class="leave-badge ${statusClass}">${r.status}</span></td>
        <td><button type="button" class="leave-btn leave-btn-subtle" data-action="balance" data-user="${r.userId}">照会</button></td>
        <td>
          ${canReview ? `<button type="button" class="leave-btn leave-btn-primary" data-action="approve" data-app="${r.id}">承認</button>
          <button type="button" class="leave-btn leave-btn-danger" data-action="reject" data-app="${r.id}">却下</button>` : '-'}
        </td>`;
      tbody.appendChild(tr);
    }
    if (!pageRows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="text-align:center;color:#64748b;padding:20px 8px;">${usingLegacyPending ? '承認待ちの休暇申請はありません' : (selectedStatus ? 'この状態の休暇申請はありません' : '休暇申請はありません')}</td>`;
      tbody.appendChild(tr);
    }
    pager.innerHTML = `
      <button type="button" class="leave-btn" data-pg="prev">前へ</button>
      <span class="leave-muted">${total} 件 / ${page} / ${totalPages} ページ</span>
      <button type="button" class="leave-btn" data-pg="next">次へ</button>
    `;
    pager.querySelectorAll('[data-pg]').forEach((b) => {
      b.addEventListener('click', () => {
        const dir = b.getAttribute('data-pg');
        if (dir === 'prev' && page > 1) page -= 1;
        if (dir === 'next' && page < totalPages) page += 1;
        renderTableRows();
        bindActionButtons();
      });
    });
  };

  if (statusEl) {
    statusEl.addEventListener('change', async () => {
      await mountApprovalsFn(host || content, { ...(opts || {}), status: String(statusEl.value || '') });
    });
  }

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  c.appendChild(tableWrap);

  const handleAction = async (el) => {
    const action = el.dataset.action;
    const setBusy = (flag) => {
      try {
        if (el && typeof el.disabled !== 'undefined') el.disabled = !!flag;
      } catch { }
    };

    if (action === 'balance') {
      const u = el.dataset.user;
      try {
        setBusy(true);
        const r = await api.get(`/api/leave/user-balance?userId=${encodeURIComponent(u)}`);
        alert(`User ${u} 残数: ${r.totalAvailable}日`);
      } catch (err) {
        alert('残数取得失敗: ' + ((err && err.message) ? err.message : 'error'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === 'approve' || action === 'reject') {
      const id = el.dataset.app;
      const s = action === 'approve' ? 'approved' : 'rejected';
      try {
        setBusy(true);
        await api.patch(`/api/leave/${id}/status`, { status: s });
        if (typeof opts?.onDataChanged === 'function') await opts.onDataChanged();
        // 再描画: 正しい引数形式で呼び直す
        await mountApprovalsFn(host || content, { ...(opts || {}), status: selectedStatus });
      } catch (err) {
        alert('状態更新失敗: ' + ((err && err.message) ? err.message : 'error'));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === 'pc-approve' || action === 'pc-reject') {
      const pcId = el.dataset.pc;
      const s = action === 'pc-approve' ? 'approved' : 'rejected';
      try {
        setBusy(true);
        await api.patch(`/api/manager/profile-change/${pcId}/status`, { status: s });
        if (typeof opts?.onDataChanged === 'function') await opts.onDataChanged();
        // 再描画
        await mountApprovalsFn(host || content, opts || {});
      } catch (err) {
        alert('プロフィール申請更新失敗: ' + ((err && err.message) ? err.message : 'error'));
      } finally {
        setBusy(false);
      }
      return;
    }
  };

  const bindActionButtons = () => {
    c.querySelectorAll('[data-action]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleAction(btn);
      };
    });
  };
  renderTableRows();
  bindActionButtons();
  c.appendChild(pager);
  if (monthEl) monthEl.addEventListener('change', () => { page = 1; renderTableRows(); bindActionButtons(); });

  // プロフィール更新申請
  if (opts?.hideProfileSection) return;
  const pcWrap = document.createElement('div');
  pcWrap.innerHTML = '<h4>プロフィール更新申請</h4>';

  const pcr = await api.get('/api/manager/profile-change/pending');
  if (stale()) return;
  const pcWrapTable = document.createElement('div');
  pcWrapTable.className = 'leave-table-wrap';
  const pcTable = document.createElement('table');
  pcTable.className = 'leave-table';
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
        <button type="button" class="leave-btn leave-btn-primary" data-action="pc-approve" data-pc="${r.id}">承認</button>
        <button type="button" class="leave-btn leave-btn-danger" data-action="pc-reject" data-pc="${r.id}">却下</button>
      </td>`;
    pcBody.appendChild(tr);
  }
  if (!(Array.isArray(pcr) && pcr.length)) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" style="text-align:center;color:#64748b;padding:14px 8px;">承認待ちのプロフィール更新申請はありません</td>';
    pcBody.appendChild(tr);
  }

  pcTable.appendChild(pcBody);
  pcWrapTable.appendChild(pcTable);
  pcWrap.appendChild(pcWrapTable);
  c.appendChild(pcWrap);
  bindActionButtons();
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
  ensureLeaveUiStyles();
  c.innerHTML = '<h3>有給付与</h3>';

  if (!(opts && opts.unified)) {
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
  }

  const eligibleWrap = document.createElement('div');
  eligibleWrap.style.cssText = 'margin:8px 0 12px;padding:0;border:0;border-radius:0;background:transparent;';
  eligibleWrap.innerHTML = `
    <div class="leave-toolbar" style="margin:0 0 8px;">
      <strong>付与対象候補</strong>
      <button class="leave-btn" data-action="load-eligible">候補を読込</button>
      <button class="leave-btn leave-btn-primary" data-action="grant-eligible">候補を一括付与</button>
      <span id="eligibleInfo" style="color:#475569;font-size:12px;"></span>
    </div>
    <div id="eligibleTableHost"></div>
  `;
  eligibleWrap.querySelector('.leave-toolbar')?.style.setProperty('padding', '0');
  c.appendChild(eligibleWrap);

  const eligibleInfo = eligibleWrap.querySelector('#eligibleInfo');
  const eligibleHost = eligibleWrap.querySelector('#eligibleTableHost');
  let eligibleRowsCache = [];
  const getEligibleKey = (r) => `${r.userId}|${r.grantDate}|${r.days}`;
  const selectedEligible = new Set();
  const renderEligible = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    eligibleRowsCache = list;
    if (!list.length) {
      eligibleHost.innerHTML = '<div class="leave-mini-note">付与候補はありません</div>';
      return;
    }
    const w = document.createElement('div');
    w.className = 'leave-table-wrap sticky';
    const t = document.createElement('table');
    t.className = 'leave-table';
    t.innerHTML = '<thead><tr><th><input type="checkbox" id="eligibleCheckAll"></th><th>User</th><th>入社日</th><th>付与日</th><th>日数</th><th>出勤率</th><th>判定期間</th></tr></thead>';
    const tb = document.createElement('tbody');
    for (const r of list) {
      const k = getEligibleKey(r);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" data-eligible-key="${k}" ${selectedEligible.has(k) ? 'checked' : ''}></td>
        <td>${r.userId}${r.employeeCode ? ` (${r.employeeCode})` : ''} ${r.username || ''}</td>
        <td>${r.hireDate || ''}</td>
        <td>${r.grantDate || ''}</td>
      <td class="num">${r.days || 0}</td>
      <td class="num">${r.attendanceRate || 0}%</td>
        <td>${r.periodStart || ''}〜${r.periodEnd || ''}</td>
      `;
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    eligibleHost.innerHTML = '';
    w.appendChild(t);
    eligibleHost.appendChild(w);
    const allEl = eligibleHost.querySelector('#eligibleCheckAll');
    if (allEl) {
      allEl.addEventListener('change', () => {
        const checked = !!allEl.checked;
        eligibleHost.querySelectorAll('input[data-eligible-key]').forEach((ck) => {
          ck.checked = checked;
          const k = ck.getAttribute('data-eligible-key');
          if (!k) return;
          if (checked) selectedEligible.add(k);
          else selectedEligible.delete(k);
        });
      });
    }
    eligibleHost.querySelectorAll('input[data-eligible-key]').forEach((ck) => {
      ck.addEventListener('change', () => {
        const k = ck.getAttribute('data-eligible-key');
        if (!k) return;
        if (ck.checked) selectedEligible.add(k);
        else selectedEligible.delete(k);
      });
    });
  };

  delegate(c, '[data-action]', 'click', async (e, el) => {
    const action = el.dataset.action;

    if (action === 'auto-grant') {
      try {
        const r = await api.post('/api/leave/auto-grant/run');
        alert(`自動付与 実行: ${r.ok || 0}/${r.processed || 0}`);
        if (typeof opts?.onDataChanged === 'function') await opts.onDataChanged();
      } catch (err) {
        alert('自動付与失敗: ' + ((err && err.message) ? err.message : 'error'));
      }
    } else if (action === 'load-eligible') {
      try {
        const r = await api.get('/api/leave/eligible-list');
        const rows = Array.isArray(r?.rows) ? r.rows : [];
        if (eligibleInfo) eligibleInfo.textContent = `mode=${r?.mode || '-'} / 件数=${rows.length}`;
        renderEligible(rows);
      } catch (err) {
        if (eligibleInfo) eligibleInfo.textContent = '候補読込に失敗しました';
      }
    } else if (action === 'grant-eligible') {
      try {
        const selected = eligibleRowsCache.filter((r) => selectedEligible.has(getEligibleKey(r)));
        const targets = selected.length ? selected : eligibleRowsCache;
        let ok = 0;
        for (const r of targets) {
          const gDate = String(r.grantDate || '').slice(0, 10);
          if (!gDate) continue;
          const dt = new Date(gDate + 'T00:00:00Z');
          dt.setUTCFullYear(dt.getUTCFullYear() + 2);
          dt.setUTCDate(dt.getUTCDate() - 1);
          const expiry = dt.toISOString().slice(0, 10);
          await api.post('/api/leave/grant', { userId: Number(r.userId), days: Number(r.days || 0), grantDate: gDate, expiryDate: expiry });
          ok += 1;
        }
        if (eligibleInfo) eligibleInfo.textContent = `選択=${targets.length} / 付与=${ok}`;
        const re = await api.get('/api/leave/eligible-list');
        selectedEligible.clear();
        renderEligible(re?.rows || []);
        if (typeof opts?.onDataChanged === 'function') await opts.onDataChanged();
      } catch (err) {
        alert('一括付与失敗: ' + ((err && err.message) ? err.message : 'error'));
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

  form.className = 'leave-form-grid';
  form.innerHTML = `
    <label class="leave-label">User</label>
    <select id="grantUser" class="leave-select"></select>
    <label class="leave-label">Days</label>
    <input id="grantDays" class="leave-input" type="number" min="1" value="10">
    <label class="leave-label">Grant date</label>
    <input id="grantDate" class="leave-input" type="date" value="${fmt(today)}">
    <label class="leave-label">Expire date</label>
    <input id="expireDate" class="leave-input" type="date" value="${fmt(exp)}">
    <span></span>
    <button type="submit" class="leave-btn leave-btn-primary" style="width:120px;">付与</button>
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
  result.className = 'leave-mini-note';

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const userId = parseInt(sel.value, 10);
    const days = parseInt(form.querySelector('#grantDays').value, 10);
    const grantDate = form.querySelector('#grantDate').value;
    const expiryDate = form.querySelector('#expireDate').value;

    try {
      await api.post('/api/leave/grant', { userId, days, grantDate, expiryDate });
      result.textContent = '付与しました';
      if (typeof opts?.onDataChanged === 'function') await opts.onDataChanged();
    } catch (err) {
      result.textContent = '付与失敗: ' + ((err && err.message) ? err.message : 'error');
    }
  });

  const formCard = document.createElement('div');
  formCard.className = 'leave-form-card';
  formCard.innerHTML = '<h4>手動付与</h4>';
  formCard.appendChild(form);
  formCard.appendChild(result);
  c.appendChild(formCard);
}

export async function mountLeaveBalance({
  host,
  content,
  opts,
  mountLeaveGrantFn,
  mountApprovalsFn,
}) {
  const c = host || content;
  ensureLeaveUiStyles();
  c.innerHTML = '<h3>有給残日数一覧</h3>';

  const toolbar = document.createElement('div');
  toolbar.className = 'leave-toolbar';
  toolbar.innerHTML = `
    <label style="display:inline-flex;align-items:center;gap:8px;">
      <span class="leave-label">検索</span>
      <input id="leaveBalSearch" class="leave-input" type="text" placeholder="user/id">
    </label>
    <label style="display:inline-flex;align-items:center;gap:8px;">
      <span class="leave-label">並び替え</span>
      <select id="leaveBalSort" class="leave-select">
        <option value="remainingDays:desc">残（日数）↓</option>
        <option value="remainingDays:asc">残（日数）↑</option>
        <option value="nearestExpiry:asc">有効期限 近い順</option>
        <option value="obligationRemaining:desc">義務残 ↓</option>
        <option value="userId:asc">User ID ↑</option>
      </select>
    </label>
    <label style="display:inline-flex;align-items:center;gap:8px;">
      <span class="leave-label">件数</span>
      <select id="leaveBalPageSize" class="leave-select">
        <option value="20">20</option>
        <option value="50" selected>50</option>
        <option value="100">100</option>
      </select>
    </label>
  `;
  c.appendChild(toolbar);

  let data = [];
  try {
    data = await api.get('/api/leave/summary');
  } catch {
    data = [];
    const note = document.createElement('div');
    note.style.cssText = 'margin:2px 0 10px;color:#b45309;font-size:12px;';
    note.textContent = '残日数データの取得に失敗しました。空データで表示します。';
    c.appendChild(note);
  }
  const tableWrap = document.createElement('div');
  tableWrap.className = 'leave-table-wrap sticky';
  const table = document.createElement('table');
  table.className = 'leave-table';
  table.innerHTML =
    '<thead><tr><th>User</th><th>部門</th><th>付与合計</th><th>使用</th><th>残</th><th>有効期限(近日)</th><th>義務残</th></tr></thead>';
  const tbody = document.createElement('tbody');
  const pager = document.createElement('div');
  pager.className = 'leave-pager';
  const today = new Date();
  const searchEl = toolbar.querySelector('#leaveBalSearch');
  const sortEl = toolbar.querySelector('#leaveBalSort');
  const sizeEl = toolbar.querySelector('#leaveBalPageSize');
  let page = 1;
  const render = () => {
    const q = String(searchEl?.value || '').trim().toLowerCase();
    const [sortBy, sortDir] = String(sortEl?.value || 'remainingDays:desc').split(':');
    const pageSize = 10;
    const list = (Array.isArray(data) ? data : []).filter((r) => {
      const txt = `${r.userId} ${r.name || ''}`.toLowerCase();
      return !q || txt.includes(q);
    }).sort((a, b) => {
      const av = a?.[sortBy];
      const bv = b?.[sortBy];
      if (sortBy === 'nearestExpiry') {
        const aa = av ? new Date(av).getTime() : Number.MAX_SAFE_INTEGER;
        const bb = bv ? new Date(bv).getTime() : Number.MAX_SAFE_INTEGER;
        return sortDir === 'desc' ? (bb - aa) : (aa - bb);
      }
      const an = Number(av || 0);
      const bn = Number(bv || 0);
      return sortDir === 'desc' ? (bn - an) : (an - bn);
    });
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const rows = list.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    tbody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      if (r.nearestExpiry && new Date(r.nearestExpiry) - today < 1000 * 60 * 60 * 24 * 30) {
        tr.style.background = '#fff4e5';
      }
      tr.innerHTML = `
        <td>${r.userId} ${r.name || ''}</td>
        <td class="num">${r.departmentId == null ? '' : r.departmentId}</td>
        <td class="num">${r.totalGranted}</td>
        <td class="num">${r.usedDays}</td>
        <td class="num">${r.remainingDays}</td>
        <td>${r.nearestExpiry || ''} (${r.nearestExpiryRemaining || 0})</td>
        <td class="num">${r.obligationRemaining || 0}</td>`;
      tbody.appendChild(tr);
    }
    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" style="text-align:center;color:#64748b;padding:20px 8px;">データがありません</td>';
      tbody.appendChild(tr);
    }
    pager.innerHTML = `
      <button type="button" class="leave-btn" data-pg="prev">前へ</button>
      <span class="leave-muted">${total} 件 / ${page} / ${totalPages} ページ</span>
      <button type="button" class="leave-btn" data-pg="next">次へ</button>
    `;
    pager.querySelectorAll('[data-pg]').forEach((b) => {
      b.addEventListener('click', () => {
        const dir = b.getAttribute('data-pg');
        if (dir === 'prev' && page > 1) page -= 1;
        if (dir === 'next' && page < totalPages) page += 1;
        render();
      });
    });
  };

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  c.appendChild(tableWrap);
  c.appendChild(pager);
  render();
  if (searchEl) searchEl.addEventListener('input', () => { page = 1; render(); });
  if (sortEl) sortEl.addEventListener('change', () => { page = 1; render(); });
  if (sizeEl) sizeEl.addEventListener('change', () => { page = 1; render(); });
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

export async function mountLeaveUnified({
  content,
  mountApprovalsFn,
  mountLeaveGrantFn,
  mountLeaveBalanceFn,
}) {
  ensureLeaveUiStyles();
  content.classList.add('leave-page');
  content.innerHTML = '<h3>休暇管理</h3>';
  const mainGrid = document.createElement('div');
  mainGrid.className = 'leave-grid-main';
  content.appendChild(mainGrid);

  const secA = document.createElement('section');
  secA.className = 'leave-section';
  mainGrid.appendChild(secA);
  const refreshBalance = async () => {
    await mountLeaveBalanceFn(secB, { unified: true, onDataChanged: refreshBalance });
  };
  await mountApprovalsFn(secA, { status: 'pending', hideProfileSection: true, onDataChanged: refreshBalance });

  const secG = document.createElement('section');
  secG.className = 'leave-section';
  mainGrid.appendChild(secG);
  await mountLeaveGrantFn(secG, { unified: true, onDataChanged: refreshBalance });

  const secB = document.createElement('section');
  secB.className = 'leave-section leave-grid-full';
  content.appendChild(secB);
  await mountLeaveBalanceFn(secB, { unified: true, onDataChanged: refreshBalance });
}
