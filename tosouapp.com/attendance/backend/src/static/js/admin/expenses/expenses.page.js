import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const showSpinner = () => {
  try { const el = document.querySelector('#pageSpinner'); if (el) { el.removeAttribute('hidden'); el.style.display = 'grid'; } } catch {}
};
const hideSpinner = () => {
  try { const el = document.querySelector('#pageSpinner'); if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; } } catch {}
};

const todayMonth = () => new Date().toISOString().slice(0, 7);
const fmtDT = (v) => {
  if (!v) return '';
  try {
    const d = typeof v === 'string' ? new Date(v) : v;
    if (!d || isNaN(d.getTime())) return String(v).replace('T',' ').slice(0,16);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch { return String(v).replace('T',' ').slice(0,16); }
};

const render = async () => {
  const host = $('#adminContent');
  if (!host) return;
  let pollTimer = 0;
  const globalStatus = document.getElementById('status');
  if (globalStatus) { globalStatus.textContent = ''; globalStatus.style.display = 'none'; }
  host.className = '';
  host.style.maxWidth = 'none';
  host.style.width = '100%';
  host.style.marginLeft = '0';
  host.style.marginRight = '0';
  host.style.background = 'transparent';
  host.style.border = '0';
  host.style.boxShadow = 'none';
  host.style.padding = '0';
  host.innerHTML = `
    <div class="exp-admin-page">
      <style>
        .admin .exp-admin-page { max-width: none !important; width: 100% !important; margin: 0 !important; }
        .admin .exp-admin-table-host { width: 100% !important; }
        .admin .exp-admin-table-wrap { width: 100% !important; }
        .exp-admin-page { display: grid; gap: 10px; background: transparent; padding: 0; border-radius: 0; color:#0f172a; }
        .exp-admin-page .exp-admin-title { margin: 0; font-size: 20px; letter-spacing: 0; font-weight: 700; }
        .exp-admin-page .exp-admin-header-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom: 0; }
        .exp-admin-page .exp-admin-toolbar-row { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-top: -2px; }
        .exp-admin-page .exp-admin-filters { margin-bottom: 2px; display:flex; flex-wrap:wrap; gap:10px; align-items:center; flex:1 1 auto; }
        .exp-admin-page .exp-admin-label { font-size: 14px; font-weight: 700; color:#334155; }
        .exp-admin-page .exp-admin-input,
        .exp-admin-page .exp-admin-select { min-height: 36px; font-size: 14px; border:1px solid #cbd5e1; border-radius:8px; padding: 0 10px; }
        .exp-admin-page .btn { min-height: 34px; font-size: 13px; font-weight: 700; }
        .exp-admin-page .exp-inline-kpi { flex:0 0 auto; margin-left:auto; }
        .exp-admin-page .exp-admin-section {
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0;
          box-shadow: none;
        }
        .exp-admin-page .exp-admin-section-title { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #475569; letter-spacing: 0; text-transform: none; }
        .exp-admin-page .exp-kpi-row-right { display: flex; justify-content: flex-end; width: 100%; }
        .exp-admin-page .exp-kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(170px, 210px)); gap: 8px; }
        .exp-admin-page .exp-kpi-card {
          border-radius: 0;
          border: 0;
          border-left: 2px solid #d1d5db;
          padding: 2px 6px;
          display: grid;
          gap: 1px;
          box-shadow: none;
          background: transparent;
        }
        .exp-admin-page .exp-kpi-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color:#475569; }
        .exp-admin-page .exp-kpi-icon {
          width: 18px; height: 18px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 800; background:#ffffffcc; color:#475569;
        }
        .exp-admin-page .exp-kpi-value { font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.2; }
        .exp-admin-page .exp-kpi-sub { font-size: 12px; color: #64748b; line-height: 1.25; }
        .exp-admin-page #expMonthlySummaryHost .exp-admin-table-wrap {
          border: 0;
          border-radius: 0;
          background: transparent;
          padding: 0;
        }
        .exp-admin-page .exp-admin-table-wrap {
          border: 1px solid #dbe3ee !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          padding: 0 !important;
          box-shadow: none !important;
          overflow: hidden;
        }
        .exp-admin-page .exp-admin-table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
        }
        .exp-admin-page .exp-admin-table th,
        .exp-admin-page .exp-admin-table td {
          border: 1px solid #e5eaf2;
        }
        .exp-admin-page #expMonthlySummaryHost .exp-admin-table th {
          font-size: 12px;
          color: #64748b;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .exp-admin-page #expMonthlySummaryHost .exp-admin-table td {
          font-size: 13px;
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .exp-admin-page .exp-kpi-applied { border-left-color: #f59e0b; background: transparent; }
        .exp-admin-page .exp-kpi-approved { border-left-color: #10b981; background: transparent; }
        .exp-admin-page .exp-kpi-rejected { border-left-color: #ef4444; background: transparent; }
        .exp-admin-page .exp-admin-table.clean-view th,
        .exp-admin-page .exp-admin-table.clean-view td { padding: 12px 12px; font-size: 14px; vertical-align: top; }
        .exp-admin-page .exp-admin-table.clean-view thead th { background: #f8fafc; border-bottom: 1px solid #dbe3ee; color: #334155; font-size: 13px; font-weight: 700; }
        .exp-admin-page .exp-admin-table.clean-view tbody tr:nth-child(even) { background: transparent; }
        .exp-admin-page .exp-admin-table.clean-view tbody tr:hover { background: #f8fafc; }
        .exp-admin-page .route-col { max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .exp-admin-page .status-sub { color: #64748b; font-size: 12px; margin-top: 4px; }
        .exp-admin-page .status-main { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; }
        .exp-admin-page .status-main .s-ico { font-size: 12px; }
        .exp-admin-page .status-main.approved { color: #166534; }
        .exp-admin-page .status-main.applied { color: #9a3412; }
        .exp-admin-page .status-main.rejected { color: #991b1b; }
      </style>
      <div class="exp-admin-header-row">
        <h3 class="exp-admin-title">交通費計算管理</h3>
        <div id="expMonthlyKpiHost" class="exp-inline-kpi"></div>
      </div>
      <div class="exp-admin-toolbar-row">
        <div class="exp-admin-filters">
          <label for="expMonth" class="exp-admin-label">対象月</label>
          <input id="expMonth" type="month" class="exp-admin-input">
          <label for="expAggregateMode" class="exp-admin-label">集計対象</label>
          <select id="expAggregateMode" class="exp-admin-input exp-admin-select" aria-label="集計対象">
            <option value="approved">承認済み</option>
            <option value="applied_approved">申請中+承認済み</option>
            <option value="all">全て</option>
          </select>
          <select id="expUserFilter" class="exp-admin-input exp-admin-select" aria-label="社員">
            <option value="">全員</option>
          </select>
          <button id="expReload" class="btn exp-admin-reload" type="button">再読込</button>
          <button id="expExportCsv" class="btn" type="button">CSV出力</button>
          <button id="expToggleHistory" class="btn" type="button" style="height:30px;padding:0 10px;">履歴</button>
          <button id="expToggleDetails" class="btn" type="button">明細表示</button>
          <button id="expMonthlyClose" class="btn" type="button">月次締め</button>
          <button id="expMonthlyRecalc" class="btn" type="button">再計算</button>
        </div>
      </div>
      <div id="expMonthlyStatus" class="exp-admin-status"></div>
      <section class="exp-admin-section">
        <h4 class="exp-admin-section-title">社員別集計</h4>
        <div id="expMonthlySummaryHost" class="exp-admin-table-host"></div>
      </section>
      <section class="exp-admin-section">
        <h4 class="exp-admin-section-title">月次履歴</h4>
        <div id="expMonthlyHistoryHost" class="exp-admin-table-host"></div>
      </section>
      <section class="exp-admin-section">
        <h4 class="exp-admin-section-title">申請通知（月別・社員別）</h4>
        <div id="expEmployeeMonthHost" class="exp-admin-table-host"></div>
      </section>
      <div id="chatNotice" class="exp-admin-chat">
        <div class="exp-admin-chat-title">チャット通知</div>
        <div id="chatList" class="exp-admin-chat-list"></div>
      </div>
      <div id="expStatus" class="exp-admin-status"></div>
      <div id="expTableHost" class="exp-admin-table-host"></div>
    </div>
  `;
  const params = new URLSearchParams(window.location.search || '');
  const initialMonth = params.get('month') || '';
  const initialUserId = params.get('userId') || '';
  const initialOpenDetails = ['1', 'true', 'yes'].includes(String(params.get('openDetails') || '').toLowerCase());
  let initialUserApplied = false;
  const m = $('#expMonth');
  if (m) m.value = initialMonth || todayMonth();
  const viewState = { page: 1, pageSize: 20, showDetails: !!initialOpenDetails, showHistory: false };
  const includeByMode = (status, mode) => {
    const st = String(status || '').toLowerCase();
    if (mode === 'approved') return st === 'approved';
    if (mode === 'applied_approved') return st === 'approved' || st === 'applied';
    return ['approved', 'applied', 'rejected', 'pending', 'draft'].includes(st);
  };
  const modeLabel = (mode) => {
    if (mode === 'approved') return '承認';
    if (mode === 'applied_approved') return '申請+承認';
    return '全状態';
  };
  const renderMonthlyKpi = (rows) => {
    const host2 = $('#expMonthlyKpiHost');
    if (!host2) return;
    const arr = Array.isArray(rows) ? rows : [];
    const stats = {
      approved: { count: 0, amount: 0 },
      applied: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };
    for (const r of arr) {
      const st = String(r.status || '').toLowerCase();
      if (!stats[st]) continue;
      stats[st].count += 1;
      stats[st].amount += Number(r.amount || 0);
    }
    const card = (title, x, cls, icon) => `
      <div class="exp-kpi-card ${cls}">
        <div class="exp-kpi-head"><span class="exp-kpi-icon">${icon}</span><span>${title}</span></div>
        <div class="exp-kpi-value">${Number(x.count || 0).toLocaleString('ja-JP')} 件</div>
        <div class="exp-kpi-sub">¥ ${Number(x.amount || 0).toLocaleString('ja-JP')}</div>
      </div>`;
    host2.innerHTML = `
      <div class="exp-kpi-grid">
        ${card('申請中', stats.applied, 'exp-kpi-applied', '⏳')}
        ${card('承認済み', stats.approved, 'exp-kpi-approved', '✔')}
        ${card('差戻し', stats.rejected, 'exp-kpi-rejected', '↩')}
      </div>
    `;
  };
  const renderMonthlySummary = (summary, mode) => {
    const host2 = $('#expMonthlySummaryHost');
    if (!host2) return;
    const totals = Array.isArray(summary?.totals) ? summary.totals : [];
    const closures = Array.isArray(summary?.closures) ? summary.closures : [];
    const closureMap = new Map(closures.map((c) => [String(c.user_id), c]));
    if (!totals.length) {
      host2.innerHTML = `<div class="empty-state"><div style="font-size:22px;">📊</div><div>${modeLabel(mode)}データがありません</div></div>`;
      return;
    }
    const rowsHtml = totals.map((r) => {
      const key = String(r.user_id || '');
      const c = closureMap.get(key) || null;
      const total = Number(r.total_amount || 0).toLocaleString('ja-JP');
      const count = Number(r.item_count || r.approved_count || 0);
      const closedAt = c?.closed_at ? fmtDT(c.closed_at) : '';
      const closedBy = c?.closed_by_name || '';
      return `<tr>
        <td>${r.user_name || ''}</td>
        <td style="text-align:right;">${count}</td>
        <td style="text-align:right;">${total}</td>
        <td>${closedAt ? `${summary?.month || ''} 締め: ${closedAt}${closedBy ? `（${closedBy}）` : ''}` : '-'}</td>
      </tr>`;
    }).join('');
    host2.innerHTML = `
      <div class="exp-admin-table-wrap">
        <table class="exp-admin-table clean-view">
          <thead><tr><th>社員</th><th>${modeLabel(mode)}件数</th><th>${modeLabel(mode)}金額(円)</th><th>締め情報（承認基準）</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  };
  const renderMonthlyHistory = (rows) => {
    const host2 = $('#expMonthlyHistoryHost');
    if (!host2) return;
    if (!viewState.showHistory) {
      host2.innerHTML = '';
      return;
    }
    const historyRows = Array.isArray(rows) ? rows : [];
    if (!historyRows.length) {
      host2.innerHTML = `
        <div style="margin-top:6px;padding:4px 2px;">
          <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">月次履歴（直近）</div>
          <div style="color:#64748b;font-size:13px;">履歴データはありません</div>
        </div>
      `;
      return;
    }
    const rowsHtml = historyRows.map((r) => {
      const month = String(r.month || '');
      const users = Number(r.closed_users || 0).toLocaleString('ja-JP');
      const count = Number(r.approved_count || 0).toLocaleString('ja-JP');
      const total = Number(r.total_amount || 0).toLocaleString('ja-JP');
      const closed = r.last_closed_at ? fmtDT(r.last_closed_at) : '-';
      return `<tr>
        <td>${month}</td>
        <td style="text-align:right;">${users}</td>
        <td style="text-align:right;">${count}</td>
        <td style="text-align:right;">${total}</td>
        <td>${closed}</td>
      </tr>`;
    }).join('');
    host2.innerHTML = `
      <div style="margin-top:4px;">
        <div style="font-weight:700;color:#0f172a;margin:0 0 6px 2px;">月次履歴（直近12ヶ月）</div>
        <div class="exp-admin-table-wrap">
          <table class="exp-admin-table">
            <thead><tr><th>月</th><th>社員数</th><th>承認件数</th><th>月次合計(円)</th><th>最終締め</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    `;
  };
  const renderChatNotice = (chats, tableHost) => {
    const chatWrap = $('#chatNotice');
    const chatList = $('#chatList');
    if (!chatWrap || !chatList) return;
    const items = Array.isArray(chats) ? chats : [];
    if (!items.length) {
      chatWrap.style.display = 'none';
      chatList.innerHTML = '';
      return;
    }
    chatWrap.style.display = '';
    chatList.innerHTML = items.slice(0, 10).map((c) => {
      const sender = c.sender_name || '';
      const emp = c.employee_name || '';
      const dt = fmtDT(c.created_at);
      const route = [c.origin || '', c.via || '', c.destination || ''].filter(Boolean).join('→');
      const purpose = c.purpose || '';
      return `<div data-exp-id="${String(c.expense_id)}" style="display:flex;gap:8px;align-items:center;">
        <span style="color:#334155;font-size:12px;">${dt}</span>
        <span style="color:#1f2937;font-weight:700;">${sender}</span>
        <span style="color:#64748b;">→</span>
        <span style="color:#1f2937;">${emp}</span>
        <span style="color:#334155;flex:1;">${route} ${purpose ? ('／目的: ' + purpose) : ''}</span>
        <button class="btn" data-action="open-chat" style="height:28px;">表示</button>
      </div>`;
    }).join('');
    chatList.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-action="open-chat"]');
      if (!b) return;
      const wrap = b.closest('div[data-exp-id]');
      const expId = wrap ? wrap.getAttribute('data-exp-id') : '';
      if (!expId) return;
      const tbody = tableHost.querySelector('tbody');
      const rowEl = tbody ? tbody.querySelector(`tr[data-id="${CSS.escape(String(expId))}"]`) : null;
      if (!rowEl) return;
      rowEl.querySelector('button[data-action="chat"]')?.click();
    }, { once: true });
  };
  const renderEmployeeMonthlyBoard = (rows, users) => {
    const host2 = $('#expEmployeeMonthHost');
    if (!host2) return;
    const items = Array.isArray(rows) ? rows : [];
    const userMap = new Map((Array.isArray(users) ? users : []).map((u) => [String(u.id), u]));
    const keyMap = new Map();
    for (const r of items) {
      const d = String(r.date || '').slice(0, 10);
      const ym = d.slice(0, 7);
      if (!ym) continue;
      const uid = String(r.userId || '');
      if (!uid) continue;
      const k = `${uid}__${ym}`;
      const prev = keyMap.get(k) || {
        userId: uid,
        ym,
        count: 0,
        amount: 0,
        statuses: new Set(),
        approver: '',
        updatedAt: ''
      };
      prev.count += 1;
      prev.amount += Number(r.amount || 0);
      prev.statuses.add(String(r.status || '').toLowerCase());
      if (!prev.approver && r.approver_name) prev.approver = String(r.approver_name);
      const upd = String(r.updated_at || r.applied_at || r.approved_at || r.date || '');
      if (!prev.updatedAt || upd > prev.updatedAt) prev.updatedAt = upd;
      keyMap.set(k, prev);
    }
    const rows2 = Array.from(keyMap.values()).sort((a, b) => {
      const aApplied = a.statuses.has('applied') ? 1 : 0;
      const bApplied = b.statuses.has('applied') ? 1 : 0;
      if (aApplied !== bApplied) return bApplied - aApplied;
      const ta = `${a.ym} ${a.updatedAt || ''}`;
      const tb = `${b.ym} ${b.updatedAt || ''}`;
      return tb.localeCompare(ta);
    }).slice(0, 200);
    const statusLabel = (set) => {
      const s = set || new Set();
      if (s.has('applied')) return '上長確認中';
      if (s.has('approved') && s.size === 1) return '承認';
      if (s.has('rejected') && s.size === 1) return '差戻し';
      if (s.has('draft') || s.has('pending')) return '未申請（下書き）';
      if (s.has('approved')) return '承認';
      return '申請中';
    };
    if (!rows2.length) {
      host2.innerHTML = '<div class="empty-state"><div style="font-size:22px;">🧾</div><div>表示対象の月次申請データがありません</div></div>';
      return;
    }
    const html = rows2.map((r) => {
      const mm = String(r.ym || '').slice(5, 7);
      const u = userMap.get(String(r.userId)) || null;
      const uname = u?.username || u?.email || String(r.userId);
      const total = Number(r.amount || 0).toLocaleString('ja-JP');
      return `<tr>
        <td>${uname}</td>
        <td>${r.ym}</td>
        <td style="text-align:right;">${Number(r.count || 0).toLocaleString('ja-JP')}</td>
        <td style="text-align:right;">${total}</td>
        <td>${statusLabel(r.statuses)}</td>
        <td>${r.approver || '-'}</td>
        <td><button class="btn exp-open-month" type="button" data-uid="${String(r.userId)}" data-month="${String(r.ym)}" style="height:28px;">開く</button></td>
      </tr>`;
    }).join('');
    host2.innerHTML = `
      <div class="exp-admin-table-wrap">
        <table class="exp-admin-table clean-view">
          <thead><tr><th>申請者</th><th>対象月</th><th>申請日数</th><th>合計金額</th><th>処理状況</th><th>作業者</th><th>表示</th></tr></thead>
          <tbody>${html}</tbody>
        </table>
      </div>
    `;
    if (!host2.dataset.boundOpen) {
      host2.dataset.boundOpen = '1';
      host2.addEventListener('click', (e) => {
        const btn = e.target.closest('.exp-open-month');
        if (!btn) return;
        const uid = String(btn.getAttribute('data-uid') || '');
        const month = String(btn.getAttribute('data-month') || '');
        const q = new URLSearchParams();
        if (month) q.set('month', month);
        if (uid) q.set('userId', uid);
        const target = `/admin/expenses/monthly-detail?${q.toString()}`;
        try { window.location.assign(target); } catch { window.location.href = target; }
      });
    }
  };
  const buildListQuery = () => {
    const month = $('#expMonth') ? $('#expMonth').value : todayMonth();
    const currentUserFilter = $('#expUserFilter') ? ($('#expUserFilter').value || '') : '';
    const deptFilter = $('#expDeptFilter') ? ($('#expDeptFilter').value || '') : '';
    const empTypeFilter = $('#expEmploymentFilter') ? ($('#expEmploymentFilter').value || '') : '';
    const nameFilter = $('#expNameFilter') ? ($('#expNameFilter').value || '').trim() : '';
    const statusFilter = $('#expStatusFilter') ? ($('#expStatusFilter').value || '') : '';
    const minAmount = $('#expMinAmount') ? ($('#expMinAmount').value || '') : '';
    const maxAmount = $('#expMaxAmount') ? ($('#expMaxAmount').value || '') : '';
    const approverFilter = $('#expApproverFilter') ? ($('#expApproverFilter').value || '') : '';
    const sortKey = $('#expSortKey') ? ($('#expSortKey').value || 'date_desc') : 'date_desc';
    const [sortBy, sortDirRaw] = String(sortKey).split('_');
    const sortDir = String(sortDirRaw || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const q = new URLSearchParams();
    q.set('month', month);
    q.set('page', String(viewState.page || 1));
    q.set('limit', String(viewState.pageSize || 20));
    q.set('sortBy', String(sortBy || 'date'));
    q.set('sortDir', sortDir);
    if (currentUserFilter) q.set('userId', currentUserFilter);
    if (deptFilter) q.set('departmentId', deptFilter);
    if (empTypeFilter) q.set('employmentType', empTypeFilter);
    if (nameFilter) q.set('name', nameFilter);
    if (statusFilter) q.set('status', statusFilter);
    if (minAmount !== '') q.set('minAmount', minAmount);
    if (maxAmount !== '') q.set('maxAmount', maxAmount);
    if (approverFilter) q.set('approverId', approverFilter);
    return { month, currentUserFilter, q };
  };
  const reload = async () => {
    const { month, currentUserFilter, q } = buildListQuery();
    const status = $('#expStatus');
    const tableHost = $('#expTableHost');
    if (tableHost) tableHost.innerHTML = '';
    if (status) status.textContent = '読み込み中…';
    showSpinner();
    try {
      const qBoard = new URLSearchParams(q);
      qBoard.delete('month');
      qBoard.set('page', '1');
      qBoard.set('limit', '1000');
      const [rowsRes, usersRes, chatsRes, monthlyRes, historyRes, deptRes, boardRes] = await Promise.allSettled([
        fetchJSONAuth(`/api/expenses/admin/list?${q.toString()}`),
        fetchJSONAuth('/api/admin/users'),
        fetchJSONAuth(`/api/expenses/admin/messages?month=${encodeURIComponent(month)}`),
        fetchJSONAuth(`/api/expenses/admin/monthly-summary?month=${encodeURIComponent(month)}${currentUserFilter ? `&userId=${encodeURIComponent(currentUserFilter)}` : ''}`),
        fetchJSONAuth(`/api/expenses/admin/monthly-history?limit=12${currentUserFilter ? `&userId=${encodeURIComponent(currentUserFilter)}` : ''}`),
        fetchJSONAuth('/api/admin/departments'),
        fetchJSONAuth(`/api/expenses/admin/list?${qBoard.toString()}`)
      ]);
      const rowsPayload = rowsRes.status === 'fulfilled' ? rowsRes.value : { rows: [], total: 0, page: 1, limit: viewState.pageSize };
      const rows = Array.isArray(rowsPayload) ? rowsPayload : (Array.isArray(rowsPayload?.rows) ? rowsPayload.rows : []);
      const totalRows = Array.isArray(rowsPayload) ? rows.length : Number(rowsPayload?.total || rows.length);
      viewState.page = Math.max(1, Number(rowsPayload?.page || viewState.page || 1));
      viewState.pageSize = Math.max(1, Number(rowsPayload?.limit || viewState.pageSize || 20));

      const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
      const boardPayload = boardRes.status === 'fulfilled' ? boardRes.value : { rows: [] };
      const boardRows = Array.isArray(boardPayload) ? boardPayload : (Array.isArray(boardPayload?.rows) ? boardPayload.rows : []);
      const departments = deptRes.status === 'fulfilled' && Array.isArray(deptRes.value) ? deptRes.value : [];
      const chats = chatsRes.status === 'fulfilled' && Array.isArray(chatsRes.value) ? chatsRes.value : [];
      const monthlyRaw = monthlyRes.status === 'fulfilled' ? monthlyRes.value : { totals: [], closures: [] };
      const monthly = (() => {
        const closures0 = Array.isArray(monthlyRaw?.closures) ? monthlyRaw.closures : [];
        const isMonthMatch = (x) => String(x?.month || '').slice(0, 7) === month;
        const closures = closures0.filter(isMonthMatch);
        if (!currentUserFilter) return { totals: [], closures };
        const byUser = (x) => String(x?.user_id ?? x?.userId ?? '') === String(currentUserFilter);
        return { totals: [], closures: closures.filter(byUser) };
      })();
      const history = historyRes.status === 'fulfilled' && Array.isArray(historyRes.value) ? historyRes.value : [];
      const nameMap = new Map(users.map(u => [String(u.id), u.username || u.email || '']));
      const uf = $('#expUserFilter');
      if (uf && !uf.dataset.bound) {
        uf.dataset.bound = '1';
        uf.innerHTML = '<option value="">全員</option>' + users.map(u => `<option value="${String(u.id)}">${u.username || u.email || String(u.id)}</option>`).join('');
        if (initialUserId && !initialUserApplied) {
          uf.value = initialUserId;
          initialUserApplied = true;
          if (!currentUserFilter) {
            viewState.page = 1;
            await reload();
            return;
          }
        }
        uf.addEventListener('change', async () => {
          viewState.page = 1;
          await reload();
        });
      }
      const df = $('#expDeptFilter');
      if (df && !df.dataset.bound) {
        df.dataset.bound = '1';
        df.innerHTML = '<option value="">全て</option>' + departments.map(d => `<option value="${String(d.id)}">${d.name || d.code || ('#'+String(d.id))}</option>`).join('');
        df.addEventListener('change', async () => { viewState.page = 1; await reload(); });
      }
      const af = $('#expApproverFilter');
      if (af && !af.dataset.bound) {
        af.dataset.bound = '1';
        const approvers = users.filter((u) => ['admin', 'manager'].includes(String(u.role || '').toLowerCase()));
        af.innerHTML = '<option value="">承認者: 全て</option>' + approvers.map(u => `<option value="${String(u.id)}">${u.username || u.email || String(u.id)}</option>`).join('');
        af.addEventListener('change', async () => { viewState.page = 1; await reload(); });
      }
      const filteredRows = rows;
      const aggregateMode = $('#expAggregateMode') ? ($('#expAggregateMode').value || 'approved') : 'approved';
      renderMonthlyKpi(filteredRows);
      renderEmployeeMonthlyBoard(boardRows, users);
      const aggregateRows = filteredRows.filter((r) => includeByMode(r.status, aggregateMode));
      const totalsMap = new Map();
      aggregateRows.forEach((r) => {
        const uid = String(r.userId || '');
        if (!uid) return;
        const prev = totalsMap.get(uid) || { user_id: uid, user_name: nameMap.get(uid) || uid, month, item_count: 0, total_amount: 0 };
        prev.item_count += 1;
        prev.total_amount += Number(r.amount || 0);
        totalsMap.set(uid, prev);
      });
      const computedTotals = Array.from(totalsMap.values()).sort((a, b) => String(a.user_name || '').localeCompare(String(b.user_name || '')));
      renderMonthlySummary({ month, totals: computedTotals, closures: monthly.closures }, aggregateMode);
      renderMonthlyHistory(history);
      const toggleDetailsBtn = $('#expToggleDetails');
      if (toggleDetailsBtn) {
        toggleDetailsBtn.textContent = viewState.showDetails ? '明細非表示' : '明細表示';
      }
      renderChatNotice(chats, tableHost);
      if (!filteredRows.length) {
        if (tableHost) tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>データはありません</div></div>';
      } else {
        if (!viewState.showDetails) {
          if (tableHost) {
            tableHost.innerHTML = `<div class="empty-state"><div style="font-size:24px;">📁</div><div>明細は非表示です。「明細表示」を押すと一覧を表示します。</div></div>`;
          }
          if (status) status.textContent = '';
          hideSpinner();
          return;
        }
        const totalPages = Math.max(1, Math.ceil(totalRows / viewState.pageSize));
        viewState.page = Math.min(Math.max(1, viewState.page), totalPages);
        const startIdx = (viewState.page - 1) * viewState.pageSize;
        const pageRows = filteredRows;
        const thead = '<thead><tr><th>ユーザー</th><th>日付</th><th>経路</th><th>金額</th><th>状態</th><th>操作</th></tr></thead>';
        const rowsHtml = pageRows.map(r => {
          const d = String(r.date || '').slice(0, 10);
          const a = Number(r.amount || 0).toLocaleString('ja-JP');
          const user = nameMap.get(String(r.userId)) || String(r.userId || '');
          const st = String(r.status || 'pending');
          const stLower = st.toLowerCase();
          const stLabel = stLower === 'approved' ? '承認済み' : stLower === 'applied' ? '申請中' : stLower === 'rejected' ? '差戻し' : st;
          const id = String(r.id || '');
          const applied = r.applied_at ? fmtDT(r.applied_at) : '';
          const approved = r.approved_at ? fmtDT(r.approved_at) : '';
          const timeText =
            st === 'applied' ? (applied ? `申請: ${applied}` : '') :
            st === 'approved' ? (approved ? `承認: ${approved}` : '') :
            st === 'rejected' ? (approved ? `却下: ${approved}` : '') : '';
          const approver = r.approver_id ? (nameMap.get(String(r.approver_id)) || '') : '';
          const statusMeta = [timeText, approver ? `担当: ${approver}` : ''].filter(Boolean).join(' / ');
          const ru = r.receipt_url ? String(r.receipt_url) : (r.first_file_path ? String(r.first_file_path) : '');
          const ruAttr = ru ? ` data-url="${ru}"` : '';
          const count = Number(r.file_count || 0);
          const routeText = [r.origin || '', r.via || '', r.destination || ''].filter(Boolean).join(' → ');
          const receiptAction = (ru || count > 0)
            ? `<button class="btn" data-action="files"${ruAttr} type="button" style="height:28px;">領収書${count > 1 ? `(${count})` : ''}</button>`
            : `<button class="btn" data-action="files" type="button" style="height:28px;" disabled>領収書なし</button>`;
          return `
            <tr data-id="${id}">
              <td>${user}</td>
              <td>${d}</td>
              <td class="route-col">${routeText || '-'}</td>
              <td style="text-align:right;">${a}</td>
              <td>
                <span class="status-main ${stLower}">
                  <span class="s-ico">${stLower === 'approved' ? '✔' : stLower === 'applied' ? '⏳' : stLower === 'rejected' ? '↩' : '•'}</span>
                  <span>${stLabel}</span>
                </span>
                ${statusMeta ? `<div class="status-sub">${statusMeta}</div>` : ''}
              </td>
              <td>
                <details style="position:relative;">
                  <summary class="btn" style="height:28px;list-style:none;cursor:pointer;">⋯</summary>
                  <div style="position:absolute;right:0;top:32px;z-index:20;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 20px rgba(0,0,0,.12);padding:6px;display:grid;gap:6px;min-width:116px;">
                    <button class="btn" data-action="edit" style="height:28px;">編集</button>
                    <button class="btn" data-action="approve" style="height:28px;">承認</button>
                    <button class="btn" data-action="reject" style="height:28px;">却下</button>
                    ${receiptAction}
                    <button class="btn" data-action="delete" style="height:28px;">削除</button>
                    <button class="btn" data-action="chat" style="height:28px;">チャット</button>
                  </div>
                </details>
              </td>
            </tr>`;
        }).join('');
        const pager = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0 10px;">
            <div style="color:#64748b;font-size:12px;">${startIdx + 1}-${Math.min(startIdx + viewState.pageSize, totalRows)} / ${totalRows} 件</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <label style="font-size:12px;color:#334155;">表示件数
                <select id="expPageSize" style="margin-left:4px;height:28px;">
                  <option value="20" ${viewState.pageSize === 20 ? 'selected' : ''}>20</option>
                  <option value="50" ${viewState.pageSize === 50 ? 'selected' : ''}>50</option>
                  <option value="100" ${viewState.pageSize === 100 ? 'selected' : ''}>100</option>
                </select>
              </label>
              <button class="btn exp-page-btn" data-page="${Math.max(1, viewState.page - 1)}" ${viewState.page <= 1 ? 'disabled' : ''} style="height:28px;">前</button>
              <span style="font-size:12px;color:#334155;">${viewState.page} / ${totalPages}</span>
              <button class="btn exp-page-btn" data-page="${Math.min(totalPages, viewState.page + 1)}" ${viewState.page >= totalPages ? 'disabled' : ''} style="height:28px;">次</button>
            </div>
          </div>
        `;
        const tbl = `
          ${pager}
          <div class="exp-admin-table-wrap">
            <table class="exp-admin-table clean-view">
              ${thead}
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
        tableHost.innerHTML = tbl;
        tableHost.querySelectorAll('.exp-page-btn').forEach((b) => {
          b.addEventListener('click', async () => {
            const next = parseInt(String(b.getAttribute('data-page') || '1'), 10);
            viewState.page = Number.isFinite(next) && next > 0 ? next : 1;
            await reload();
          });
        });
        const pageSizeSel = tableHost.querySelector('#expPageSize');
        pageSizeSel?.addEventListener('change', async () => {
          const n = parseInt(String(pageSizeSel.value || '10'), 10);
          viewState.pageSize = [10, 20, 50].includes(n) ? n : 10;
          viewState.page = 1;
          await reload();
        });
        const tbody = tableHost.querySelector('tbody');
        if (tbody && !tbody.dataset.bound) {
          tbody.dataset.bound = '1';
          tbody.addEventListener('click', async (e) => {
            const link = e.target.closest('a.receipt-link');
            const rowEl2 = e.target.closest('tr[data-id]');
            if (link && rowEl2) {
              const c = parseInt(String(link.getAttribute('data-count')||'0'),10);
              if (c>1) {
                e.preventDefault();
                const filesBtn = rowEl2.querySelector('button[data-action="files"]');
                filesBtn?.click();
                return;
              }
            }
            const btn = e.target.closest('button[data-action]');
            if (!btn) {
              return;
            }
            const rowEl3 = btn.closest('tr[data-id]');
            const id = rowEl3 ? rowEl3.getAttribute('data-id') : '';
            if (!id) return;
            const action = btn.getAttribute('data-action');
            const status = action === 'approve' ? 'approved' : 'rejected';
            btn.disabled = true;
            try {
              if (action === 'approve' || action === 'reject') {
                let note = '';
                if (action === 'reject') {
                  note = window.prompt('却下理由を入力してください（必須）', '') || '';
                }
                await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/status`, { method:'PATCH', body: JSON.stringify({ status, note }) });
                await reload();
              } else if (action === 'edit') {
                const ensureEditModal = () => {
                  let modal = document.getElementById('adminEditModal');
                  if (modal) return modal;
                  modal = document.createElement('div');
                  modal.id = 'adminEditModal';
                  modal.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);width:720px;max-width:95%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 24px 48px rgba(0,0,0,.16);padding:16px;display:none;z-index:1400;';
                  modal.innerHTML = `
                    <div style="font-weight:800;color:#0b2c66;margin-bottom:8px;">編集（管理）</div>
                    <div class="adjust-grid" style="grid-template-columns: 120px 1fr;">
                      <div class="adjust-label">日付</div><div><input id="adDate" type="date" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">費目</div><div><select id="adType" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"><option value="train">電車</option><option value="bus">バス</option><option value="taxi">タクシー</option><option value="private_car">自家用車</option><option value="parking">駐車場</option><option value="highway">高速道路</option></select></div>
                      <div class="adjust-label">出発</div><div><input id="adOrigin" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">経由</div><div><input id="adVia" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">到着</div><div><input id="adDestination" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">片道/往復</div><div><select id="adTripType" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"><option value="one_way">片道</option><option value="round_trip">往復</option></select></div>
                      <div class="adjust-label">回数</div><div><input id="adTripCount" type="number" min="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">距離(km)</div><div><input id="adKm" type="number" step="0.1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">単価</div><div><input id="adUnitPrice" type="number" step="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">目的</div><div><input id="adPurpose" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">定期</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="adTeiki" type="checkbox"><span>定期区間内</span></label></div>
                      <div class="adjust-label">通勤</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="adCommuter" type="checkbox"><span>通勤パス</span></label></div>
                      <div class="adjust-label">金額</div><div><input id="adAmount" type="number" step="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">メモ</div><div><input id="adMemo" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                      <button id="adCancel" class="btn" type="button" style="height:32px;">キャンセル</button>
                      <button id="adSave" class="btn btn-primary" type="button" style="height:32px;">保存</button>
                      <button id="adApply" class="btn" type="button" style="height:32px;">申請</button>
                    </div>
                  `;
                  document.body.appendChild(modal);
                  return modal;
                };
                const openEdit = async (recId) => {
                  const modal = ensureEditModal();
                  const backdrop = document.getElementById('drawerBackdrop');
                  try {
                    const r = filteredRows.find(x => String(x.id) === String(recId)) || await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`);
                    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
                    set('adDate', r.date ? String(r.date).slice(0,10) : todayMonth()+'-01');
                    set('adType', r.type || (r.category || 'train'));
                    set('adOrigin', r.origin || '');
                    set('adVia', r.via || '');
                    set('adDestination', r.destination || '');
                    set('adTripType', r.trip_type || 'one_way');
                    set('adTripCount', r.trip_count != null ? String(r.trip_count) : '1');
                    set('adKm', r.distance_km != null ? String(r.distance_km) : '');
                    set('adUnitPrice', r.unit_price_per_km != null ? String(r.unit_price_per_km) : '');
                    set('adPurpose', r.purpose || '');
                    try { const c1 = document.getElementById('adTeiki'); if (c1) c1.checked = !!r.teiki_flag; } catch {}
                    try { const c2 = document.getElementById('adCommuter'); if (c2) c2.checked = !!r.commuter_pass; } catch {}
                    set('adAmount', r.amount != null ? String(r.amount) : '');
                    set('adMemo', r.memo || '');
                  } catch {}
                  if (backdrop) { backdrop.removeAttribute('hidden'); backdrop.style.display='block'; }
                  modal.style.display = 'block';
                  const onCancel = () => { modal.style.display='none'; if (backdrop){backdrop.setAttribute('hidden',''); backdrop.style.display='none';} cleanup(); };
                  const onSave = async () => {
                    const payload = {
                      date: document.getElementById('adDate')?.value,
                      type: document.getElementById('adType')?.value,
                      origin: document.getElementById('adOrigin')?.value,
                      via: document.getElementById('adVia')?.value,
                      destination: document.getElementById('adDestination')?.value,
                      trip_type: document.getElementById('adTripType')?.value,
                      trip_count: parseInt(String(document.getElementById('adTripCount')?.value||'1'),10),
                      distance_km: parseFloat(String(document.getElementById('adKm')?.value||'')),
                      unit_price_per_km: parseFloat(String(document.getElementById('adUnitPrice')?.value||'')),
                      purpose: document.getElementById('adPurpose')?.value,
                      teiki_flag: !!document.getElementById('adTeiki')?.checked,
                      commuter_pass: !!document.getElementById('adCommuter')?.checked,
                      amount: parseFloat(String(document.getElementById('adAmount')?.value||'')),
                      memo: document.getElementById('adMemo')?.value
                    };
                    try {
                      const current = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`);
                      const changed = [];
                      const cmp = (k, nv, ov) => { const n = nv==null?'':String(nv); const o = ov==null?'':String(ov); if (n!==o) changed.push(`${k}: ${o} → ${n}`); };
                      cmp('日付', payload.date, current.date ? String(current.date).slice(0,10) : '');
                      cmp('費目', payload.type, current.type || current.category);
                      cmp('出発', payload.origin, current.origin);
                      cmp('経由', payload.via, current.via);
                      cmp('到着', payload.destination, current.destination);
                      cmp('片道/往復', payload.trip_type, current.trip_type);
                      cmp('回数', payload.trip_count, current.trip_count);
                      cmp('距離(km)', payload.distance_km, current.distance_km);
                      cmp('単価', payload.unit_price_per_km, current.unit_price_per_km);
                      cmp('目的', payload.purpose, current.purpose);
                      cmp('定期', payload.teiki_flag, current.teiki_flag);
                      cmp('通勤', payload.commuter_pass, current.commuter_pass);
                      cmp('金額', payload.amount, current.amount);
                      cmp('メモ', payload.memo, current.memo);
                      const msg = changed.length ? ('変更内容:\n' + changed.join('\n') + '\n保存しますか？') : '変更はありません。保存しますか？';
                      const ok = window.confirm(msg);
                      if (!ok) return;
                    } catch {}
                    try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`, { method:'PATCH', body: JSON.stringify(payload) }); await reload(); onCancel(); } catch (errU) {
                      const status = document.getElementById('expStatus');
                      if (status) {
                        status.textContent = `更新に失敗しました: ${String(errU?.message || 'unknown')}`;
                        status.style.display = 'block';
                        status.style.color = '#b00020';
                      }
                    }
                  };
                  const onApply = async () => {
                    try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}/apply`, { method:'POST' }); await reload(); onCancel(); } catch (errA) {
                      const status = document.getElementById('expStatus');
                      if (status) {
                        status.textContent = `申請に失敗しました: ${String(errA?.message || 'unknown')}`;
                        status.style.display = 'block';
                        status.style.color = '#b00020';
                      }
                    }
                  };
                  const cancelBtn = document.getElementById('adCancel');
                  const saveBtn = document.getElementById('adSave');
                  const applyBtn = document.getElementById('adApply');
                  cancelBtn?.addEventListener('click', onCancel);
                  saveBtn?.addEventListener('click', onSave);
                  applyBtn?.addEventListener('click', onApply);
                  const cleanup = () => {
                    cancelBtn?.removeEventListener('click', onCancel);
                    saveBtn?.removeEventListener('click', onSave);
                    applyBtn?.removeEventListener('click', onApply);
                  };
                };
                await openEdit(id);
              } else if (action === 'files') {
                let rows = [];
                try { rows = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/files`); } catch {}
                const next = rowEl3.nextElementSibling;
                if (next && next.classList.contains('files-row')) {
                  next.remove();
                  btn.disabled = false;
                  return;
                }
                if (Array.isArray(rows) && rows.length === 1) {
                  const f = rows[0];
                  const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                  try { window.open(url, '_blank'); } catch { window.location.href = url; }
                }
                if ((!rows || rows.length === 0) && btn.hasAttribute('data-url')) {
                  const url2 = btn.getAttribute('data-url') || '';
                  if (url2) { try { window.open(url2.startsWith('/')?url2:'/'+url2, '_blank'); } catch { window.location.href = (url2.startsWith('/')?url2:'/'+url2); } }
                }
                const filesHtml = Array.isArray(rows) && rows.length
                  ? rows.map(f => {
                      const isImg = String(f.mime || '').startsWith('image/');
                      const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                      const thumb = isImg ? `<img src="${url}" alt="${f.name || ''}" style="width:80px;height:auto;border:1px solid #e5e7eb;border-radius:8px;" />` : `<span style="font-weight:700;color:#1e40af;">PDF</span>`;
                      const name = f.name || f.original_name || url.split('/').pop();
                      return `<li style="display:flex;align-items:center;gap:8px;"><a href="${url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:none;">${thumb}<span>${name}</span></a></li>`;
                    }).join('')
                  : '<li>ファイルなし</li>';
                const expand = document.createElement('tr');
                expand.className = 'files-row';
                expand.innerHTML = `<td colspan="6"><ul style="list-style:none;padding:0;margin:6px 0;display:flex;gap:8px;flex-wrap:wrap;">${filesHtml}</ul></td>`;
                rowEl3.after(expand);
              } else if (action === 'delete') {
                const ok = window.confirm('削除しますか？');
                if (!ok) { btn.disabled = false; return; }
                await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}`, { method:'DELETE' });
                await reload();
              }
            } catch {}
            if (action === 'chat') {
              const next = rowEl3.nextElementSibling;
              if (next && next.classList.contains('chat-row')) {
                next.remove();
                btn.disabled = false;
                return;
              }
              const chat = document.createElement('tr');
              chat.className = 'chat-row';
              chat.innerHTML = `<td colspan="6">
                <div class="chat-box" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;">
                  <div class="chat-header" style="font-weight:700;color:#1f2937;margin-bottom:8px;">やり取り</div>
                  <div class="chat-reason" style="margin-bottom:8px;color:#7f1d1d;font-weight:700;"></div>
                  <div class="chat-messages" style="max-height:220px;overflow:auto;padding:6px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;"></div>
                  <div class="chat-input" style="display:flex;gap:8px;margin-top:8px;">
                    <input type="text" class="chat-text" placeholder="メッセージを入力…" style="flex:1;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;">
                    <button class="btn chat-send" type="button" style="height:36px;">送信</button>
                  </div>
                </div>
              </td>`;
              rowEl3.after(chat);
              const box = chat.querySelector('.chat-messages');
              const text = chat.querySelector('.chat-text');
              const send = chat.querySelector('.chat-send');
              const reasonEl = chat.querySelector('.chat-reason');
              try {
                const rec = rows.find(x => String(x.id) === String(id));
                const reason = rec && rec.manager_note ? String(rec.manager_note) : '';
                if (reasonEl) reasonEl.textContent = reason ? ('差戻し理由: ' + reason) : '';
              } catch {}
              const load = async () => {
                try {
                  const msgs = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/messages`);
                  box.innerHTML = Array.isArray(msgs) && msgs.length
                    ? msgs.map(m => {
                        const who = m.sender_name || '';
                        const when = fmtDT(m.created_at);
                        const me = String(m.sender_user_id) === String(window.ADMIN_ID || '');
                        return `<div style="display:flex;margin:6px 0;${me?'justify-content:flex-end':''}">
                          <div style="max-width:70%;padding:8px 10px;border-radius:12px;${me?'background:#dbeafe;color:#1e3a8a;':'background:#e2e8f0;color:#111827;'}">
                            <div style="font-size:12px;color:#334155;font-weight:700;display:flex;justify-content:space-between;gap:8px;"><span>${who}</span><span style="color:#64748b;">${when}</span></div>
                            <div>${m.message}</div>
                          </div>
                        </div>`;
                      }).join('')
                    : '<div style="color:#64748b;">メッセージはありません</div>';
                } catch {
                  box.innerHTML = '<div style="color:#b00020;">読み込みに失敗しました</div>';
                }
              };
              await load();
              const doSend = async () => {
                const val = String(text.value || '').trim();
                if (!val) return;
                send.disabled = true;
                try {
                  await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/messages`, { method:'POST', body: JSON.stringify({ message: val }) });
                  text.value = '';
                  await load();
                } catch (errSend) {}
                send.disabled = false;
              };
              send.addEventListener('click', doSend);
              text.addEventListener('keydown', async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); await doSend(); } });
              btn.disabled = false;
              return;
            }
            btn.disabled = false;
          });
        }
      }
      if (status) status.textContent = '';
    } catch (e) {
      if (status) status.textContent = `取得失敗: ${String(e?.message || 'unknown')}`;
    } finally { hideSpinner(); }
  };
  const btn = $('#expReload');
  if (btn) btn.addEventListener('click', reload);
  const monthInput = $('#expMonth');
  monthInput?.addEventListener('change', async () => {
    viewState.page = 1;
    await reload();
  });
  const aggregateMode = $('#expAggregateMode');
  aggregateMode?.addEventListener('change', async () => {
    viewState.page = 1;
    await reload();
  });
  ['#expDeptFilter','#expEmploymentFilter','#expStatusFilter','#expApproverFilter','#expSortKey'].forEach((sel) => {
    const el = $(sel);
    el?.addEventListener('change', async () => { viewState.page = 1; await reload(); });
  });
  ['#expNameFilter','#expMinAmount','#expMaxAmount'].forEach((sel) => {
    const el = $(sel);
    el?.addEventListener('keydown', async (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      viewState.page = 1;
      await reload();
    });
  });
  const exportBtn = $('#expExportCsv');
  exportBtn?.addEventListener('click', async () => {
    try {
      const { q } = buildListQuery();
      q.set('page', '1');
      q.set('limit', '1000');
      const url = `/api/expenses/admin/export.csv?${q.toString()}`;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  });
  const toggleDetailsBtn = $('#expToggleDetails');
  toggleDetailsBtn?.addEventListener('click', async () => {
    viewState.showDetails = !viewState.showDetails;
    viewState.page = 1;
    await reload();
  });
  const toggleHistoryBtn = $('#expToggleHistory');
  toggleHistoryBtn?.addEventListener('click', async () => {
    viewState.showHistory = !viewState.showHistory;
    toggleHistoryBtn.textContent = viewState.showHistory ? '履歴閉じる' : '履歴';
    await reload();
  });
  const closeBtn = $('#expMonthlyClose');
  const recalcBtn = $('#expMonthlyRecalc');
  const monthlyStatus = $('#expMonthlyStatus');
  const runMonthlyClose = async (forceRecalc) => {
    const month = $('#expMonth') ? $('#expMonth').value : todayMonth();
    const selectedUser = $('#expUserFilter') ? ($('#expUserFilter').value || '') : '';
    const actionLabel = forceRecalc ? '再計算' : '月次締め';
    const scopeLabel = selectedUser ? '選択中の社員' : '全社員';
    const ok = window.confirm(`${month} の交通費を${scopeLabel}対象で${actionLabel}しますか？`);
    if (!ok) return;
    if (monthlyStatus) {
      monthlyStatus.style.display = 'block';
      monthlyStatus.style.color = '#334155';
      monthlyStatus.textContent = `${actionLabel} 実行中...`;
    }
    try {
      const r = await fetchJSONAuth('/api/expenses/admin/monthly-close', {
        method: 'POST',
        body: JSON.stringify({ month, forceRecalc: !!forceRecalc, userId: selectedUser || null })
      });
      const n = Number(r?.result?.affectedUsers || 0);
      if (monthlyStatus) {
        monthlyStatus.style.color = '#166534';
        monthlyStatus.textContent = `${actionLabel} 完了: ${n}名`;
      }
      await reload();
    } catch (e) {
      if (monthlyStatus) {
        monthlyStatus.style.color = '#b00020';
        monthlyStatus.textContent = `${actionLabel} 失敗: ${String(e?.message || 'unknown')}`;
      }
    }
  };
  closeBtn?.addEventListener('click', async () => { await runMonthlyClose(false); });
  recalcBtn?.addEventListener('click', async () => { await runMonthlyClose(true); });
  await reload();
  try {
    pollTimer = window.setInterval(async () => {
      try {
        const month = $('#expMonth') ? $('#expMonth').value : todayMonth();
        const chats = await fetchJSONAuth(`/api/expenses/admin/messages?month=${encodeURIComponent(month)}`);
        renderChatNotice(chats, $('#expTableHost'));
      } catch {}
    }, 30000);
  } catch {}
  return () => {
    try { if (pollTimer) window.clearInterval(pollTimer); } catch {}
    try { hideSpinner(); } catch {}
    try {
      const backdrop = document.getElementById('drawerBackdrop');
      if (backdrop) {
        backdrop.setAttribute('hidden', '');
        backdrop.style.display = 'none';
      }
    } catch {}
    try {
      const modal = document.getElementById('adminEditModal');
      if (modal) {
        modal.style.display = 'none';
        modal.remove();
      }
    } catch {}
  };
};

export async function mount() {
  const profile = await requireAdmin();
  if (!profile) return;
  try { window.ADMIN_ID = profile.id; } catch {}
  return await render();
}
