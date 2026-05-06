(function () {
  const root = globalThis.AttendanceMonthly || {};
  const core = root.Core || globalThis.MonthlyMonthlyCore || {};
  const state = root.State || globalThis.MonthlyMonthlyState || {};
  const api = root.Api || globalThis.MonthlyMonthlyApi || {};
  const render = root.Render || globalThis.MonthlyMonthlyRender || {};

  const {
    esc,
    fmtHm,
    fromDateTime,
    diffMinutesAllowOvernight,
    fetchJSONAuth,
    showErr
  } = core;

  const { renderTable } = render;
  const { loadMonth } = api;

  const renderContract = async (host, detail) => {
    if (!host) return;
    const rows0 = Array.isArray(detail?.shiftAssignments) ? detail.shiftAssignments : [];
    const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
    const addDaysISO = (ds, n) => {
      const s = String(ds || '').slice(0, 10);
      if (!isISODate(s)) return null;
      const y = parseInt(s.slice(0, 4), 10);
      const m = parseInt(s.slice(5, 7), 10) - 1;
      const d = parseInt(s.slice(8, 10), 10);
      const dt = new Date(Date.UTC(y, m, d, 0, 0, 0));
      dt.setUTCDate(dt.getUTCDate() + Number(n || 0));
      const y2 = dt.getUTCFullYear();
      const m2 = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d2 = String(dt.getUTCDate()).padStart(2, '0');
      return `${y2}-${m2}-${d2}`;
    };
    const keyOf = (r) => {
      const s = r?.shift || null;
      return [
        String((s && s.id != null) ? s.id : ''),
        String((s && s.name != null) ? s.name : ''),
        String((s && s.start_time != null) ? s.start_time : ''),
        String((s && s.end_time != null) ? s.end_time : ''),
        String((s && s.break_minutes != null) ? s.break_minutes : ''),
        String((s && s.standard_minutes != null) ? s.standard_minutes : '')
      ].join('|');
    };
    const normalized = (() => {
      const list = rows0
        .map(r => ({
          ...r,
          start_date: isISODate(r?.start_date) ? String(r.start_date).slice(0, 10) : null,
          end_date: isISODate(r?.end_date) ? String(r.end_date).slice(0, 10) : null,
          _k: keyOf(r)
        }))
        .filter(r => !!r.start_date)
        .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
      const out = [];
      for (let i = 0; i < list.length; i++) {
        const cur = { ...list[i] };
        const next = list[i + 1] || null;
        if (next?.start_date) {
          if (!cur.end_date || cur.end_date >= next.start_date) {
            cur.end_date = addDaysISO(next.start_date, -1);
          }
        }
        if (cur.end_date && cur.end_date < cur.start_date) continue;
        const last = out[out.length - 1] || null;
        if (last && last._k === cur._k) {
          const expected = last.end_date ? addDaysISO(last.end_date, 1) : null;
          if (!last.end_date || expected === cur.start_date) {
            last.end_date = last.end_date == null || cur.end_date == null ? null : (last.end_date > cur.end_date ? last.end_date : cur.end_date);
            continue;
          }
        }
        out.push(cur);
      }
      return out.map(({ _k, ...r }) => r);
    })();
    let rows = normalized.length ? normalized : rows0;
    if (!rows.length) {
      try {
        const role = String(profile?.role || '').toLowerCase();
        const uid = (role !== 'employee' && (state.currentViewingUserId || null)) ? String(state.currentViewingUserId) : '';
        const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
        const qp = [];
        if (uid) qp.push(`userId=${encodeURIComponent(uid)}`);
        if (/^\d{4}-\d{2}$/.test(ym)) qp.push(`ym=${encodeURIComponent(ym)}`);
        const qs = qp.length ? ('?' + qp.join('&')) : '';
        const prof = await fetchJSONAuth('/api/attendance/user-profile' + qs);
        const s = prof?.contract?.shift || null;
        if (s && (s.start_time || s.end_time)) {
          rows = [{
            shift: {
              id: s.id || null,
              name: s.name || '',
              start_time: s.start_time || '',
              end_time: s.end_time || '',
              break_minutes: s.break_minutes || 0,
              standard_minutes: s.standard_minutes || null
            },
            start_date: null,
            end_date: null,
            _suggest: true
          }];
          // Auto-apply shift assignment when month is empty and viewer is manager/admin
          if ((role === 'admin' || role === 'manager') && s.id) {
            try {
              const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
              const startDefault = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : null;
              if (startDefault) {
                await fetchJSONAuth('/api/attendance/shifts/assign', {
                  method: 'POST',
                  body: JSON.stringify({
                    userId: state.currentViewingUserId || undefined,
                    shiftId: s.id,
                    startDate: startDefault,
                    endDate: null
                  })
                });
                // reload month to reflect applied shift
                const { detail, timesheet } = await loadMonth(ym, (role === 'employee') ? null : (state.currentViewingUserId || null));
                state.currentMonthDetail = detail;
                state.currentMonthTimesheet = timesheet;
                rows = Array.isArray(detail?.shiftAssignments) ? detail.shiftAssignments : rows;
              }
            } catch {}
          }
        }
      } catch {}
    }
    const fmtBreak = (min) => {
      const m = Number(min);
      if (!Number.isFinite(m) || m < 0) return '—';
      return fmtHm(m);
    };
    const fmtStd = (min) => {
      const m = Number(min);
      if (!Number.isFinite(m) || m < 0) return '—';
      return fmtHm(m);
    };
    const table = document.createElement('table');
    table.innerHTML = `
    <thead>
      <tr>
        <th>No</th>
        <th>シフト</th>
        <th>開始時刻</th>
        <th>終了時刻</th>
        <th>休憩時間</th>
        <th>所定労働時間</th>
        <th>適用開始日</th>
        <th>適用終了日</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows.length ? rows.map((r, i) => {
          const s = r?.shift || null;
          const name = s ? (s.name || '') : '—';
          const st = s ? (s.start_time || '—') : '—';
          const et = s ? (s.end_time || '—') : '—';
          const br = s ? fmtBreak(s.break_minutes) : '—';
          const std = s ? fmtStd(s.standard_minutes) : '—';
          const sd = r?.start_date || '—';
          const ed = r?.end_date || '—';
          const sug = r?._suggest ? '（社員情報）' : '';
          return `<tr>
            <td>${esc(i + 1)}</td>
            <td>${esc(name)}${esc(sug)}</td>
            <td>${esc(st)}</td>
            <td>${esc(et)}</td>
            <td>${esc(br)}</td>
            <td>${esc(std)}</td>
            <td>${esc(sd)}</td>
            <td>${esc(ed)}</td>
          </tr>`;
        }).join('') : `<tr><td colspan="8" style="text-align:center;color:#64748b;font-weight:800;">シフトが未設定です（管理者がシフトを割り当てしてください）</td></tr>`
      }
    </tbody>
  `;
    host.innerHTML = '';
    host.appendChild(table);
  };

  const renderWorkDetail = async (host, detail, profile) => {
    if (!host) return;
    const role = String(profile?.role || '').toLowerCase();
    // Keep monthly table read-only: hide add/edit/delete actions for all roles.
    const canManage = false;
    let rows = Array.isArray(detail?.workDetails) ? detail.workDetails : [];
    if (!rows.length) {
      try {
        const uid = (role !== 'employee' && (state.currentViewingUserId || null)) ? String(state.currentViewingUserId) : '';
        const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
        const qp = [];
        if (uid) qp.push(`userId=${encodeURIComponent(uid)}`);
        if (/^\d{4}-\d{2}$/.test(ym)) qp.push(`ym=${encodeURIComponent(ym)}`);
        const qs = qp.length ? ('?' + qp.join('&')) : '';
        const prof = await fetchJSONAuth('/api/attendance/user-profile' + qs);
        if (Array.isArray(prof?.workDetails) && prof.workDetails.length) {
          const w = prof.workDetails[0];
          rows = [{
            id: null,
            startDate: w.start_date || '',
            endDate: w.end_date || '',
            companyName: w.company_name || '',
            workPlaceAddress: w.work_place_address || '',
            workContent: w.work_content || '',
            roleTitle: w.role_title || '',
            responsibilityLevel: w.responsibility_level || '',
            _suggest: true
          }];
          // Auto-apply first work detail when month is empty and viewer is manager/admin
          if (role === 'admin' || role === 'manager') {
            try {
              const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
              const startDefault = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : (rows[0].startDate || '');
              await fetchJSONAuth('/api/attendance/work-details', {
                method: 'POST',
                body: JSON.stringify({
                  userId: state.currentViewingUserId || undefined,
                  startDate: startDefault || null,
                  endDate: rows[0].endDate || null,
                  companyName: rows[0].companyName || '',
                  workPlaceAddress: rows[0].workPlaceAddress || '',
                  workContent: rows[0].workContent || '',
                  roleTitle: rows[0].roleTitle || '',
                  responsibilityLevel: rows[0].responsibilityLevel || ''
                })
              });
              // reload month to reflect applied work detail
              const { detail, timesheet } = await loadMonth(ym, (role === 'employee') ? null : (state.currentViewingUserId || null));
              state.currentMonthDetail = detail;
              state.currentMonthTimesheet = timesheet;
              rows = Array.isArray(detail?.workDetails) ? detail.workDetails : rows;
            } catch {}
          }
        }
      } catch {}
    }
    const esc2 = (v) => esc(v == null ? '' : v);
    const table = document.createElement('table');
    table.innerHTML = `
    <thead>
      <tr>
        <th>企業名</th>
        <th>適用終了日</th>
        <th>就業先住所</th>
        <th>業務内容</th>
        <th>役職</th>
        <th>責任の程度</th>
        ${canManage ? '<th>操作</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${
        rows.length ? rows.map((r) => {
          const id = r?.id;
          const company = r?.companyName || '';
          const endDate = r?.endDate || '—';
          const addr = r?.workPlaceAddress || '';
          const work = r?.workContent || '';
          const roleTitle = r?.roleTitle || '';
          const resp = r?.responsibilityLevel || '';
          const ops = canManage ? `
            <td style="white-space:nowrap;">
              ${r?._suggest ? `<button type="button" class="se-mini-btn" data-wd-action="apply" data-wd-id="suggest">適用</button>` : `
                <button type="button" class="se-mini-btn" data-wd-action="edit" data-wd-id="${esc2(id)}">編集</button>
                <button type="button" class="se-mini-btn" data-wd-action="del" data-wd-id="${esc2(id)}">削除</button>
              `}
            </td>
          ` : '';
          return `<tr>
            <td>${esc2(company)}</td>
            <td>${esc2(endDate)}</td>
            <td>${esc2(addr)}</td>
            <td>${esc2(work)}</td>
            <td>${esc2(roleTitle)}</td>
            <td>${esc2(resp)}</td>
            ${ops}
          </tr>`;
        }).join('') : `<tr><td colspan="${canManage ? 7 : 6}" style="text-align:center;color:#64748b;font-weight:800;">業務内容が未設定です（管理者が登録してください）</td></tr>`
      }
    </tbody>
  `;
    host.innerHTML = '';
    if (canManage) {
      const bar = document.createElement('div');
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.justifyContent = 'flex-end';
      bar.style.gap = '8px';
      bar.style.marginBottom = '8px';
      bar.innerHTML = `<button type="button" class="se-btn small" id="btnWorkDetailAdd">追加</button>`;
      host.appendChild(bar);
    }
    host.appendChild(table);
    if (!canManage) return;

    const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
    const promptText = (label, v) => {
      const x = window.prompt(label, String(v == null ? '' : v));
      if (x == null) return null;
      return String(x);
    };
    const promptDate = (label, v, allowEmpty) => {
      const x = window.prompt(label, String(v == null ? '' : v));
      if (x == null) return null;
      const s = String(x).trim();
      if (!s && allowEmpty) return '';
      if (!isISODate(s)) { alert('日付はYYYY-MM-DD形式で入力してください'); return null; }
      return s;
    };

    const saveNew = async () => {
      const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
      const startDefault = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : '';
      const startDate = promptDate('適用開始日 (YYYY-MM-DD)', startDefault, false);
      if (startDate == null) return;
      const endDate = promptDate('適用終了日 (YYYY-MM-DD / 空欄=なし)', '', true);
      if (endDate == null) return;
      const companyName = promptText('企業名', '');
      if (companyName == null) return;
      const workPlaceAddress = promptText('就業先住所', '');
      if (workPlaceAddress == null) return;
      const workContent = promptText('業務内容', '');
      if (workContent == null) return;
      const roleTitle = promptText('役職', '');
      if (roleTitle == null) return;
      const responsibilityLevel = promptText('責任の程度', '');
      if (responsibilityLevel == null) return;
      await fetchJSONAuth('/api/attendance/work-details', {
        method: 'POST',
        body: JSON.stringify({
          userId: state.currentViewingUserId || undefined,
          startDate,
          endDate: endDate || null,
          companyName,
          workPlaceAddress,
          workContent,
          roleTitle,
          responsibilityLevel
        })
      });
      const picker = document.querySelector('#monthPicker2') || document.querySelector('#monthPicker');
      const ym2 = picker?.value || '';
      if (/^\d{4}-\d{2}$/.test(ym2)) {
        const { detail, timesheet } = await loadMonth(ym2, (role === 'employee') ? null : (state.currentViewingUserId || null));
        state.currentMonthDetail = detail;
        state.currentMonthTimesheet = timesheet;
        renderContract(document.querySelector('#contractTable'), detail);
        renderWorkDetail(document.querySelector('#workDetailTable'), detail, profile);
        renderSummary(document.querySelector('#monthSummaryTable') || document.querySelector('#monthSummary'), detail, timesheet);
        renderTable(document.querySelector('#monthTable'), detail, profile);
      }
    };

    host.querySelector('#btnWorkDetailAdd')?.addEventListener('click', async () => {
      try { await saveNew(); } catch (e) { alert(String(e?.message || '保存に失敗しました')); }
    });

    host.querySelectorAll('button[data-wd-action][data-wd-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = String(btn.getAttribute('data-wd-action') || '');
        const idRaw = String(btn.getAttribute('data-wd-id') || '');
        const id = parseInt(idRaw, 10);
        if (action !== 'apply' && !id) return;
        try {
          const cur = action === 'apply' ? (rows.find(x => x?._suggest) || null) : (rows.find(x => String(x?.id) === String(id)) || null);
          if (!cur) return;
          if (action === 'del') {
            if (!confirm('削除します。よろしいですか？')) return;
            await fetchJSONAuth(`/api/attendance/work-details/${encodeURIComponent(String(id))}`, {
              method: 'DELETE',
              body: JSON.stringify({ userId: state.currentViewingUserId || undefined })
            });
          } else if (action === 'apply') {
            const ym = String((document.querySelector('#monthPicker2') || document.querySelector('#monthPicker'))?.value || '').trim();
            const startDefault = /^\d{4}-\d{2}$/.test(ym) ? `${ym}-01` : (cur.startDate || '');
            await fetchJSONAuth('/api/attendance/work-details', {
              method: 'POST',
              body: JSON.stringify({
                userId: state.currentViewingUserId || undefined,
                startDate: startDefault || null,
                endDate: cur.endDate || null,
                companyName: cur.companyName || cur.company_name || '',
                workPlaceAddress: cur.workPlaceAddress || cur.work_place_address || '',
                workContent: cur.workContent || cur.work_content || '',
                roleTitle: cur.roleTitle || cur.role_title || '',
                responsibilityLevel: cur.responsibilityLevel || cur.responsibility_level || ''
              })
            });
          } else if (action === 'edit') {
            const startDate = promptDate('適用開始日 (YYYY-MM-DD)', cur.startDate || '', false);
            if (startDate == null) return;
            const endDate = promptDate('適用終了日 (YYYY-MM-DD / 空欄=なし)', cur.endDate || '', true);
            if (endDate == null) return;
            const companyName = promptText('企業名', cur.companyName || '');
            if (companyName == null) return;
            const workPlaceAddress = promptText('就業先住所', cur.workPlaceAddress || '');
            if (workPlaceAddress == null) return;
            const workContent = promptText('業務内容', cur.workContent || '');
            if (workContent == null) return;
            const roleTitle = promptText('役職', cur.roleTitle || '');
            if (roleTitle == null) return;
            const responsibilityLevel = promptText('責任の程度', cur.responsibilityLevel || '');
            if (responsibilityLevel == null) return;
            await fetchJSONAuth(`/api/attendance/work-details/${encodeURIComponent(String(id))}`, {
              method: 'PUT',
              body: JSON.stringify({
                userId: state.currentViewingUserId || undefined,
                startDate,
                endDate: endDate || null,
                companyName,
                workPlaceAddress,
                workContent,
                roleTitle,
                responsibilityLevel
              })
            });
          }
          const picker = document.querySelector('#monthPicker2') || document.querySelector('#monthPicker');
          const ym2 = picker?.value || '';
          if (/^\d{4}-\d{2}$/.test(ym2)) {
            const { detail, timesheet } = await loadMonth(ym2, (role === 'employee') ? null : (state.currentViewingUserId || null));
            state.currentMonthDetail = detail;
            state.currentMonthTimesheet = timesheet;
            renderContract(document.querySelector('#contractTable'), detail);
            renderWorkDetail(document.querySelector('#workDetailTable'), detail, profile);
            renderSummary(document.querySelector('#monthSummaryTable') || document.querySelector('#monthSummary'), detail, timesheet);
            renderTable(document.querySelector('#monthTable'), detail, profile);
          }
        } catch (e) {
          alert(String(e?.message || '保存に失敗しました'));
        }
      });
    });
  };

  const renderSummary = (host, detail, timesheet) => {
    if (!host) return;
    const mode = (() => {
      try {
        const sec = document.querySelector('#summarySection');
        const tab = sec?.querySelector?.('.se-tab.active[data-tab]');
        return String(tab?.dataset?.tab || tab?.getAttribute?.('data-tab') || '') || 'sumAll';
      } catch {
        return 'sumAll';
      }
    })();

    const days = Array.isArray(detail?.days) ? detail.days : [];
    const isInhouse = (d) => {
      const loc = String(d?.daily?.location || '').toLowerCase();
      if (!loc) return false;
      return loc.includes('社内') || loc.includes('内勤') || loc.includes('inhouse');
    };
    const hasAttend = (d) => (d?.segments || []).some(s => !!s?.checkIn);
    const workTypeOf = (d) => {
      const dwt = String(d?.daily?.workType || '').trim();
      if (dwt) return dwt;
      const segs = Array.isArray(d?.segments) ? d.segments : [];
      for (const s of segs) {
        const wt = String(s?.workType || '').trim();
        if (wt) return wt;
      }
      return '';
    };
    const scope = mode === 'sumInhouse' ? days.filter(isInhouse) : days;

    const off = scope.filter(d => Number(d?.is_off || 0) === 1).length;
    const working = scope.length ? (scope.length - off) : 0;
    const attendDays = scope.filter(hasAttend).length;
    const holidayWorkDays = scope.filter(d => Number(d?.is_off || 0) === 1 && hasAttend(d)).length;
    const absent = Math.max(0, working - (attendDays - holidayWorkDays));

    let totals = (mode === 'sumAll' && timesheet?.days) ? timesheet.days.reduce((acc, d) => {
      acc.regular += Number(d?.regularMinutes || 0);
      acc.overtime += Number(d?.overtimeMinutes || 0);
      acc.night += Number(d?.nightMinutes || 0);
      return acc;
    }, { regular: 0, overtime: 0, night: 0 }) : { regular: 0, overtime: 0, night: 0 };
    if (mode === 'sumInhouse') {
      const t2 = { regular: 0, overtime: 0, night: 0 };
      for (const d of scope) {
        const segs = Array.isArray(d?.segments) ? d.segments : [];
        let raw = 0;
        for (const s of segs) {
          const inHm = fromDateTime(s?.checkIn);
          const outHm = fromDateTime(s?.checkOut);
          if (!inHm || !outHm) continue;
          const m = diffMinutesAllowOvernight(inHm, outHm);
          if (m != null && m > 0) raw += m;
        }
        if (raw <= 0) continue;
        const br = Number((d && d.daily && d.daily.breakMinutes != null) ? d.daily.breakMinutes : 60);
        const workMin = Math.max(0, raw - (Number.isFinite(br) ? br : 60));
        t2.regular += Math.min(8 * 60, workMin);
        t2.overtime += Math.max(0, workMin - (8 * 60));
      }
      totals = t2;
    }

    const counts = scope.reduce((acc, d) => {
      if (!hasAttend(d)) return acc;
      const wt = workTypeOf(d);
      if (wt === 'onsite') acc.onsite += 1;
      else if (wt === 'remote') acc.remote += 1;
      else if (wt === 'satellite') acc.satellite += 1;
      return acc;
    }, { onsite: 0, remote: 0, satellite: 0 });

    const stored = mode === 'sumInhouse' ? (detail?.monthSummary?.inhouse || null) : (detail?.monthSummary?.all || null);
    const leave = detail?.leaveSummary || {};
    let paidDays = Number(mode === 'sumInhouse' ? 0 : (leave?.paidDays || 0));
    let substituteDays = Number(mode === 'sumInhouse' ? 0 : (leave?.substituteDays || 0));
    let unpaidDays = Number(mode === 'sumInhouse' ? 0 : (leave?.unpaidDays || 0));
    let standbyDays = Number(mode === 'sumInhouse' ? 0 : (leave?.standbyDays || 0));
    let totalWork = Math.max(0, Number(totals.regular || 0) + Number(totals.overtime || 0));
    let deductionTime = 0;
    let legalOvertimeMin = (() => {
      if (mode !== 'sumAll' || !Array.isArray(timesheet?.days)) return Number(totals.overtime || 0);
      const isoWeekStartStr = (s) => {
        const d = new Date(String(s || '').slice(0, 10) + 'T00:00:00Z');
        const dow = d.getUTCDay();
        const delta = (dow + 6) % 7;
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - delta));
        const y = start.getUTCFullYear();
        const m2 = String(start.getUTCMonth() + 1).padStart(2, '0');
        const d2 = String(start.getUTCDate()).padStart(2, '0');
        return `${y}-${m2}-${d2}`;
      };
      let dailyOverTotal = 0;
      let weeklyAdditional = 0;
      const weeks = {};
      for (const day of timesheet.days) {
        const worked = Number(day?.regularMinutes || 0) + Number(day?.overtimeMinutes || 0);
        const dOver = Math.max(0, worked - (8 * 60));
        dailyOverTotal += dOver;
        const w = isoWeekStartStr(day?.date);
        if (!weeks[w]) weeks[w] = { total: 0, dailyOver: 0 };
        weeks[w].total += worked;
        weeks[w].dailyOver += dOver;
      }
      for (const k in weeks) {
        const over = Math.max(0, (weeks[k].total || 0) - (40 * 60));
        const add = Math.max(0, over - (weeks[k].dailyOver || 0));
        weeklyAdditional += add;
      }
      return Math.max(0, dailyOverTotal + weeklyAdditional);
    })();
    let plannedDays = working;
    let attendDays2 = attendDays;
    let holidayWorkDays2 = holidayWorkDays;
    let absent2 = absent;
    let onsiteDays2 = counts.onsite;
    let remoteDays2 = counts.remote;
    let satelliteDays2 = counts.satellite;
    let usedFrontend = false;
    
    // Auto re-calculate from frontend rows instead of using stored DB values
    try {
      const tableRows = Array.from(document.querySelectorAll('#monthTable [data-row="1"][data-date]'));
      if (tableRows.length > 0) {
        usedFrontend = true;
        let frontendTotalWork = 0;
        let frontendOvertime = 0;
        let frontendNight = 0;
        let frontendAttendDays = 0;
        let frontendHolidayWorkDays = 0;
        let frontendOnsite = 0;
        let frontendRemote = 0;
        let frontendSatellite = 0;
        
        for (const row of tableRows) {
          const isOff = row.classList.contains('holiday') || row.classList.contains('sun') || row.classList.contains('sat') || String(row.dataset.baseOff) === '1';
          const workText = String(row.querySelector('td[data-field="worked"]')?.textContent || '').trim();
          const overText = String(row.querySelector('td[data-field="excess"]')?.textContent || '').trim();
          const wt = String(row.dataset.workType || '');
          const clsSel = row.querySelector('select[data-field="classification"]');
          const kubunVal = clsSel ? String(clsSel.value || '').trim() : '';
          
          let workedThisRow = false;
          
          if (workText && workText !== '0:00' && workText !== '—' && !row.querySelector('td[data-field="worked"]')?.classList.contains('is-auto')) {
             const pts = workText.split(':');
             if (pts.length === 2) {
               frontendTotalWork += (parseInt(pts[0], 10) * 60) + parseInt(pts[1], 10);
               workedThisRow = true;
             }
          }
          if (overText && overText !== '0:00' && overText !== '—' && !row.querySelector('td[data-field="excess"]')?.classList.contains('is-auto')) {
             const pts = overText.split(':');
             if (pts.length === 2) frontendOvertime += (parseInt(pts[0], 10) * 60) + parseInt(pts[1], 10);
          }
          
          const inEl = row.querySelector('input.se-time[data-field="checkIn"]');
          const outEl = row.querySelector('input.se-time[data-field="checkOut"]');
          const inV = String(inEl?.value || '').trim();
          const outV = String(outEl?.value || '').trim();
          const inAuto = String(inEl?.dataset?.auto || '') === '1';
          const outAuto = String(outEl?.dataset?.auto || '') === '1';
          const hasManualTime = (!!inV && !inAuto) || (!!outV && !outAuto);
          const hasEntry = row.classList.contains('has-entry') || !!String(row.dataset.id || '').trim();
          const isHolidayWorkKubun = kubunVal === '休日出勤';
          const isAttendKubun = kubunVal === '出勤' || kubunVal === '半休' || kubunVal === '代替出勤';
          if (!kubunVal) continue; // chỉ đếm theo kubun đã chọn
          if (isHolidayWorkKubun) frontendHolidayWorkDays++;
          else if (isAttendKubun) frontendAttendDays++;
          else continue;
            
            // Re-check the UI checkboxes to get the absolute source of truth instead of dataset which might be delayed
            const ckOn = row.querySelector('input[data-field="ckOnsite"]');
            const ckRe = row.querySelector('input[data-field="ckRemote"]');
            const ckSa = row.querySelector('input[data-field="ckSatellite"]');
            
            if (ckOn || ckRe || ckSa) {
               if (ckOn?.checked) frontendOnsite++;
               else if (ckRe?.checked) frontendRemote++;
               else if (ckSa?.checked) frontendSatellite++;
            } else {
               if (wt === 'onsite') frontendOnsite++;
               else if (wt === 'remote') frontendRemote++;
               else if (wt === 'satellite') frontendSatellite++;
            }
        }
        totalWork = frontendTotalWork;
        totals.overtime = frontendOvertime;
        legalOvertimeMin = frontendOvertime; // Approximation based on frontend
        attendDays2 = frontendAttendDays;
        holidayWorkDays2 = frontendHolidayWorkDays;
        
        // Calculate absent days: only count working days that are NOT attended AND have passed or have '欠勤' explicitly
        // Since we don't strictly know if a day has passed without checking Date.now(), we'll count '欠勤' explicitly 
        // OR days that are working days but have no attendance/entry (working - frontendAttendDays).
        // Wait, working already excludes off days. So if working = 22, and attend = 18, absent could be 4.
        // But if some days are future days, they shouldn't be counted as absent.
        // Let's count explicitly: kubun is '欠勤' or (past working day with no attendance). 
        // For simplicity to match standard logic: 
        // If the table has explicitly selected '欠勤', count it. If not, only count if it's a past working day without attendance.
        // A safer way: Just count how many rows have kubun === '欠勤'.
        let explicitAbsent = 0;
        for (const row of tableRows) {
           const clsSel = row.querySelector('select[data-field="classification"]');
           if (clsSel && clsSel.value === '欠勤') explicitAbsent++;
        }
        absent2 = explicitAbsent > 0 ? explicitAbsent : 0; // If explicit exists, use it. Otherwise 0 until admin sets it or end of month calculation.
        
        onsiteDays2 = frontendOnsite;
        remoteDays2 = frontendRemote;
        satelliteDays2 = frontendSatellite;
      }
    } catch(e) {}
    
    // Optionally merge with stored if needed for things not calculatable
    if (stored && typeof stored === 'object') {
      if (plannedDays === 0) plannedDays = Number(stored.plannedDays == null ? plannedDays : stored.plannedDays) || 0;
      if (!usedFrontend) {
        attendDays2 = Number(stored.attendDays == null ? attendDays2 : stored.attendDays) || 0;
        holidayWorkDays2 = Number(stored.holidayWorkDays == null ? holidayWorkDays2 : stored.holidayWorkDays) || 0;
      }
      standbyDays = Number(stored.standbyDays == null ? standbyDays : stored.standbyDays) || 0;
      paidDays = Number(stored.paidDays == null ? paidDays : stored.paidDays) || 0;
      substituteDays = Number(stored.substituteDays == null ? substituteDays : stored.substituteDays) || 0;
      unpaidDays = Number(stored.unpaidDays == null ? unpaidDays : stored.unpaidDays) || 0;
      deductionTime = Number(stored.deductionMinutes == null ? deductionTime : stored.deductionMinutes) || 0;
      if (!usedFrontend) {
        absent2 = Number(stored.absentDays == null ? absent2 : stored.absentDays) || 0;
        onsiteDays2 = Number(stored.onsiteDays == null ? onsiteDays2 : stored.onsiteDays) || 0;
        remoteDays2 = Number(stored.remoteDays == null ? remoteDays2 : stored.remoteDays) || 0;
        satelliteDays2 = Number(stored.satelliteDays == null ? satelliteDays2 : stored.satelliteDays) || 0;
      }
    }
    const paidText = Number.isFinite(paidDays) ? Number(paidDays).toFixed(1) : '0.0';
    const grantedTotalFromSummary = Number(leave?.grantedDaysTotal || 0);
    const grantedTotalFromUser = Number(detail?.user?.paidLeaveGrantedTotalDays || 0);
    const grantedFromSummary = Number(leave?.grantedDays || 0);
    const grantedFromUser = Number(detail?.user?.paidLeaveGrantedDays || 0);
    const entitlementText = (Number.isFinite(grantedTotalFromSummary) && grantedTotalFromSummary > 0)
      ? Number(grantedTotalFromSummary).toFixed(1)
      : (Number.isFinite(grantedTotalFromUser) && grantedTotalFromUser > 0)
        ? Number(grantedTotalFromUser).toFixed(1)
      : (Number.isFinite(grantedFromSummary) && grantedFromSummary > 0)
      ? Number(grantedFromSummary).toFixed(1)
      : (Number.isFinite(grantedFromUser) && grantedFromUser > 0)
        ? Number(grantedFromUser).toFixed(1)
        : String(detail?.user?.paidLeaveEntitlement || '—');

    const table = document.createElement('table');
    const L = {
      planned: '所定日数', attend: '出勤日数', holiday: '休日出勤日数', standby: '待機日数',
      total: '総労働時間', night: '深夜時間', overtime: '総残業時間', legal: '法定外時間',
      paid: '有休日数', entitlement: '有給付与', substitute: '代休日数', unpaid: '無給休暇',
      absent: '欠勤日数', deduction: '控除時間', onsite: '出社日数', remote: '在宅日数', satellite: '現場・出張日数'
    };
    if (mode === 'sumAll') {
      table.innerHTML = `
      <thead>
        <tr>
          <th>${esc(L.planned)}</th>
          <th>${esc(L.attend)}</th>
          <th>${esc(L.holiday)}</th>
          <th>${esc(L.standby)}</th>
          <th>${esc(L.total)}</th>
          <th>${esc(L.night)}</th>
          <th>${esc(L.overtime)}</th>
          <th>${esc(L.legal)}</th>
          <th>${esc(L.paid)}</th>
          <th>${esc(L.entitlement)}</th>
          <th>${esc(L.substitute)}</th>
          <th>${esc(L.unpaid)}</th>
          <th>${esc(L.absent)}</th>
          <th>${esc(L.deduction)}</th>
          <th>${esc(L.onsite)}</th>
          <th>${esc(L.remote)}</th>
          <th>${esc(L.satellite)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(plannedDays)}日</td>
          <td>${esc(attendDays2)}日</td>
          <td>${esc(holidayWorkDays2)}日</td>
          <td>${esc(standbyDays)}日</td>
          <td>${esc(fmtHm(totalWork))}</td>
          <td>${esc(fmtHm(totals.night))}</td>
          <td>${esc(fmtHm(totals.overtime))}</td>
          <td>${esc(fmtHm(legalOvertimeMin))}</td>
          <td>${esc(paidText)}日</td>
          <td>${esc(entitlementText)}日</td>
          <td>${esc(substituteDays)}日</td>
          <td>${esc(unpaidDays)}日</td>
          <td>${esc(absent2)}日</td>
          <td>${esc(fmtHm(deductionTime))}</td>
          <td>${esc(onsiteDays2)}日</td>
          <td>${esc(remoteDays2)}日</td>
          <td>${esc(satelliteDays2)}日</td>
        </tr>
      </tbody>
    `;
    } else {
      table.innerHTML = `
      <thead>
        <tr>
          <th>${esc(L.planned)}</th>
          <th>${esc(L.attend)}</th>
          <th>${esc(L.holiday)}</th>
          <th>${esc(L.standby)}</th>
          <th>${esc(L.total)}</th>
          <th>${esc(L.night)}</th>
          <th>${esc(L.overtime)}</th>
          <th>${esc(L.legal)}</th>
          <th>${esc(L.paid)}</th>
          <th>${esc(L.substitute)}</th>
          <th>${esc(L.unpaid)}</th>
          <th>${esc(L.absent)}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(plannedDays)}日</td>
          <td>${esc(attendDays2)}日</td>
          <td>${esc(holidayWorkDays2)}日</td>
          <td>${esc(standbyDays)}日</td>
          <td>${esc(fmtHm(totalWork))}</td>
          <td>${esc(fmtHm(totals.night))}</td>
          <td>${esc(fmtHm(totals.overtime))}</td>
          <td>${esc(fmtHm(legalOvertimeMin))}</td>
          <td>${esc(paidText)}日</td>
          <td>${esc(substituteDays)}日</td>
          <td>${esc(unpaidDays)}日</td>
          <td>${esc(absent2)}日</td>
        </tr>
      </tbody>
    `;
    }
    host.innerHTML = '';
    host.appendChild(table);
  };

  const renderPlan = (host, detail, profile) => {
    if (!host) return;
    const days = Array.isArray(detail?.days) ? detail.days : [];
    const table = document.createElement('table');
    table.innerHTML = `
    <thead>
      <tr>
        <th>日付</th>
        <th>勤務区分</th>
        <th>企業名</th>
        <th>開始時刻</th>
        <th>終了時刻</th>
        <th>休憩時間</th>
        <th>深夜休憩</th>
        <th>勤務時間</th>
        <th>勤務形態</th>
      </tr>
    </thead>
    <tbody>
      ${
        days.map(d => {
          const ds = String(d?.date || '');
          const dow = core.dowJa(ds);
          const isOff = Number(d?.is_off || 0) === 1;
          const plan = d?.plan || null;
          const shift = d?.shift || null;
          
          const kubun = isOff ? '休日' : '出勤';
          const company = plan?.location || '';
          const st = plan?.startTime || shift?.start_time || '';
          const et = plan?.endTime || shift?.end_time || '';
          const br = plan?.breakMinutes != null ? plan.breakMinutes : (shift?.break_minutes || 0);
          const nb = plan?.nightBreakMinutes || 0;
          const wt = plan?.workType || (isOff ? '' : '契約なし');
          
          let workMin = 0;
          if (st && et) {
            const sM = core.parseHm(st);
            const eM = core.parseHm(et);
            if (sM != null && eM != null) {
              const raw = eM >= sM ? (eM - sM) : (eM + 1440 - sM);
              workMin = Math.max(0, raw - br - nb);
            }
          }

          return `<tr class="${isOff ? 'off' : ''}">
            <td>${esc(ds.slice(5).replace('-', '/'))}(${esc(dow)})</td>
            <td>${esc(kubun)}</td>
            <td><input type="text" class="se-input plan-input" data-date="${ds}" data-field="location" value="${esc(company)}"></td>
            <td><input type="time" class="se-input plan-input" data-date="${ds}" data-field="startTime" value="${esc(st)}"></td>
            <td><input type="time" class="se-input plan-input" data-date="${ds}" data-field="endTime" value="${esc(et)}"></td>
            <td>
              <select class="se-select plan-input" data-date="${ds}" data-field="breakMinutes">
                <option value="60" ${br === 60 ? 'selected' : ''}>1:00</option>
                <option value="45" ${br === 45 ? 'selected' : ''}>0:45</option>
                <option value="30" ${br === 30 ? 'selected' : ''}>0:30</option>
                <option value="0" ${br === 0 ? 'selected' : ''}>0:00</option>
              </select>
            </td>
            <td>0:00</td>
            <td>${esc(core.fmtHm(workMin))}</td>
            <td><input type="text" class="se-input plan-input" data-date="${ds}" data-field="workType" value="${esc(wt)}"></td>
          </tr>`;
        }).join('')
      }
    </tbody>
    `;
    host.innerHTML = '';
    host.appendChild(table);

    // Bind inputs
    host.querySelectorAll('.plan-input').forEach(el => {
      el.addEventListener('change', async (e) => {
        const date = el.dataset.date;
        const field = el.dataset.field;
        const val = el.value;
        const row = el.closest('tr');
        const plan = days.find(d => d.date === date)?.plan || {};
        plan[field] = (field === 'breakMinutes') ? parseInt(val, 10) : val;
        
        try {
          await fetchJSONAuth('/api/attendance/plan', {
            method: 'PUT',
            body: JSON.stringify({ date, plan })
          });
          // Recalculate work time locally
          const st = row.querySelector('[data-field="startTime"]').value;
          const et = row.querySelector('[data-field="endTime"]').value;
          const br = parseInt(row.querySelector('[data-field="breakMinutes"]').value, 10);
          if (st && et) {
            const sM = core.parseHm(st);
            const eM = core.parseHm(et);
            const raw = eM >= sM ? (eM - sM) : (eM + 1440 - sM);
            const wm = Math.max(0, raw - br);
            row.children[7].textContent = core.fmtHm(wm);
          }
        } catch (err) {
          console.error('Plan save failed:', err);
        }
      });
    });
  };

  const mod = { renderContract, renderWorkDetail, renderSummary, renderPlan };
  root.SectionsRender = mod;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlySectionsRender = mod;
})();
