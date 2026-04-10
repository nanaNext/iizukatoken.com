import { delegate } from '../_shared/dom.js';
import { api, downloadWithAuth } from '../../shared/api/client.js';

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
    <a class="${activeTab === 'salary_send' ? 'active' : ''}" href="${tabHref('salary_send')}">送信・履歴</a>
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
  content.innerHTML = '<h3>給与明細</h3>';
  // nav hidden intentionally per requirements

  (function mountLocalStyle(){
    if (document.getElementById('payslipHistoryStyle')) return;
    const st = document.createElement('style');
    st.id = 'payslipHistoryStyle';
    st.textContent = `
      .ps-table{width:100%;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-collapse:separate;border-spacing:0;table-layout:fixed}
      .ps-table th,.ps-table td{padding:10px 12px;border-top:1px solid #f1f5f9;text-align:left;vertical-align:middle}
      .ps-table thead th{background:#f8fafc;color:#334155;font-weight:900}
      .ps-table tr:nth-child(even) td{background:#fbfdff}
      .ps-col-user{width:30%}
      .ps-col-month{width:14%}
      .ps-col-file{width:28%}
      .ps-col-sender{width:14%}
      .ps-col-time{width:14%}
      .ps-col-count{width:20%}
      .btn-neutral{display:inline-block;padding:4px 10px;border:1px solid #cbd5e1;background:#fff;color:#0b2c66;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer}
      .btn-neutral:hover{background:#f1f5f9;border-color:#94a3b8}
    `;
    document.head.appendChild(st);
  })();

  const info = document.createElement('div');
  info.style.margin = '6px 0 10px 0';
  info.style.color = '#64748b';
  info.style.fontWeight = '800';
  info.innerHTML = `
    全社員の配信履歴・PDF作成履歴を表示します
    <div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <label style="font-weight:900;color:#334155">対象月</label>
      <input id="psMonth" type="month" style="height:36px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:10px;">
      <button id="psClear" type="button" style="height:36px;padding:0 12px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;font-weight:900;cursor:pointer;">クリア</button>
    </div>
  `;
  content.appendChild(info);

  const monthsCard = document.createElement('div');
  monthsCard.style.margin = '10px 0';
  monthsCard.innerHTML = `
    <div style="font-weight:900;color:#0f172a;margin:8px 0;">月別サマリー</div>
    <div id="monthsHost">
      <table class="ps-table">
        <thead>
          <tr>
            <th class="ps-col-month">月</th>
            <th class="ps-col-count">配信人数</th>
            <th class="ps-col-count">PDF作成人数</th>
          </tr>
        </thead>
        <tbody id="monthsBody"></tbody>
      </table>
    </div>
  `;
  content.appendChild(monthsCard);

  const historyWrap = document.createElement('div');
  historyWrap.style.marginTop = '16px';
  historyWrap.innerHTML = `
    <details open>
      <summary style="cursor:pointer;font-weight:900;">配信履歴</summary>
      <div id="delivBox"></div>
    </details>
    <details open style="margin-top:12px;">
      <summary style="cursor:pointer;font-weight:900;">PDF作成履歴</summary>
      <div id="fileBox"></div>
    </details>
  `;
  content.appendChild(historyWrap);

  let selectedMonth = '';
  async function loadHistory() {
    const delivBox = historyWrap.querySelector('#delivBox');
    const fileBox = historyWrap.querySelector('#fileBox');
    if (delivBox) delivBox.textContent = '読み込み中...';
    if (fileBox) fileBox.textContent = '読み込み中...';
    try {
      const qs = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : '';
      const d = await api.get(`/api/admin/salary/deliveries${qs}`);
      const f = await api.get(`/api/admin/salary/files${qs}`);
      if (delivBox) {
        const items = Array.isArray(d?.items) ? d.items : [];
        const t = document.createElement('table');
        t.className = 'ps-table';
        t.innerHTML = '<thead><tr><th class="ps-col-user">User</th><th class="ps-col-month">月</th><th class="ps-col-file">ファイル</th><th class="ps-col-sender">送信者</th><th class="ps-col-time">送信日時</th><th style="width:12%">アクション</th></tr></thead>';
        const tb = document.createElement('tbody');
        items.forEach(it => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${it.userId} ${it.userName || ''}</td>
            <td>${it.month}</td>
            <td>${it.fileId ? `<a href="#" data-dl-file-id="${it.fileId}" data-file-name="${(it.fileName || '').replace(/"/g,'')}">${it.fileName || ''}</a>` : (it.fileName || '')}</td>
            <td>${it.senderName || it.sentBy || ''}</td>
            <td>${it.sentAt || ''}</td>
            <td style="white-space:nowrap;">
              <button class="btn-neutral" data-act="unpublish" data-user="${it.userId}" data-month="${it.month}">取消公開</button>
              <button class="btn-neutral" data-act="del-delivery" data-id="${it.id}">削除</button>
            </td>`;
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        delivBox.innerHTML = '';
        delivBox.appendChild(t);
        delivBox.querySelectorAll('a[data-dl-file-id]').forEach(a => {
          a.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = e.currentTarget.dataset.dlFileId;
            const name = e.currentTarget.dataset.fileName || 'payslip.pdf';
            try { await downloadWithAuth(`/api/payslips/admin/file/${encodeURIComponent(id)}`, name); }
            catch (err) { alert('ダウンロードに失敗しました: ' + (err?.message || 'unknown')); }
          });
        });
        delivBox.querySelectorAll('button.btn-neutral').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const b = e.currentTarget;
            const act = b.dataset.act;
            if (act === 'unpublish') {
              const userId = b.dataset.user;
              const month = b.dataset.month;
              if (!confirm(`「${month}」の公開を取り消しますか？`)) return;
              try {
                await api.post('/api/admin/salary/publish', { userId, month, is_published: false });
                await loadHistory();
                await refreshMonthSummary();
              } catch (err) {
                alert('取消公開に失敗しました: ' + (err?.message || 'unknown'));
              }
              } else if (act === 'del-delivery') {
              const id = b.dataset.id;
              if (!confirm('配信履歴を削除しますか？')) return;
              try {
                await api.del(`/api/admin/salary/deliveries/${encodeURIComponent(id)}`);
                await loadHistory();
                await refreshMonthSummary();
              } catch (err) {
                alert('削除に失敗しました: ' + (err?.message || 'unknown'));
              }
            }
          });
        });
      }
      if (fileBox) {
        const items = Array.isArray(f?.items) ? f.items : [];
        const t = document.createElement('table');
        t.className = 'ps-table';
        t.innerHTML = '<thead><tr><th class="ps-col-user">User</th><th class="ps-col-month">月</th><th class="ps-col-file">ファイル</th><th class="ps-col-sender">作成者</th><th class="ps-col-time">作成日時</th><th style="width:12%">アクション</th></tr></thead>';
        const tb = document.createElement('tbody');
        items.forEach(it => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${it.userId} ${it.userName || ''}</td>
            <td>${it.month}</td>
            <td>${it.id ? `<a href="#" data-dl-file-id="${it.id}" data-file-name="${(it.fileName || '').replace(/"/g,'')}">${it.fileName || ''}</a>` : (it.fileName || '')}</td>
            <td>${it.uploaderName || it.uploadedBy || ''}</td>
            <td>${it.createdAt || ''}</td>
            <td style="white-space:nowrap;">
              <button class="btn-neutral" data-act="del-file" data-id="${it.id}">削除</button>
            </td>`;
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        fileBox.innerHTML = '';
        fileBox.appendChild(t);
        fileBox.querySelectorAll('a[data-dl-file-id]').forEach(a => {
          a.addEventListener('click', async (e) => {
            e.preventDefault();
            const id = e.currentTarget.dataset.dlFileId;
            const name = e.currentTarget.dataset.fileName || 'payslip.pdf';
            try { await downloadWithAuth(`/api/payslips/admin/file/${encodeURIComponent(id)}`, name); }
            catch (err) { alert('ダウンロードに失敗しました: ' + (err?.message || 'unknown')); }
          });
        });
        fileBox.querySelectorAll('button.btn-neutral').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const reason = prompt('削除理由を入力してください');
            if (reason == null) return;
            try {
              await api.del(`/api/payslips/admin/${encodeURIComponent(id)}`, { body: JSON.stringify({ reason }) });
              await loadHistory();
              await refreshMonthSummary();
            } catch (err) {
              alert('削除に失敗しました: ' + (err?.message || 'unknown'));
            }
          });
        });
      }
    } catch (e) {
      const msg = String(e?.message || '読み込み失敗');
      try { console.error('payslip history load error:', e); } catch {}
      if (delivBox) delivBox.textContent = `読み込み失敗: ${msg}`;
      if (fileBox) fileBox.textContent = `読み込み失敗: ${msg}`;
    }
  }
  setTimeout(loadHistory, 0);
  async function refreshMonthSummary() {
    const host = monthsCard.querySelector('#monthsBody');
    if (!host) return;
    host.innerHTML = `<tr><td style="padding:10px 12px" colspan="3">読み込み中…</td></tr>`;
    try {
      const d = await api.get(`/api/admin/salary/deliveries`);
      const f = await api.get(`/api/admin/salary/files`);
      const map = new Map();
      const add = (m, k) => {
        if (!m) return;
        if (!map.has(m)) map.set(m, { deliv: new Set(), files: new Set() });
        map.get(m)[k].add(true);
      };
      (Array.isArray(d?.items) ? d.items : []).forEach(it => add(String(it.month || ''), 'deliv'));
      (Array.isArray(f?.items) ? f.items : []).forEach(it => add(String(it.month || ''), 'files'));
      const months = Array.from(map.keys()).sort((a,b) => a.localeCompare(b));
      host.innerHTML = months.map(m => {
        const v = map.get(m);
        const delivCnt = v.deliv.size;
        const fileCnt = v.files.size;
        const active = selectedMonth === m;
        return `
          <tr data-month="${m}" style="cursor:pointer;${active ? 'background:#eef2ff' : ''}">
            <td style="padding:10px 12px;border-top:1px solid #f1f5f9;font-weight:900;color:#0f172a">${m}</td>
            <td style="padding:10px 12px;border-top:1px solid #f1f5f9">${delivCnt}</td>
            <td style="padding:10px 12px;border-top:1px solid #f1f5f9">${fileCnt}</td>
          </tr>
        `;
      }).join('') || `<tr><td style="padding:10px 12px" colspan="3">データがありません</td></tr>`;
      monthsCard.querySelectorAll('tr[data-month]').forEach(tr => {
        tr.addEventListener('click', () => {
          selectedMonth = String(tr.getAttribute('data-month') || '');
          const pm = document.getElementById('psMonth');
          if (pm) pm.value = selectedMonth.replace('-', '-');
          refreshMonthSummary();
          loadHistory();
        });
      });
    } catch (e) {
      const msg = String(e?.message || '読み込み失敗');
      try { console.error('payslip months summary error:', e); } catch {}
      host.innerHTML = `<tr><td style="padding:10px 12px" colspan="3">読み込み失敗: ${msg}</td></tr>`;
    }
  }
  refreshMonthSummary();

  const pm = document.getElementById('psMonth');
  if (pm) pm.addEventListener('change', () => { selectedMonth = String(pm.value || ''); loadHistory(); refreshMonthSummary(); });
  const pc = document.getElementById('psClear');
  if (pc) pc.addEventListener('click', () => { selectedMonth = ''; try { document.getElementById('psMonth').value = ''; } catch {} loadHistory(); refreshMonthSummary(); });
}
