import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const showSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    if (el) { el.removeAttribute('hidden'); el.style.display = 'flex'; }
  } catch {}
};
const hideSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
  } catch {}
};

const dayNum = (d) => {
  const s = String(d || '');
  return s.length >= 10 ? parseInt(s.slice(8, 10), 10) : 0;
};
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtTime = (dt) => {
  if (!dt) return '—';
  const s = String(dt);
  return s.length >= 16 ? s.slice(11, 16) : s;
};

const boot = async () => {
  const content = $('#adminContent');
  if (content) {
    content.className = 'card';
    content.innerHTML = '<div style="color:#475569;font-weight:650;">読み込み中…</div>';
  }
  const profile = await requireAdmin();
  if (!profile) return;

  let listWatchdog = null;
  let detailWatchdog = null;
  const armListWatchdog = () => {
    try {
      if (listWatchdog) clearTimeout(listWatchdog);
      listWatchdog = setTimeout(() => {
        hideSpinner();
        try {
          const host = document.querySelector('#wrTable');
          if (host && !host.innerHTML) {
            host.innerHTML = '<div class="empty-state"><div style="font-size:28px;">⚠️</div><div>読み込みに時間がかかっています。もう一度お試しください。</div></div>';
          }
        } catch {}
      }, 8000);
    } catch {}
  };
  const disarmListWatchdog = () => {
    try { if (listWatchdog) clearTimeout(listWatchdog); } catch {}
    listWatchdog = null;
  };
  const armDetailWatchdog = () => {
    try {
      if (detailWatchdog) clearTimeout(detailWatchdog);
      detailWatchdog = setTimeout(() => {
        hideSpinner();
        try {
          const host = document.querySelector('#wrDetail');
          if (host && !host.innerHTML) {
            host.innerHTML = '<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#b00020;font-weight:650;">読み込みに時間がかかっています。もう一度お試しください。</div></div>';
          }
        } catch {}
      }, 8000);
    } catch {}
  };
  const disarmDetailWatchdog = () => {
    try { if (detailWatchdog) clearTimeout(detailWatchdog); } catch {}
    detailWatchdog = null;
  };

  if (!content) return;
  content.className = 'card';
  content.innerHTML = '';

  const init = (() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get('date');
    const m = params.get('month');
    const date = isISODate(d) ? d : todayJST();
    const month = isYM(m) ? m : date.slice(0, 7);
    const mode = params.get('mode') === 'day' ? 'day' : 'month';
    return { mode, date, month };
  })();

  const wrap = document.createElement('div');
  wrap.className = 'dashboard';
  wrap.innerHTML = `
    <div class="dashboard-head">
      <h3 style="margin:0;">作業報告</h3>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <div class="seg" id="wrMode" style="margin:0;">
          <button data-mode="month" class="${init.mode === 'month' ? 'active' : ''}">月</button>
          <button data-mode="day" class="${init.mode === 'day' ? 'active' : ''}">日</button>
        </div>
        <input id="wrMonth" type="month" value="${init.month}" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;${init.mode === 'month' ? '' : 'display:none;'}">
        <input id="wrDate" type="date" value="${init.date}" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;${init.mode === 'day' ? '' : 'display:none;'}">
        <button id="wrCloseMonth" class="btn" type="button" style="text-decoration:none;${init.mode === 'month' ? '' : 'display:none;'}">月を締める</button>
        <a class="btn" href="/admin/dashboard" style="text-decoration:none;">ホームへ</a>
      </div>
    </div>
    <div id="wrSummary" style="margin-bottom:12px;color:#475569;font-weight:650;"></div>
    <div id="wrTable"></div>
    <div id="wrDetail" style="margin-top:14px;"></div>
  `;
  content.appendChild(wrap);

  const setUrl = ({ mode, date, month }) => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('mode', mode);
      if (month) u.searchParams.set('month', month);
      if (date) u.searchParams.set('date', date);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
  };

  const renderDetail = (html) => {
    const detailHost = $('#wrDetail');
    if (detailHost) detailHost.innerHTML = html || '';
  };

  const loadDay = async (d) => {
    showSpinner();
    armListWatchdog();
    try {
      const r = await fetchJSONAuth(`/api/admin/work-reports?date=${encodeURIComponent(d)}`);
      const sum = r?.summary || {};
      const items = Array.isArray(r?.items) ? r.items : [];
      const summaryEl = $('#wrSummary');
      if (summaryEl) {
        summaryEl.textContent = `必要(退勤済): ${sum.required ?? 0} / 提出: ${sum.submitted ?? 0} / 未提出: ${sum.missing ?? 0}`;
      }
      const tableHost = $('#wrTable');
      renderDetail('');
      if (!tableHost) return;
      if (!items.length) {
        tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>データがありません</div></div>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'dash-table';
      table.innerHTML = '<thead><tr><th>社員番号</th><th>氏名</th><th>部署</th><th>状態</th><th>出勤</th><th>退勤</th><th>現場</th><th>報告</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const it of items) {
        const st = it.status || 'not_checked_in';
        const missing = st === 'checked_out' && !it.report;
        const code = it.employeeCode || `EMP${String(it.userId).padStart(3,'0')}`;
        const name = it.username || '';
        const dept = it.departmentName || '—';
        const cin = fmtTime(it.attendance?.checkIn);
        const cout = fmtTime(it.attendance?.checkOut);
        const site = it.report?.site || '—';
        const rep = it.report ? '提出済' : (missing ? '未提出' : '—');
        const statusJa = st === 'working' ? '出勤中' : (st === 'checked_out' ? '退勤済' : '未出勤');
        const pill = `<span class="dash-pill" style="${missing ? 'background:#fff1f1;color:#991b1b;border-color:#ffcccc;' : ''}">${esc(rep)}</span>`;

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `<td>${esc(code)}</td><td>${esc(name)}</td><td>${esc(dept)}</td><td>${esc(statusJa)}</td><td>${esc(cin)}</td><td>${esc(cout)}</td><td>${esc(site)}</td><td>${pill}</td>`;

        tr.addEventListener('click', async () => {
          const title = `${esc(code)} ${esc(name)} / ${esc(d)}`;
          if (!it.report) {
            const msg = st !== 'checked_out' ? '退勤後に報告します。' : (missing ? '未提出' : '作業報告はありません。');
            renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:${missing ? '#991b1b' : '#475569'};font-weight:650;">${title}<br>${esc(msg)}</div></div>`);
            return;
          }
          showSpinner();
          armDetailWatchdog();
          try {
            const rr = await fetchJSONAuth(`/api/admin/work-reports/${encodeURIComponent(it.userId)}?date=${encodeURIComponent(d)}`);
            const rep2 = rr?.report || rr?.item?.report || rr?.item || null;
            if (!rep2 || (!rep2.site && !rep2.work)) {
              renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#475569;font-weight:650;">${title}<br>作業報告はありません。</div></div>`);
              return;
            }
            renderDetail(`
              <div class="dash-card">
                <div class="dash-card-title">詳細</div>
                <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 12px;align-items:start;">
                  <div style="color:#475569;font-weight:650;">社員</div><div style="font-weight:650;color:#0f172a;">${title}</div>
                  <div style="color:#475569;font-weight:650;">現場</div><div>${esc(rep2.site)}</div>
                  <div style="color:#475569;font-weight:650;">作業内容</div><div style="white-space:pre-wrap;">${esc(rep2.work)}</div>
                </div>
              </div>
            `);
          } catch (e) {
            renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#b00020;font-weight:650;">取得に失敗しました: ${esc(e?.message || 'unknown')}</div></div>`);
          } finally {
            hideSpinner();
            disarmDetailWatchdog();
          }
        });

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableHost.innerHTML = '';
      const wrap2 = document.createElement('div');
      wrap2.style.overflow = 'auto';
      wrap2.style.border = '1px solid #e5e7eb';
      wrap2.style.borderRadius = '12px';
      wrap2.style.background = '#fff';
      wrap2.appendChild(table);
      tableHost.appendChild(wrap2);
    } catch (e) {
      const tableHost = $('#wrTable');
      if (tableHost) {
        tableHost.innerHTML = `<div class="empty-state"><div style="font-size:28px;">⚠️</div><div>読み込み失敗: ${String(e?.message || 'unknown')}</div></div>`;
      }
    } finally {
      hideSpinner();
      disarmListWatchdog();
    }
  };

  const loadMonth = async (m) => {
    showSpinner();
    armListWatchdog();
    try {
      const r = await fetchJSONAuth(`/api/admin/work-reports/month?month=${encodeURIComponent(m)}`);
      const sum = r?.summary || {};
      const days = Array.isArray(r?.days) ? r.days : [];
      const items = Array.isArray(r?.items) ? r.items : [];
      const summaryEl = $('#wrSummary');
      const closeBtn = $('#wrCloseMonth');
      if (summaryEl) {
        summaryEl.textContent = `必要(退勤済): ${sum.required ?? 0} / 提出: ${sum.submitted ?? 0} / 未提出: ${sum.missing ?? 0}${r?.closed ? ' / 締め済み' : ''}`;
      }
      if (closeBtn) {
        closeBtn.disabled = !!r?.closed;
        closeBtn.textContent = r?.closed ? '締め済み' : '月を締める';
      }
      const tableHost = $('#wrTable');
      renderDetail('');
      if (!tableHost) return;
      if (!items.length || !days.length) {
        tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>データがありません</div></div>';
        return;
      }

      const table = document.createElement('table');
      table.className = 'dash-table';
      table.style.tableLayout = 'fixed';
      table.style.width = 'max-content';
      table.innerHTML = '';
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      trh.innerHTML = '<th style="position:sticky;left:0;background:#f8fafc;z-index:2;min-width:110px;">社員番号</th><th style="position:sticky;left:110px;background:#f8fafc;z-index:2;min-width:140px;">氏名</th><th style="position:sticky;left:250px;background:#f8fafc;z-index:2;min-width:140px;">部署</th>';
      for (const d of days) {
        const th = document.createElement('th');
        th.textContent = String(dayNum(d));
        th.style.width = '44px';
        th.style.textAlign = 'center';
        trh.appendChild(th);
      }
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const u of items) {
        const uid = u.userId;
        const code = u.employeeCode || `EMP${String(uid).padStart(3,'0')}`;
        const name = u.username || '';
        const dept = u.departmentName || '—';
        const tr = document.createElement('tr');
        const tdCode = document.createElement('td');
        tdCode.textContent = code;
        tdCode.style.position = 'sticky';
        tdCode.style.left = '0';
        tdCode.style.background = '#fff';
        tdCode.style.zIndex = '1';
        const tdName = document.createElement('td');
        tdName.textContent = name;
        tdName.style.position = 'sticky';
        tdName.style.left = '110px';
        tdName.style.background = '#fff';
        tdName.style.zIndex = '1';
        const tdDept = document.createElement('td');
        tdDept.textContent = dept;
        tdDept.style.position = 'sticky';
        tdDept.style.left = '250px';
        tdDept.style.background = '#fff';
        tdDept.style.zIndex = '1';
        tr.appendChild(tdCode);
        tr.appendChild(tdName);
        tr.appendChild(tdDept);
        for (const d of days) {
          const cell = document.createElement('td');
          cell.style.textAlign = 'center';
          cell.style.cursor = 'pointer';
          const st = u?.days?.[d]?.status || 'not_checked_in';
          const rep = u?.days?.[d]?.report || null;
          let text = '';
          let bg = '';
          let color = '#334155';
          if (st === 'leave') {
            text = '休';
            color = '#64748b';
          } else if (st === 'checked_out') {
            if (rep) {
              text = '✓';
              bg = '#ecfdf5';
              color = '#166534';
            } else {
              text = '未';
              bg = '#fff1f1';
              color = '#991b1b';
            }
          } else if (st === 'working') {
            text = '出';
            bg = '#eef5ff';
            color = '#0b2c66';
          } else {
            text = '';
          }
          cell.textContent = text;
          if (bg) cell.style.background = bg;
          cell.style.color = color;
          cell.addEventListener('click', async () => {
            const title = `${esc(code)} ${esc(name)} / ${esc(d)}`;
            if (st === 'leave') {
              renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#475569;font-weight:650;">${title}<br>休暇</div></div>`);
              return;
            }
            if (st !== 'checked_out') {
              renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#475569;font-weight:650;">${title}<br>退勤後に報告します。</div></div>`);
              return;
            }
            if (!rep) {
              renderDetail(`<div class="dash-card"><div class="dash-card-title">詳細</div><div style="color:#991b1b;font-weight:650;">${title}<br>未提出</div></div>`);
              return;
            }
            renderDetail(`
              <div class="dash-card">
                <div class="dash-card-title">詳細</div>
                <div style="display:grid;grid-template-columns:140px 1fr;gap:8px 12px;align-items:start;">
                  <div style="color:#475569;font-weight:650;">社員</div><div style="font-weight:650;color:#0f172a;">${title}</div>
                  <div style="color:#475569;font-weight:650;">現場</div><div>${esc(rep.site)}</div>
                  <div style="color:#475569;font-weight:650;">作業内容</div><div style="white-space:pre-wrap;">${esc(rep.work)}</div>
                </div>
              </div>
            `);
          });
          tr.appendChild(cell);
        }
        tdName.style.cursor = 'pointer';
        tdName.addEventListener('click', async () => {
          showSpinner();
          try {
            const rr = await fetchJSONAuth(`/api/admin/work-reports/month/${encodeURIComponent(uid)}?month=${encodeURIComponent(m)}`);
            const arr = Array.isArray(rr?.items) ? rr.items : [];
            const lines = arr
              .filter(x => x.status === 'checked_out')
              .map(x => {
                const rep = x.report;
                if (!rep) return `<tr><td>${esc(x.date)}</td><td style="color:#991b1b;font-weight:650;">未提出</td><td>—</td><td>—</td></tr>`;
                const site = esc(rep.site);
                const work = esc(rep.work);
                return `<tr><td>${esc(x.date)}</td><td>提出済</td><td>${site}</td><td style="max-width:520px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${work}</td></tr>`;
              }).join('');
            renderDetail(`
              <div class="dash-card">
                <div class="dash-card-title">月一覧</div>
                <div style="color:#475569;font-weight:650;margin-bottom:10px;">${esc(code)} ${esc(name)} / ${esc(m)}</div>
                ${lines ? `<table class="dash-table"><thead><tr><th>日付</th><th>状態</th><th>現場</th><th>作業内容</th></tr></thead><tbody>${lines}</tbody></table>` : `<div style="color:#475569;font-weight:650;">データがありません</div>`}
              </div>
            `);
          } catch (e) {
            renderDetail(`<div class="dash-card"><div class="dash-card-title">月一覧</div><div style="color:#b00020;font-weight:650;">取得に失敗しました: ${esc(e?.message || 'unknown')}</div></div>`);
          } finally {
            hideSpinner();
          }
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      const wrap2 = document.createElement('div');
      wrap2.style.overflow = 'auto';
      wrap2.style.border = '1px solid #e5e7eb';
      wrap2.style.borderRadius = '12px';
      wrap2.style.background = '#fff';
      wrap2.appendChild(table);
      tableHost.innerHTML = '';
      tableHost.appendChild(wrap2);
    } catch (e) {
      const tableHost = $('#wrTable');
      if (tableHost) {
        tableHost.innerHTML = `<div class="empty-state"><div style="font-size:28px;">⚠️</div><div>読み込み失敗: ${esc(e?.message || 'unknown')}</div></div>`;
      }
    } finally {
      hideSpinner();
      disarmListWatchdog();
    }
  };

  const load = async () => {
    const mode = $('#wrMode')?.querySelector?.('button.active')?.dataset?.mode || init.mode;
    const monthVal = $('#wrMonth')?.value;
    const dateVal = $('#wrDate')?.value;
    const month = isYM(monthVal) ? monthVal : init.month;
    const date = isISODate(dateVal) ? dateVal : init.date;
    setUrl({ mode, date, month });
    if (mode === 'day') await loadDay(date);
    else await loadMonth(month);
  };

  await load();

  const modeWrap = $('#wrMode');
  if (modeWrap) {
    modeWrap.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;
      modeWrap.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      const monthInput = $('#wrMonth');
      const dateInput = $('#wrDate');
      const closeBtn = $('#wrCloseMonth');
      if (monthInput) monthInput.style.display = mode === 'month' ? '' : 'none';
      if (dateInput) dateInput.style.display = mode === 'day' ? '' : 'none';
      if (closeBtn) closeBtn.style.display = mode === 'month' ? '' : 'none';
      await load();
    });
  }
  const monthInput = $('#wrMonth');
  if (monthInput) {
    monthInput.addEventListener('change', async () => {
      if (!isYM(monthInput.value)) return;
      await load();
    });
  }
  const dateInput = $('#wrDate');
  if (dateInput) {
    dateInput.addEventListener('change', async () => {
      if (!isISODate(dateInput.value)) return;
      await load();
    });
  }
  const closeBtn = $('#wrCloseMonth');
  if (closeBtn) {
    closeBtn.addEventListener('click', async () => {
      const month = isYM($('#wrMonth')?.value) ? $('#wrMonth').value : init.month;
      if (!month) return;
      showSpinner();
      armDetailWatchdog();
      try {
        await fetchJSONAuth('/api/admin/work-reports/close-month', { method: 'POST', body: JSON.stringify({ month }) });
        await load();
      } catch (e) {
        renderDetail(`<div class="dash-card"><div class="dash-card-title">締め処理</div><div style="color:#b00020;font-weight:650;">失敗しました: ${esc(e?.message || 'unknown')}</div></div>`);
      } finally {
        hideSpinner();
        disarmDetailWatchdog();
      }
    });
  }
};

boot();
