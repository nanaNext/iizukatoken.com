import { escapeHtml as esc, delegate } from '../_shared/dom.js';
import { api, downloadWithAuth } from '../../shared/api/client.js';
import { createPage } from '../../shared/page/createPage.js';
import { createCleanup } from '../../shared/page/createCleanup.js';

async function mountAttendanceImpl({
  content,
  listUsers,
  getTimesheet,
  getAttendanceDay,
  updateAttendanceSegment,
  buildTimesheetExportURL
}) {
  const cleanup = createCleanup();
  let isCurrent = true;
  const controller = new AbortController();
  const signal = controller.signal;
  cleanup.add(() => { isCurrent = false; });
  cleanup.add(() => controller.abort());

  const users = await listUsers({ signal });
  content.innerHTML = '';

  const fmtTime = (dt) => {
    if (!dt) return '';
    const s = String(dt);
    return s.length >= 16 ? s.slice(11, 16) : s;
  };
  const isWeekend = (dateStr) => {
    try {
      const s = String(dateStr || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      return wd === 0 || wd === 6;
    } catch {
      return false;
    }
  };
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const rosterWrap = document.createElement('div');
  rosterWrap.innerHTML = `
    <div class="dash-card attrec-card">
      <div class="attrec-head">
        <div class="dash-card-title">勤怠記録</div>
        <div id="rosterSummary" class="attrec-summary" aria-live="polite"></div>
      </div>
      <div class="attrec-controls">
        <div class="attrec-control">
          <div class="attrec-label">日付</div>
          <input id="rosterDate" class="attrec-input" type="date" value="${esc(today)}">
          <button type="button" id="rosterLoad" class="attrec-btn">表示</button>
          <button type="button" id="rosterExportDayXlsx" class="attrec-btn">日次Excel</button>
          <button type="button" id="rosterExportWeekXlsx" class="attrec-btn">週次Excel</button>
        </div>
        <div class="attrec-control">
          <div class="attrec-label">月次</div>
          <input id="rosterMonth" class="attrec-input" type="month" value="${esc(month)}">
          <button type="button" id="rosterExportMonthXlsx" class="attrec-btn">月次Excel</button>
          <button type="button" id="rosterExportYearXlsx" class="attrec-btn">年次Excel</button>
        </div>
      </div>
      <div id="rosterTable" class="attrec-table"></div>
    </div>
  `;
  content.appendChild(rosterWrap);

  const renderSummary = (sum) => {
    const s = sum && typeof sum === 'object' ? sum : {};
    const required = Number(s.required == null ? 0 : s.required);
    const submitted = Number(s.submitted == null ? 0 : s.submitted);
    const missing = Number(s.missing == null ? 0 : s.missing);
    const host = rosterWrap.querySelector('#rosterSummary');
    if (!host) return;
    const missClass = missing > 0 ? 'attrec-pill danger' : 'attrec-pill ok';
    host.innerHTML = `
      <span class="attrec-pill neutral">必要(退勤済): ${esc(required)}</span>
      <span class="attrec-pill ok">提出: ${esc(submitted)}</span>
      <span class="${missClass}">未提出: ${esc(missing)}</span>
    `;
  };

  const loadRoster = async (date) => {
    const host = rosterWrap.querySelector('#rosterTable');
    if (host) {
      host.innerHTML = `
        <div class="empty-state">
          <div style="font-size:28px;">⏳</div>
          <div>読み込み中…</div>
        </div>
      `;
    }
    renderSummary(null);
    try {
      const r = await api.get(`/api/admin/work-reports?date=${encodeURIComponent(date)}`, { signal });
      if (!isCurrent) return;
      const items = (r && Array.isArray(r.items)) ? r.items : [];
      renderSummary((r && r.summary) ? r.summary : {});
      if (!host) return;
      if (!items.length) {
        host.innerHTML = `
          <div class="empty-state">
            <div style="font-size:28px;">🗂️</div>
            <div>データがありません</div>
          </div>
        `;
        return;
      }
      const table = document.createElement('table');
      table.className = 'dash-table attrec-dash-table';
      table.innerHTML = '<thead><tr><th>社員番号</th><th>氏名</th><th>部署</th><th>勤務区分</th><th>状態</th><th>出勤</th><th>退勤</th><th>現場</th><th>作業内容</th></tr></thead>';
      const tbody = document.createElement('tbody');
      const selectedDateIsOff = isWeekend(date);
      for (const it of items) {
        const code = it.employeeCode || `EMP${String(it.userId).padStart(3, '0')}`;
        const name = it.username || '';
        const dept = it.departmentName || '—';
        const st = it.status || '';
        const kubunRaw = String(it.dailyKubun || '').trim();
        const kubun = kubunRaw || ((selectedDateIsOff && (st === 'leave' || st === 'not_checked_in')) ? '休日' : '');
        const leaveSet = new Set(['欠勤', '有給休暇', '半休', '無給休暇']);
        const holidaySet = new Set(['休日', '代替休日']);
        const nonWorkingSet = new Set(['欠勤', '有給休暇', '半休', '無給休暇', '休日', '代替休日']);
        const isHolidayKubun = holidaySet.has(kubun);
        const stLabel = st === 'checked_out' ? '退勤済'
          : (st === 'working' ? '出勤中'
            : (st === 'holiday_work' || st === 'holiday_working' ? '休日出勤'
              : ((st === 'leave' && leaveSet.has(kubun)) || isHolidayKubun ? kubun || '休日' : (st === 'off' ? '休日' : '未出勤'))));
        const stClass = st === 'checked_out' ? 'attrec-pill ok'
          : (st === 'working' ? 'attrec-pill warn'
            : (st === 'holiday_work' || st === 'holiday_working' ? 'attrec-pill warn'
              : (((st === 'leave' && leaveSet.has(kubun)) || isHolidayKubun) ? 'attrec-pill neutral' : (st === 'off' ? 'attrec-pill neutral' : 'attrec-pill neutral'))));
        const cin = fmtTime(it.attendance ? it.attendance.checkIn : undefined);
        const cout = fmtTime(it.attendance ? it.attendance.checkOut : undefined);
        const site = (it.report && it.report.site) ? it.report.site : '';
        const work = (it.report && it.report.work) ? it.report.work : '';
        const wt = String(it.workType || ((it.report && it.report.workType) ? it.report.workType : '') || '').trim();
        const wtLabel = nonWorkingSet.has(kubun) ? kubun : (wt === 'onsite' ? '出社' : wt === 'remote' ? '在宅' : wt === 'satellite' ? '現場/出張' : (st === 'off' ? '休日' : '—'));
        const tr = document.createElement('tr');
        tr.className = st === 'checked_out' ? 'attrec-row checkedout'
          : (st === 'working' ? 'attrec-row working'
            : (st === 'holiday_work' || st === 'holiday_working' ? 'attrec-row working'
              : (((st === 'leave' && leaveSet.has(kubun)) || isHolidayKubun) ? 'attrec-row absent' : (st === 'off' ? 'attrec-row absent' : 'attrec-row absent'))));
        tr.innerHTML = `
          <td>${esc(code)}</td>
          <td>${esc(name)}</td>
          <td>${esc(dept)}</td>
          <td>${esc(wtLabel)}</td>
          <td><span class="${stClass}">${esc(stLabel)}</span></td>
          <td>${esc(cin)}</td>
          <td>${esc(cout)}</td>
          <td class="attrec-site" title="${esc(site)}">${esc(site)}</td>
          <td class="attrec-work" title="${esc(work)}">${esc(work)}</td>
        `;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      host.innerHTML = '';
      host.appendChild(table);
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (!isCurrent) return;
      if (host) {
        host.innerHTML = `
          <div class="empty-state" style="color:#b00020;">
            <div style="font-size:28px;">⚠️</div>
            <div>読み込みに失敗しました: ${esc((err && err.message) ? err.message : 'unknown')}</div>
          </div>
        `;
      }
    }
  };

  const btnLoad = rosterWrap.querySelector('#rosterLoad');
  if (btnLoad) btnLoad.addEventListener('click', async () => {
    const el = rosterWrap.querySelector('#rosterDate');
    const d = (el && el.value) ? el.value : today;
    await loadRoster(d);
  });
  const dateEl = rosterWrap.querySelector('#rosterDate');
  if (dateEl) dateEl.addEventListener('change', async () => {
    const d = dateEl.value || today;
    await loadRoster(d);
  });
  const btnExpDay = rosterWrap.querySelector('#rosterExportDayXlsx');
  if (btnExpDay) btnExpDay.addEventListener('click', async () => {
    const d = (dateEl && dateEl.value) ? dateEl.value : today;
    const url = `/api/admin/work-reports/export.xlsx?period=day&date=${encodeURIComponent(d)}`;
    try {
      await downloadWithAuth(url, `attendance_day_${d}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  });
  const btnExpWeek = rosterWrap.querySelector('#rosterExportWeekXlsx');
  if (btnExpWeek) btnExpWeek.addEventListener('click', async () => {
    const d = (dateEl && dateEl.value) ? dateEl.value : today;
    const url = `/api/admin/work-reports/export.xlsx?period=week&date=${encodeURIComponent(d)}`;
    try {
      await downloadWithAuth(url, `attendance_week_${d}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  });
  const btnExpMonth = rosterWrap.querySelector('#rosterExportMonthXlsx');
  if (btnExpMonth) btnExpMonth.addEventListener('click', async () => {
    const mEl = rosterWrap.querySelector('#rosterMonth');
    const m = (mEl && mEl.value) ? mEl.value : month;
    const url = `/api/admin/work-reports/export.xlsx?period=month&month=${encodeURIComponent(m)}`;
    try {
      await downloadWithAuth(url, `attendance_month_${m}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  });
  const btnExpYear = rosterWrap.querySelector('#rosterExportYearXlsx');
  if (btnExpYear) btnExpYear.addEventListener('click', async () => {
    const d = (dateEl && dateEl.value) ? dateEl.value : today;
    const y = d.slice(0, 4);
    const url = `/api/admin/work-reports/export.xlsx?period=year&year=${encodeURIComponent(y)}`;
    try {
      await downloadWithAuth(url, `attendance_year_${y}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  });

  await loadRoster(today);

  const form = document.createElement('form');
  const yNow = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 4);
  form.innerHTML = `
    <select id="tsUser">${users.map(u => `<option value="${u.id}">${u.id} ${u.username || u.email}</option>`).join('')}</select>
    <input id="tsYear" placeholder="Year(YYYY)" value="${yNow}" style="width:110px">
    <button type="button" id="tsExportXlsx">Excel</button>
    <input id="tsFrom" placeholder="From(YYYY-MM-DD)" style="width:150px">
    <input id="tsTo" placeholder="To(YYYY-MM-DD)" style="width:150px">
    <button type="submit">表示</button>
    <button type="button" id="tsExport">CSV</button>
  `;
  const resultDiv = document.createElement('div');
  const detailDiv = document.createElement('div');

  let currentUserId = null;
  delegate(resultDiv, 'button[data-action="day-detail"]', 'click', async (_e, btn) => {
    const date = btn.dataset.date || '';
    if (!date) return;
    if (!currentUserId) return;
    const q = await getAttendanceDay(currentUserId, date, { signal });
    if (!isCurrent) return;
    detailDiv.innerHTML = `<h4>${date} 編集</h4>`;
    const t2 = document.createElement('table');
    t2.style.width = '100%';
    t2.innerHTML = '<thead><tr><th>ID</th><th>出勤</th><th>退勤</th><th>保存</th></tr></thead>';
    const b2 = document.createElement('tbody');
    for (const seg of (q.segments || [])) {
      const tr2 = document.createElement('tr');
      tr2.innerHTML = `
        <td>${seg.id}</td>
        <td><input data-in="${seg.id}" value="${seg.checkIn || ''}"></td>
        <td><input data-out="${seg.id}" value="${seg.checkOut || ''}"></td>
        <td><button type="button" data-action="save-att" data-id="${seg.id}">保存</button></td>
      `;
      b2.appendChild(tr2);
    }
    t2.appendChild(b2);
    detailDiv.appendChild(t2);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(form.querySelector('#tsUser').value, 10);
    const from = form.querySelector('#tsFrom').value.trim();
    const to = form.querySelector('#tsTo').value.trim();
    currentUserId = userId;
    const r = await getTimesheet(userId, from, to, { signal });
    if (!isCurrent) return;
    resultDiv.innerHTML = '';
    detailDiv.innerHTML = '';
    const table = document.createElement('table');
    table.style.width = '100%';
    table.innerHTML = '<thead><tr><th>日付</th><th>通常</th><th>残業</th><th>深夜</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    for (const d of (r.days || [])) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${d.date}</td><td>${d.regularMinutes}</td><td>${d.overtimeMinutes}</td><td>${d.nightMinutes}</td><td><button type="button" data-action="day-detail" data-date="${d.date}">詳細</button></td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    resultDiv.appendChild(table);
  });

  form.querySelector('#tsExport').addEventListener('click', () => {
    const userId = parseInt(form.querySelector('#tsUser').value, 10);
    const from = form.querySelector('#tsFrom').value.trim();
    const to = form.querySelector('#tsTo').value.trim();
    const url = buildTimesheetExportURL(String(userId), from, to);
    downloadWithAuth(url, 'timesheet.csv');
  });
  form.querySelector('#tsExportXlsx').addEventListener('click', async () => {
    const userId = parseInt(form.querySelector('#tsUser').value, 10);
    const yEl = form.querySelector('#tsYear');
    const year = String((yEl && yEl.value) ? yEl.value : yNow).trim() || yNow;
    const url = `/api/admin/employees/${encodeURIComponent(String(userId))}/export.xlsx?year=${encodeURIComponent(year)}`;
    try {
      await downloadWithAuth(url, `employee_${userId}_${year}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  });

  const adv = document.createElement('details');
  adv.open = false;
  adv.innerHTML = `<summary style="cursor:pointer;font-weight:900;padding:10px 0;">個人タイムシート（詳細）</summary>`;
  adv.appendChild(form);
  adv.appendChild(resultDiv);
  adv.appendChild(detailDiv);
  content.appendChild(adv);
  delegate(adv, 'button[data-action="save-att"]', 'click', async (_e, btn) => {
    const id = btn.dataset.id || '';
    if (!id) return;
    const inEl = adv.querySelector(`input[data-in="${id}"]`);
    const outEl = adv.querySelector(`input[data-out="${id}"]`);
    const inVal = inEl && inEl.value ? inEl.value : null;
    const outVal = outEl && outEl.value ? outEl.value : null;
    await updateAttendanceSegment(id, { checkIn: inVal, checkOut: outVal }, { signal });
    alert('保存しました');
  });

  return () => {
    try { content.innerHTML = ''; } catch { }
    cleanup.run();
  };
}

export const attendancePage = createPage({ mount: mountAttendanceImpl });

export async function mountAttendance(ctx) {
  return attendancePage.mount(ctx);
}
