import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);
const isYM = (s) => /^\d{4}-\d{2}$/.test(String(s || ''));
const monthJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtTime = (dt) => {
  if (!dt) return '—';
  const s = String(dt);
  return s.length >= 16 ? s.slice(11, 16) : s;
};
const statusMeta = (status) => {
  if (status === 'submitted') return { label: '提出済', style: 'background:#eef5ff;color:#0b2c66;border-color:#bfd7ff;' };
  if (status === 'missing') return { label: '未提出', style: 'background:#fff1f1;color:#991b1b;border-color:#ffcccc;' };
  if (status === 'working') return { label: '勤務中', style: 'background:#f8fafc;color:#475569;border-color:#cbd5e1;' };
  return { label: '—', style: 'background:#f8fafc;color:#475569;border-color:#e2e8f0;' };
};
const workTypeLabel = (value) => {
  if (value === 'onsite') return '出社';
  if (value === 'remote') return '在宅';
  if (value === 'satellite') return '現場/出張';
  return '—';
};
const dowClass = (w) => {
  const s = String(w || '').trim();
  if (s === '土') return 'wr-dow-sat';
  if (s === '日') return 'wr-dow-sun';
  if (s === '月' || s === '火' || s === '水' || s === '木' || s === '金') return 'wr-dow-weekday';
  return '';
};
const weekdayJa = (dateStr) => {
  const s = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [y, m, d] = s.split('-').map(n => parseInt(n, 10));
  const labels = ['日', '月', '火', '水', '木', '金', '土'];
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return labels[idx] || '';
};

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

export async function mount() {
  const content = $('#adminContent');
  if (content) {
    content.className = 'card';
    content.innerHTML = '<div style="color:#475569;font-weight:650;">読み込み中…</div>';
  }
  const profile = await requireAdmin();
  if (!profile || !content) return;

  const params = new URLSearchParams(window.location.search);
  const initMonth = isYM(params.get('month')) ? String(params.get('month')) : monthJST();
  const initSort = String(params.get('sort') || 'dateDesc');
  const initDept = String(params.get('dept') || '');
  const initQ = String(params.get('q') || '');
  const initGroup = String(params.get('group') || '') === '1';
  const state = { month: initMonth, sort: initSort, dept: initDept, q: initQ, group: initGroup, items: [] };

  content.className = 'card';
  content.innerHTML = `
    <div class="dashboard">
      <div class="dashboard-head">
        <h3 style="margin:0;">作業報告</h3>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <input id="wrMonth" type="month" value="${initMonth}" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;">
          <select id="wrSort" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;">
            <option value="dateDesc" ${initSort === 'dateDesc' ? 'selected' : ''}>日付↓ / 社員↑</option>
            <option value="employee" ${initSort === 'employee' ? 'selected' : ''}>社員↑ / 日付↓</option>
            <option value="name" ${initSort === 'name' ? 'selected' : ''}>氏名↑ / 日付↓</option>
            <option value="department" ${initSort === 'department' ? 'selected' : ''}>部署↑ / 社員↑ / 日付↓</option>
            <option value="missingFirst" ${initSort === 'missingFirst' ? 'selected' : ''}>未提出を上に</option>
          </select>
          <select id="wrDept" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;min-width:160px;">
            <option value="">全部署</option>
          </select>
          <input id="wrSearch" placeholder="社員番号/氏名で検索" value="${esc(initQ)}" style="padding:8px 10px;border:1px solid #e5e7eb;border-radius:10px;min-width:220px;">
          <label style="display:flex;align-items:center;gap:6px;color:#334155;font-weight:650;">
            <input id="wrGroup" type="checkbox" ${initGroup ? 'checked' : ''}>
            社員ごとにまとめる
          </label>
          <a class="btn" href="/admin/dashboard" style="text-decoration:none;">ホームへ</a>
        </div>
      </div>
      <div id="wrSummary" style="margin-bottom:12px;color:#475569;font-weight:650;"></div>
      <div id="wrTable"></div>
    </div>
  `;

  const setUrl = () => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('month', state.month);
      u.searchParams.set('sort', state.sort);
      if (state.dept) u.searchParams.set('dept', state.dept);
      else u.searchParams.delete('dept');
      if (state.q) u.searchParams.set('q', state.q);
      else u.searchParams.delete('q');
      if (state.group) u.searchParams.set('group', '1');
      else u.searchParams.delete('group');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
  };

  const renderRows = (items) => {
    const tableHost = $('#wrTable');
    if (!tableHost) return;
    if (!items.length) {
      tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>出勤データがありません</div></div>';
      return;
    }

    const rows = items.map((it) => {
      const code = it.employeeCode || `EMP${String(it.userId).padStart(3, '0')}`;
      const meta = statusMeta(it.status);
      const kubun = String(it.kubun || '').trim() || '—';
      const site = String(it.site || '').trim() || '—';
      const work = String(it.work || '').trim() || '—';
      const dc = dowClass(it.weekday);
      return `
        <tr>
          <td class="${dc}">${esc(it.date || '')}</td>
          <td class="${dc}" style="text-align:center;">${esc(it.weekday || '')}</td>
          <td>${esc(code)}</td>
          <td>${esc(it.username || '')}</td>
          <td>${esc(it.departmentName || '—')}</td>
          <td>${esc(kubun)}</td>
          <td>${esc(fmtTime(it.attendance?.checkIn))}</td>
          <td>${esc(fmtTime(it.attendance?.checkOut))}</td>
          <td>${esc(workTypeLabel(it.workType))}</td>
          <td>${esc(site)}</td>
          <td style="white-space:pre-wrap;min-width:320px;">${esc(work)}</td>
          <td><span class="dash-pill" style="${meta.style}">${esc(meta.label)}</span></td>
        </tr>
      `;
    }).join('');

    tableHost.innerHTML = `
      <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
        <table class="dash-table wr-table">
          <colgroup>
            <col style="width:120px;">
            <col style="width:52px;">
            <col style="width:100px;">
            <col style="width:120px;">
            <col style="width:140px;">
            <col style="width:110px;">
            <col style="width:70px;">
            <col style="width:70px;">
            <col style="width:110px;">
            <col style="width:140px;">
            <col style="width:520px;">
            <col style="width:90px;">
          </colgroup>
          <thead>
            <tr>
              <th>日付</th>
              <th>曜</th>
              <th>社員番号</th>
              <th>氏名</th>
              <th>部署</th>
              <th>勤務区分</th>
              <th>出勤</th>
              <th>退勤</th>
              <th>勤務形態</th>
              <th>現場</th>
              <th>作業内容</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  const normalize = (s) => String(s || '').trim().toLowerCase();
  const cmpStr = (a, b) => {
    const aa = normalize(a);
    const bb = normalize(b);
    if (aa === bb) return 0;
    return aa < bb ? -1 : 1;
  };
  const statusRank = (st) => {
    if (st === 'missing') return 0;
    if (st === 'working') return 1;
    if (st === 'submitted') return 2;
    return 3;
  };

  const employeeCodeOf = (x) => String(x?.employeeCode || `EMP${String(x?.userId || '').padStart(3, '0')}`);
  const employeeNameOf = (x) => String(x?.username || '').trim();
  const departmentNameOf = (x) => String(x?.departmentName || '').trim();

  const filterAndSort = (items) => {
    const dept = normalize(state.dept);
    const q = normalize(state.q);
    let out = Array.isArray(items) ? items.slice() : [];
    if (dept) {
      out = out.filter(x => normalize(x?.departmentName) === dept);
    }
    if (q) {
      out = out.filter(x => {
        const code = normalize(x?.employeeCode);
        const name = normalize(x?.username);
        return (code && code.includes(q)) || (name && name.includes(q));
      });
    }
    out.sort((a, b) => {
      if (state.sort === 'employee') {
        const c1 = cmpStr(employeeCodeOf(a), employeeCodeOf(b));
        if (c1) return c1;
        const d1 = cmpStr(b?.date, a?.date);
        if (d1) return d1;
        return Number(a?.userId || 0) - Number(b?.userId || 0);
      }
      if (state.sort === 'name') {
        const n1 = cmpStr(employeeNameOf(a), employeeNameOf(b));
        if (n1) return n1;
        const c1 = cmpStr(employeeCodeOf(a), employeeCodeOf(b));
        if (c1) return c1;
        const d1 = cmpStr(b?.date, a?.date);
        if (d1) return d1;
        return Number(a?.userId || 0) - Number(b?.userId || 0);
      }
      if (state.sort === 'department') {
        const dep = cmpStr(departmentNameOf(a), departmentNameOf(b));
        if (dep) return dep;
        const c1 = cmpStr(employeeCodeOf(a), employeeCodeOf(b));
        if (c1) return c1;
        const d1 = cmpStr(b?.date, a?.date);
        if (d1) return d1;
        return Number(a?.userId || 0) - Number(b?.userId || 0);
      }
      if (state.sort === 'missingFirst') {
        const r1 = statusRank(a?.status) - statusRank(b?.status);
        if (r1) return r1;
        const d1 = cmpStr(b?.date, a?.date);
        if (d1) return d1;
        const c1 = cmpStr(employeeCodeOf(a), employeeCodeOf(b));
        if (c1) return c1;
        return Number(a?.userId || 0) - Number(b?.userId || 0);
      }
      const d1 = cmpStr(b?.date, a?.date);
      if (d1) return d1;
      const c1 = cmpStr(employeeCodeOf(a), employeeCodeOf(b));
      if (c1) return c1;
      return Number(a?.userId || 0) - Number(b?.userId || 0);
    });
    return out;
  };

  const renderGrouped = (items) => {
    const tableHost = $('#wrTable');
    if (!tableHost) return;
    if (!items.length) {
      tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>出勤データがありません</div></div>';
      return;
    }
    const groups = new Map();
    for (const it of items) {
      const uid = Number(it?.userId || 0);
      const key = uid ? String(uid) : `${employeeCodeOf(it)}|${employeeNameOf(it)}|${departmentNameOf(it)}`;
      if (!groups.has(key)) {
        groups.set(key, {
          userId: uid || null,
          employeeCode: employeeCodeOf(it),
          username: employeeNameOf(it),
          departmentName: departmentNameOf(it) || '—',
          items: []
        });
      }
      groups.get(key).items.push(it);
    }
    const arr = Array.from(groups.values());
    for (const g of arr) {
      g.items.sort((a, b) => cmpStr(b?.date, a?.date));
      g.missing = g.items.filter(x => x?.status === 'missing').length;
      g.submitted = g.items.filter(x => x?.status === 'submitted').length;
      g.total = g.items.length;
    }
    arr.sort((a, b) => {
      if (state.sort === 'missingFirst') {
        const d = Number(b.missing || 0) - Number(a.missing || 0);
        if (d) return d;
      }
      if (state.sort === 'department') {
        const dep = cmpStr(a.departmentName, b.departmentName);
        if (dep) return dep;
      }
      if (state.sort === 'name') {
        const n = cmpStr(a.username, b.username);
        if (n) return n;
      }
      const c = cmpStr(a.employeeCode, b.employeeCode);
      if (c) return c;
      return Number(a.userId || 0) - Number(b.userId || 0);
    });
    const html = arr.map(g => {
      const headerRight = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="dash-pill" style="background:#f8fafc;color:#475569;border-color:#e2e8f0;">合計 ${g.total}</span>
          <span class="dash-pill" style="background:#eef5ff;color:#0b2c66;border-color:#bfd7ff;">提出 ${g.submitted}</span>
          <span class="dash-pill" style="background:#fff1f1;color:#991b1b;border-color:#ffcccc;">未提出 ${g.missing}</span>
        </div>
      `;
      const rows = g.items.map(it => {
        const meta = statusMeta(it.status);
        const kubun = String(it.kubun || '').trim() || '—';
        const site = String(it.site || '').trim() || '—';
        const work = String(it.work || '').trim() || '—';
        const dc = dowClass(it.weekday);
        return `
          <tr>
            <td class="${dc}">${esc(it.date || '')}</td>
            <td class="${dc}" style="text-align:center;">${esc(it.weekday || '')}</td>
            <td>${esc(kubun)}</td>
            <td>${esc(fmtTime(it.attendance?.checkIn))}</td>
            <td>${esc(fmtTime(it.attendance?.checkOut))}</td>
            <td>${esc(workTypeLabel(it.workType))}</td>
            <td>${esc(site)}</td>
            <td style="white-space:pre-wrap;">${esc(work)}</td>
            <td><span class="dash-pill" style="${meta.style}">${esc(meta.label)}</span></td>
          </tr>
        `;
      }).join('');
      return `
        <div class="dash-card" style="margin-bottom:12px;">
          <div class="dash-card-title" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
            <div style="font-weight:800;color:#0f172a;">
              ${esc(g.employeeCode)} ${esc(g.username)} <span style="color:#64748b;font-weight:700;">/ ${esc(g.departmentName)}</span>
            </div>
            ${headerRight}
          </div>
          <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
            <table class="dash-table wr-table">
              <colgroup>
                <col style="width:120px;">
                <col style="width:52px;">
                <col style="width:110px;">
                <col style="width:70px;">
                <col style="width:70px;">
                <col style="width:110px;">
                <col style="width:160px;">
                <col style="width:680px;">
                <col style="width:90px;">
              </colgroup>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>曜</th>
                  <th>勤務区分</th>
                  <th>出勤</th>
                  <th>退勤</th>
                  <th>勤務形態</th>
                  <th>現場</th>
                  <th>作業内容</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
    tableHost.innerHTML = html;
  };

  const syncDeptOptions = (items) => {
    const sel = $('#wrDept');
    if (!sel) return;
    const names = Array.from(new Set((items || []).map(x => String(x?.departmentName || '').trim()).filter(Boolean))).sort((a, b) => cmpStr(a, b));
    const optHtml = ['<option value="">全部署</option>']
      .concat(names.map(n => `<option value="${esc(n)}" ${normalize(n) === normalize(state.dept) ? 'selected' : ''}>${esc(n)}</option>`))
      .join('');
    sel.innerHTML = optHtml;
  };

  const normalizeMonthListResponse = (r) => {
    const items = Array.isArray(r?.items) ? r.items : [];
    const sum = r?.summary || {};
    return {
      summary: {
        employees: sum.employees == null ? 0 : sum.employees,
        workedDays: sum.workedDays == null ? items.length : sum.workedDays,
        submitted: sum.submitted == null ? 0 : sum.submitted,
        missing: sum.missing == null ? 0 : sum.missing
      },
      items
    };
  };

  const toListFromLegacyMonthMatrix = (r) => {
    const days = Array.isArray(r?.days) ? r.days : [];
    const users = Array.isArray(r?.items) ? r.items : [];
    const out = [];
    const workingUsers = new Set();
    let submitted = 0;
    let missing = 0;
    for (const u of users) {
      const uid = u?.userId;
      const dmap = u?.days || {};
      for (const d of days) {
        const entry = dmap?.[d] || null;
        const st = String(entry?.status || '');
        if (st !== 'checked_out' && st !== 'working' && st !== 'holiday_work' && st !== 'holiday_working') continue;
        const rep = entry?.report || null;
        const site = String(rep?.site || '').trim() || null;
        const work = String(rep?.work || '').trim() || null;
        const status = st === 'checked_out' ? ((site || work) ? 'submitted' : 'missing') : 'working';
        if (status === 'submitted') submitted++;
        else if (status === 'missing') missing++;
        workingUsers.add(uid);
        out.push({
          userId: uid,
          employeeCode: u?.employeeCode || null,
          username: u?.username || null,
          departmentId: u?.departmentId || null,
          departmentName: u?.departmentName || null,
          date: String(d).slice(0, 10),
          weekday: weekdayJa(d),
          attendance: { checkIn: null, checkOut: null },
          kubun: entry?.kubun || null,
          workType: null,
          site,
          work,
          status
        });
      }
    }
    out.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ac = String(a.employeeCode || '').toUpperCase();
      const bc = String(b.employeeCode || '').toUpperCase();
      if (ac !== bc) return ac < bc ? -1 : 1;
      return Number(a.userId || 0) - Number(b.userId || 0);
    });
    return {
      summary: { employees: workingUsers.size, workedDays: out.length, submitted, missing },
      items: out
    };
  };

  const load = async () => {
    const monthEl = $('#wrMonth');
    state.month = isYM(monthEl?.value) ? monthEl.value : initMonth;
    setUrl();
    showSpinner();
    try {
      let r = null;
      try {
        r = await fetchJSONAuth(`/api/admin/work-reports/month/list?month=${encodeURIComponent(state.month)}`);
        r = normalizeMonthListResponse(r);
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('Invalid userId') || msg.includes('404') || msg.includes('Not Found')) {
          const legacy = await fetchJSONAuth(`/api/admin/work-reports/month?month=${encodeURIComponent(state.month)}`);
          r = toListFromLegacyMonthMatrix(legacy);
        } else {
          throw e;
        }
      }
      const summaryEl = $('#wrSummary');
      state.items = Array.isArray(r?.items) ? r.items : [];
      syncDeptOptions(state.items);
      const sum = r?.summary || {};
      const shown = filterAndSort(state.items).length;
      if (summaryEl) {
        summaryEl.textContent = `対象月: ${state.month} / 出勤社員: ${sum.employees == null ? 0 : sum.employees} / 出勤日レコード: ${sum.workedDays == null ? 0 : sum.workedDays} / 表示: ${shown} / 提出済: ${sum.submitted == null ? 0 : sum.submitted} / 未提出: ${sum.missing == null ? 0 : sum.missing}`;
      }
      const view = filterAndSort(state.items);
      if (state.group) renderGrouped(view);
      else renderRows(view);
    } catch (e) {
      const tableHost = $('#wrTable');
      if (tableHost) {
        tableHost.innerHTML = `<div class="empty-state"><div style="font-size:28px;">⚠️</div><div>読み込み失敗: ${esc((e && e.message) ? e.message : 'unknown')}</div></div>`;
      }
    } finally {
      hideSpinner();
    }
  };

  $('#wrMonth')?.addEventListener('change', async () => {
    const monthEl = $('#wrMonth');
    if (!isYM(monthEl?.value)) return;
    await load();
  });
  $('#wrSort')?.addEventListener('change', async () => {
    const sel = $('#wrSort');
    state.sort = String(sel?.value || 'dateDesc');
    setUrl();
    const view = filterAndSort(state.items);
    if (state.group) renderGrouped(view);
    else renderRows(view);
    try {
      const summaryEl = $('#wrSummary');
      if (summaryEl && summaryEl.textContent) {
        const shown = filterAndSort(state.items).length;
        summaryEl.textContent = String(summaryEl.textContent).replace(/\/ 表示: \d+ /, `/ 表示: ${shown} `);
      }
    } catch {}
  });
  $('#wrDept')?.addEventListener('change', async () => {
    const sel = $('#wrDept');
    state.dept = String(sel?.value || '');
    setUrl();
    const view = filterAndSort(state.items);
    if (state.group) renderGrouped(view);
    else renderRows(view);
    try {
      const summaryEl = $('#wrSummary');
      if (summaryEl && summaryEl.textContent) {
        const shown = filterAndSort(state.items).length;
        summaryEl.textContent = String(summaryEl.textContent).replace(/\/ 表示: \d+ /, `/ 表示: ${shown} `);
      }
    } catch {}
  });
  $('#wrSearch')?.addEventListener('input', async () => {
    const inp = $('#wrSearch');
    state.q = String(inp?.value || '');
    setUrl();
    const view = filterAndSort(state.items);
    if (state.group) renderGrouped(view);
    else renderRows(view);
    try {
      const summaryEl = $('#wrSummary');
      if (summaryEl && summaryEl.textContent) {
        const shown = filterAndSort(state.items).length;
        summaryEl.textContent = String(summaryEl.textContent).replace(/\/ 表示: \d+ /, `/ 表示: ${shown} `);
      }
    } catch {}
  });
  $('#wrGroup')?.addEventListener('change', async () => {
    const ck = $('#wrGroup');
    state.group = !!ck?.checked;
    setUrl();
    const view = filterAndSort(state.items);
    if (state.group) renderGrouped(view);
    else renderRows(view);
  });

  await load();
}
