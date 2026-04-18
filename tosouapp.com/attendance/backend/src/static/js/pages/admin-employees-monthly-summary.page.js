import { fetchJSONAuth } from '../api/http.api.js';
import { listEmployees } from '../api/employees.api.js';
import { wireAdminShell } from '../shell/admin-shell.js?v=navy-20260418-menuhotfix7';

const $ = (sel, root = document) => root.querySelector(sel);

function wireTopbarMenus() {
  try {
    if (document.body.dataset.monthlySummaryMenus === '1') return;
    document.body.dataset.monthlySummaryMenus = '1';
    const menus = Array.from(document.querySelectorAll('.subbar .menu'));
    const openClass = 'open';
    const closeAll = () => {
      for (const m of menus) m.classList.remove(openClass);
    };
    for (const m of menus) {
      const btn = m.querySelector('.menu-btn');
      if (!btn || btn.dataset.bound === '1') continue;
      btn.dataset.bound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = m.classList.contains(openClass);
        closeAll();
        if (!isOpen) m.classList.add(openClass);
      });
    }
    document.addEventListener('click', (e) => {
      const t = e && e.target;
      if (t && t.closest && t.closest('.subbar .menu')) return;
      closeAll();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  } catch {}
}

function codeOf(u) {
  return String(u.employee_code || u.employeeCode || (u.id ? ('EMP' + String(u.id).padStart(3, '0')) : '')).trim();
}

function nameOf(u) {
  return String(u.username || u.name || u.full_name || u.fullName || u.email || (u.id ? `社員${u.id}` : '')).trim();
}

function roleOf(u) {
  return String(u.role || '').toLowerCase();
}

function statusOf(u) {
  return String(u.employment_status || u.employmentStatus || 'active').toLowerCase();
}

function currentMonthJST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);
}

async function fetchEmployees() {
  const me = await fetchJSONAuth('/api/auth/me').catch(() => null);
  const role = String(me?.role || '').toLowerCase();
  let rows = [];
  if (role === 'admin') {
    rows = await listEmployees().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      const r = await fetchJSONAuth('/api/admin/users').catch(() => null);
      rows = Array.isArray(r) ? r : ((r && Array.isArray(r.rows)) ? r.rows : []);
    }
  } else {
    const r = await fetchJSONAuth('/api/manager/users').catch(() => null);
    rows = Array.isArray(r) ? r : ((r && Array.isArray(r.rows)) ? r.rows : []);
  }
  return (Array.isArray(rows) ? rows : [])
    .filter(u => statusOf(u) !== 'inactive' && statusOf(u) !== 'retired')
    .filter(u => role !== 'admin' ? roleOf(u) === 'employee' : (roleOf(u) === 'employee' || !!u.employee_code || !!u.employeeCode))
    .sort((a, b) => codeOf(a).localeCompare(codeOf(b)) || nameOf(a).localeCompare(nameOf(b)));
}

function hmToMin(s) {
  const t = String(s || '').trim();
  if (!t) return 0;
  const m = t.match(/^(\d+):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm) || mm < 0 || mm >= 60) return null;
  return Math.max(0, (h * 60) + mm);
}

function minToHm(min) {
  const m = Math.max(0, Number(min || 0));
  const h = Math.floor(m / 60);
  const r = Math.floor(m % 60);
  return `${h}:${String(r).padStart(2, '0')}`;
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fromDateTime(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  const m = t.match(/[T\s](\d{2}:\d{2})/);
  if (m) return m[1];
  // Support plain "HH:MM[:SS]" payloads as well.
  const hm = t.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  return hm ? hm[1] : '';
}

function parseHm(s) {
  const t = String(s || '').trim();
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return (h * 60) + mm;
}

function diffMinutesAllowOvernight(a, b) {
  const am = parseHm(a);
  const bm = parseHm(b);
  if (am == null || bm == null) return null;
  return bm >= am ? (bm - am) : (bm + 1440 - am);
}

function isInhouseDay(d) {
  const wt = String(workTypeOf(d) || '').trim();
  if (wt === 'onsite') return true;
  const loc = String(d?.daily?.location || '').toLowerCase();
  return !!loc && (loc.includes('社内') || loc.includes('内勤') || loc.includes('inhouse'));
}

function hasAttend(d) {
  return (Array.isArray(d?.segments) ? d.segments : []).some(s => !!s?.checkIn);
}

function workTypeOf(d) {
  const dwt = String(d?.daily?.workType || '').trim();
  if (dwt) return dwt;
  const segs = Array.isArray(d?.segments) ? d.segments : [];
  for (const s of segs) {
    const wt = String(s?.workType || '').trim();
    if (wt) return wt;
  }
  return '';
}

function pickDisplaySeg(d) {
  const segs = Array.isArray(d?.segments) ? d.segments : [];
  const list0 = segs.length ? [...segs].sort((a, b) => String(b?.checkIn || '').localeCompare(String(a?.checkIn || ''))) : [null];
  return list0.find(s => s && s.checkIn && !s.checkOut) || list0[0] || null;
}

function computeRowDisplay(d) {
  const dateStr = String(d?.date || '');
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  const offDay = Number(d?.is_off || 0) === 1 || dow === 0 || dow === 6;
  const daily = d?.daily || null;
  const shift = d?.shift || null;
  const seg = pickDisplaySeg(d);
  const kubunInitRaw = String(daily?.kubun || '').trim();
  const kubunOptions = offDay ? ['休日', '休日出勤', '代替出勤'] : ['出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日'];
  let kubunInit = kubunOptions.includes(kubunInitRaw) ? kubunInitRaw : '';
  const plannedKubun = offDay ? '休日' : '出勤';
  const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
  const hasActual = !!(seg?.id || seg?.checkIn || seg?.checkOut);
  if (offDay && !kubunInit && hasActual) kubunInit = '休日出勤';
  const effectiveKubun = kubunInit || plannedKubun;
  const isWorkDay = workKubunSet.has(effectiveKubun);
  const isPlanned = !kubunInit && !hasActual;
  const shiftStart = String(shift?.start_time || '08:00').trim();
  const shiftEnd = String(shift?.end_time || '17:00').trim();
  const shiftStartOk = /^\d{1,2}:\d{2}$/.test(shiftStart);
  const shiftEndOk = /^\d{1,2}:\d{2}$/.test(shiftEnd);
  const inHm = fromDateTime(seg?.checkIn);
  const outHm = fromDateTime(seg?.checkOut);
  const finalIn = isWorkDay ? (inHm || shiftStart) : '';
  const finalOut = isWorkDay ? (outHm || shiftEnd) : '';
  const autoIn = isWorkDay && !inHm && shiftStartOk;
  const autoOut = isWorkDay && !outHm && shiftEndOk;
  const brMin = (isWorkDay || hasActual) ? Number(daily?.breakMinutes ?? 60) : 0;
  const nbMin = (isWorkDay || hasActual) ? Number(daily?.nightBreakMinutes ?? 0) : 0;
  const totalBmin = (Number.isFinite(brMin) ? brMin : 60) + (Number.isFinite(nbMin) ? nbMin : 0);
  const rawMin = (finalIn && finalOut) ? diffMinutesAllowOvernight(finalIn, finalOut) : null;
  const workMin = (rawMin == null || rawMin <= 0) ? 0 : Math.max(0, rawMin - totalBmin);
  const whStr = (finalIn && finalOut) ? minToHm(workMin) : '';
  const isAutoWork = isWorkDay && (autoIn || autoOut) && !!whStr;
  const stM = parseHm(shiftStart);
  const etM = parseHm(shiftEnd);
  const outM = parseHm(finalOut);
  const overtimeMin = (() => {
    if (!finalIn || !finalOut) return 0;
    if (outM != null && stM != null && etM != null) {
      const overnight = etM < stM;
      const endAbs = overnight ? (etM + 24 * 60) : etM;
      const outAbs = overnight && outM < stM ? (outM + 24 * 60) : outM;
      return Math.max(0, outAbs - endAbs);
    }
    return Math.max(0, workMin - (8 * 60));
  })();
  return {
    kubunVal: kubunInit,
    isWorkDay,
    isPlanned,
    workType: workTypeOf(d),
    workMin,
    overtimeMin,
    workIsAuto: isAutoWork && isPlanned,
    overtimeIsAuto: overtimeMin > 0 && isAutoWork && isPlanned
  };
}

function computeSummary(detail, timesheet, mode) {
  const days = Array.isArray(detail?.days) ? detail.days : [];
  const scope = mode === 'sumIh' ? days.filter(isInhouseDay) : days;
  const off = scope.filter(d => Number(d?.is_off || 0) === 1).length;
  const working = scope.length ? (scope.length - off) : 0;
  const attendDays = scope.filter(hasAttend).length;
  const holidayWorkDays = scope.filter(d => Number(d?.is_off || 0) === 1 && hasAttend(d)).length;
  let absentDays = Math.max(0, working - (attendDays - holidayWorkDays));

  let totals = mode === 'sumAll' && Array.isArray(timesheet?.days)
    ? timesheet.days.reduce((acc, d) => {
      acc.regular += Number(d?.regularMinutes || 0);
      acc.overtime += Number(d?.overtimeMinutes || 0);
      acc.night += Number(d?.nightMinutes || 0);
      return acc;
    }, { regular: 0, overtime: 0, night: 0 })
    : { regular: 0, overtime: 0, night: 0 };

  if (mode === 'sumIh') {
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

  const leave = detail?.leaveSummary || {};
  const stored = mode === 'sumIh' ? (detail?.monthSummary?.inhouse || null) : (detail?.monthSummary?.all || null);
  let paidDays = Number(mode === 'sumIh' ? 0 : (leave?.paidDays || 0));
  let substituteDays = Number(mode === 'sumIh' ? 0 : (leave?.substituteDays || 0));
  let unpaidDays = Number(mode === 'sumIh' ? 0 : (leave?.unpaidDays || 0));
  let standbyDays = Number(mode === 'sumIh' ? 0 : (leave?.standbyDays || 0));
  let totalWorkMinutes = Math.max(0, Number(totals.regular || 0) + Number(totals.overtime || 0));
  let deductionMinutes = 0;
  let legalOvertimeMinutes = mode !== 'sumAll' || !Array.isArray(timesheet?.days)
    ? Number(totals.overtime || 0)
    : (() => {
      const isoWeekStart = (s) => {
        const d = new Date(String(s || '').slice(0, 10) + 'T00:00:00Z');
        const dow = d.getUTCDay();
        const delta = (dow + 6) % 7;
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - delta));
        return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
      };
      let dailyOverTotal = 0;
      let weeklyAdditional = 0;
      const weeks = {};
      for (const day of timesheet.days) {
        const worked = Number(day?.regularMinutes || 0) + Number(day?.overtimeMinutes || 0);
        const dOver = Math.max(0, worked - 480);
        dailyOverTotal += dOver;
        const w = isoWeekStart(day?.date);
        if (!weeks[w]) weeks[w] = { total: 0, dailyOver: 0 };
        weeks[w].total += worked;
        weeks[w].dailyOver += dOver;
      }
      for (const k in weeks) {
        const over = Math.max(0, (weeks[k].total || 0) - 2400);
        weeklyAdditional += Math.max(0, over - (weeks[k].dailyOver || 0));
      }
      return Math.max(0, dailyOverTotal + weeklyAdditional);
    })();

  let plannedDays = working;
  let attendDays2 = attendDays;
  let holidayWorkDays2 = holidayWorkDays;
  let absent2 = absentDays;
  let onsiteDays2 = counts.onsite;
  let remoteDays2 = counts.remote;
  let satelliteDays2 = counts.satellite;
  let usedFrontend = false;

  try {
    if (scope.length > 0) {
      usedFrontend = true;
      let frontendTotalWork = 0;
      let frontendOvertime = 0;
      let frontendAttendDays = 0;
      let frontendHolidayWorkDays = 0;
      let frontendOnsite = 0;
      let frontendRemote = 0;
      let frontendSatellite = 0;
      let explicitAbsent = 0;

      for (const d of scope) {
        const row = computeRowDisplay(d);
        if (row.workMin > 0 && !row.workIsAuto) frontendTotalWork += row.workMin;
        if (row.overtimeMin > 0 && !row.overtimeIsAuto) frontendOvertime += row.overtimeMin;
        if (row.kubunVal === '欠勤') explicitAbsent += 1;
        if (!row.kubunVal) continue;
        if (row.kubunVal === '休日出勤') frontendHolidayWorkDays += 1;
        else if (row.kubunVal === '出勤' || row.kubunVal === '半休' || row.kubunVal === '代替出勤') frontendAttendDays += 1;
        else continue;
        if (row.workType === 'onsite') frontendOnsite += 1;
        else if (row.workType === 'remote') frontendRemote += 1;
        else if (row.workType === 'satellite') frontendSatellite += 1;
      }

      totalWorkMinutes = frontendTotalWork;
      totals.overtime = frontendOvertime;
      legalOvertimeMinutes = frontendOvertime;
      attendDays2 = frontendAttendDays;
      holidayWorkDays2 = frontendHolidayWorkDays;
      absent2 = explicitAbsent > 0 ? explicitAbsent : 0;
      onsiteDays2 = frontendOnsite;
      remoteDays2 = frontendRemote;
      satelliteDays2 = frontendSatellite;
    }
  } catch {}

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
    deductionMinutes = Number(stored.deductionMinutes == null ? deductionMinutes : stored.deductionMinutes) || 0;
    if (!usedFrontend) {
      absent2 = Number(stored.absentDays == null ? absent2 : stored.absentDays) || 0;
      if (mode === 'sumAll') {
        onsiteDays2 = Number(stored.onsiteDays == null ? onsiteDays2 : stored.onsiteDays) || 0;
        remoteDays2 = Number(stored.remoteDays == null ? remoteDays2 : stored.remoteDays) || 0;
        satelliteDays2 = Number(stored.satelliteDays == null ? satelliteDays2 : stored.satelliteDays) || 0;
      }
    }
  }

  const res = {
    plannedDays,
    attendDays: attendDays2,
    holidayWorkDays: holidayWorkDays2,
    standbyDays,
    totalWorkMinutes,
    nightMinutes: Number(totals.night || 0),
    overtimeMinutes: Number(totals.overtime || 0),
    legalOvertimeMinutes,
    paidDays,
    substituteDays,
    unpaidDays,
    absentDays: absent2
  };
  if (mode === 'sumAll') {
    return {
      ...res,
      deductionMinutes,
      onsiteDays: onsiteDays2,
      remoteDays: remoteDays2,
      satelliteDays: satelliteDays2
    };
  }
  return res;
}

function numText(s) {
  const t = String(s || '').replace(/日/g, '').trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function exactSummaryFromMonthly(detail, timesheet, mode) {
  try {
    const monthly = globalThis.AttendanceMonthly || {};
    const renderTable = monthly?.Render?.renderTable;
    const renderSummary = monthly?.SectionsRender?.renderSummary;
    if (typeof renderTable !== 'function' || typeof renderSummary !== 'function') return null;
    if (!document.body) return null;
    monthly.State = monthly.State || {};
    monthly.State.editableMonth = false;
    monthly.State.currentMonthStatus = String(detail?.monthStatus?.status || '').trim();

    const shell = document.createElement('div');
    shell.style.cssText = 'position:absolute;left:-99999px;top:0;width:1600px;height:1px;overflow:hidden;';
    shell.innerHTML = `
      <div id="summarySection">
        <button class="se-tab active" data-tab="${mode === 'sumAll' ? 'sumAll' : 'sumInhouse'}"></button>
      </div>
      <div id="monthTable"></div>
      <div id="summaryHost"></div>
    `;
    document.body.appendChild(shell);
    const tableHost = shell.querySelector('#monthTable');
    const summaryHost = shell.querySelector('#summaryHost');
    renderTable(tableHost, detail, { role: 'employee' });
    renderSummary(summaryHost, detail, timesheet);
    const cells = Array.from(summaryHost.querySelectorAll('tbody td')).map(td => String(td.textContent || '').trim());
    shell.remove();
    if (!cells.length) return null;
    if (mode === 'sumAll' && cells.length >= 17) {
      return {
        plannedDays: numText(cells[0]),
        attendDays: numText(cells[1]),
        holidayWorkDays: numText(cells[2]),
        standbyDays: numText(cells[3]),
        totalWorkMinutes: hmToMin(cells[4]) || 0,
        nightMinutes: hmToMin(cells[5]) || 0,
        overtimeMinutes: hmToMin(cells[6]) || 0,
        legalOvertimeMinutes: hmToMin(cells[7]) || 0,
        paidDays: parseFloat(String(cells[8]).replace(/日/g, '')) || 0,
        substituteDays: numText(cells[10]),
        unpaidDays: numText(cells[11]),
        absentDays: numText(cells[12]),
        deductionMinutes: hmToMin(cells[13]) || 0,
        onsiteDays: numText(cells[14]),
        remoteDays: numText(cells[15]),
        satelliteDays: numText(cells[16])
      };
    }
    if (mode !== 'sumAll' && cells.length >= 12) {
      return {
        plannedDays: numText(cells[0]),
        attendDays: numText(cells[1]),
        holidayWorkDays: numText(cells[2]),
        standbyDays: numText(cells[3]),
        totalWorkMinutes: hmToMin(cells[4]) || 0,
        nightMinutes: hmToMin(cells[5]) || 0,
        overtimeMinutes: hmToMin(cells[6]) || 0,
        legalOvertimeMinutes: hmToMin(cells[7]) || 0,
        paidDays: parseFloat(String(cells[8]).replace(/日/g, '')) || 0,
        substituteDays: numText(cells[9]),
        unpaidDays: numText(cells[10]),
        absentDays: numText(cells[11])
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function ensureMonthlyLibsReady(timeoutMs = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const monthly = globalThis.AttendanceMonthly || {};
    if (typeof monthly?.Render?.renderTable === 'function' && typeof monthly?.SectionsRender?.renderSummary === 'function') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

async function exactSummaryFromEmbed(uid, ym, mode) {
  try {
    const userId = String(uid || '').trim();
    const month = String(ym || '').trim();
    if (!/^\d+$/.test(userId) || !/^\d{4}-\d{2}$/.test(month)) return null;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-99999px;top:0;width:1600px;height:900px;opacity:0;pointer-events:none;';
    iframe.src = `/admin/embed/attendance/monthly?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}&embed=1`;
    document.body.appendChild(iframe);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('iframe timeout')), 12000);
      iframe.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      iframe.addEventListener('error', () => { clearTimeout(timer); reject(new Error('iframe load error')); }, { once: true });
    });
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return null;
    }
    const waitForSummary = async () => {
      const start = Date.now();
      while (Date.now() - start < 12000) {
        const table = doc.querySelector('#monthSummaryTable table, #monthSummary table, #monthSummaryTable, #monthSummary');
        const cells = table ? Array.from(table.querySelectorAll('tbody td')) : [];
        if (cells.length >= 12) return true;
        await new Promise((r) => setTimeout(r, 100));
      }
      return false;
    };
    if (!(await waitForSummary())) {
      iframe.remove();
      return null;
    }
    if (mode !== 'sumAll') {
      const tab = doc.querySelector('#summarySection .se-tab[data-tab="sumInhouse"]');
      if (tab) {
        tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: iframe.contentWindow }));
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    const table = doc.querySelector('#monthSummaryTable table, #monthSummary table, #monthSummaryTable, #monthSummary');
    const cells = table ? Array.from(table.querySelectorAll('tbody td')).map(td => String(td.textContent || '').trim()) : [];
    iframe.remove();
    if (mode === 'sumAll' && cells.length >= 17) {
      return {
        plannedDays: numText(cells[0]),
        attendDays: numText(cells[1]),
        holidayWorkDays: numText(cells[2]),
        standbyDays: numText(cells[3]),
        totalWorkMinutes: hmToMin(cells[4]) || 0,
        nightMinutes: hmToMin(cells[5]) || 0,
        overtimeMinutes: hmToMin(cells[6]) || 0,
        legalOvertimeMinutes: hmToMin(cells[7]) || 0,
        paidDays: parseFloat(String(cells[8]).replace(/日/g, '')) || 0,
        substituteDays: numText(cells[10]),
        unpaidDays: numText(cells[11]),
        absentDays: numText(cells[12]),
        deductionMinutes: hmToMin(cells[13]) || 0,
        onsiteDays: numText(cells[14]),
        remoteDays: numText(cells[15]),
        satelliteDays: numText(cells[16])
      };
    }
    if (mode !== 'sumAll' && cells.length >= 12) {
      return {
        plannedDays: numText(cells[0]),
        attendDays: numText(cells[1]),
        holidayWorkDays: numText(cells[2]),
        standbyDays: numText(cells[3]),
        totalWorkMinutes: hmToMin(cells[4]) || 0,
        nightMinutes: hmToMin(cells[5]) || 0,
        overtimeMinutes: hmToMin(cells[6]) || 0,
        legalOvertimeMinutes: hmToMin(cells[7]) || 0,
        paidDays: parseFloat(String(cells[8]).replace(/日/g, '')) || 0,
        substituteDays: numText(cells[9]),
        unpaidDays: numText(cells[10]),
        absentDays: numText(cells[11])
      };
    }
    return null;
  } catch {
    try { document.querySelectorAll('iframe').forEach((f) => { if ((f.src || '').includes('/admin/embed/attendance/monthly')) f.remove(); }); } catch {}
    return null;
  }
}

function renderSummaryField(prefix, field) {
  const typeAttr = field.type ? ` type="${field.type}"` : '';
  const stepAttr = field.step != null ? ` step="${field.step}"` : '';
  const placeholderAttr = field.placeholder ? ` placeholder="${field.placeholder}"` : '';
  return `
    <label class="admin-ms-field">
      <span class="admin-ms-field-label">${field.label}</span>
      <input id="${prefix}${field.id}" class="admin-ms-input"${typeAttr}${stepAttr}${placeholderAttr}>
    </label>
  `;
}

function renderSummarySection(title, prefix, fields) {
  return `
    <section class="admin-ms-section">
      <div class="admin-ms-section-head">
        <h3>${title}</h3>
      </div>
      <div class="admin-ms-grid">
        ${fields.map((field) => renderSummaryField(prefix, field)).join('')}
      </div>
    </section>
  `;
}

function renderScaffold(root) {
  const allFields = [
    { id: 'PlannedDays', label: '所定日数', type: 'number', step: '1' },
    { id: 'AttendDays', label: '出勤日数', type: 'number', step: '1' },
    { id: 'HolidayWorkDays', label: '代出休出', type: 'number', step: '1' },
    { id: 'StandbyDays', label: '待機日数', type: 'number', step: '1' },
    { id: 'TotalWork', label: '総労働時間', placeholder: '0:00' },
    { id: 'Night', label: '深夜時間', placeholder: '0:00' },
    { id: 'Overtime', label: '総残業時間', placeholder: '0:00' },
    { id: 'LegalOvertime', label: '法定外時間', placeholder: '0:00' },
    { id: 'PaidDays', label: '有休日数', type: 'number', step: '0.1' },
    { id: 'SubstituteDays', label: '代休日数', type: 'number', step: '1' },
    { id: 'UnpaidDays', label: '無給休暇', type: 'number', step: '1' },
    { id: 'AbsentDays', label: '欠勤日数', type: 'number', step: '1' },
    { id: 'Deduction', label: '控除時間', placeholder: '0:00' },
    { id: 'OnsiteDays', label: '出社日数', type: 'number', step: '1' },
    { id: 'RemoteDays', label: '在宅日数', type: 'number', step: '1' },
    { id: 'SatelliteDays', label: '現場・出張', type: 'number', step: '1' }
  ];
  const inhouseFields = [
    { id: 'PlannedDays', label: '所定日数', type: 'number', step: '1' },
    { id: 'AttendDays', label: '出勤日数', type: 'number', step: '1' },
    { id: 'HolidayWorkDays', label: '代出休出', type: 'number', step: '1' },
    { id: 'StandbyDays', label: '待機日数', type: 'number', step: '1' },
    { id: 'TotalWork', label: '総労働時間', placeholder: '0:00' },
    { id: 'Night', label: '深夜時間', placeholder: '0:00' },
    { id: 'Overtime', label: '総残業時間', placeholder: '0:00' },
    { id: 'LegalOvertime', label: '法定外時間', placeholder: '0:00' },
    { id: 'PaidDays', label: '有休日数', type: 'number', step: '0.1' },
    { id: 'SubstituteDays', label: '代休日数', type: 'number', step: '1' },
    { id: 'UnpaidDays', label: '無給休暇', type: 'number', step: '1' },
    { id: 'AbsentDays', label: '欠勤日数', type: 'number', step: '1' }
  ];
  root.innerHTML = `
    <div class="admin-ms-shell">
      <section class="admin-ms-toolbar">
        <label class="admin-ms-toolbar-field admin-ms-employee">
          <span class="admin-ms-toolbar-label">社員</span>
          <select id="msEmpSelect" class="admin-ms-select">
            <option value="">読み込み中…</option>
          </select>
        </label>
        <div class="admin-ms-toolbar-group">
          <label class="admin-ms-toolbar-field">
            <span class="admin-ms-toolbar-label">対象年月</span>
            <input id="sumMonth" type="month" class="admin-ms-input admin-ms-month">
          </label>
          <div class="admin-ms-actions">
            <button type="button" class="admin-ms-btn" id="btnSumLoad">読込</button>
            <button type="button" class="admin-ms-btn admin-ms-btn-primary" id="btnSumSave">保存</button>
          </div>
          <span id="sumStatus" class="admin-ms-status"></span>
        </div>
      </section>
      <section class="admin-ms-summary">
        <div class="admin-ms-summary-head">
          <h2>月次サマリ（管理者入力）</h2>
        </div>
        <div class="admin-ms-sections">
          ${renderSummarySection('全体', 'sumAll', allFields)}
          ${renderSummarySection('社内勤務', 'sumIh', inhouseFields)}
        </div>
      </section>
    </div>
  `;
}

function setSummaryValues(root, prefix, obj) {
  const x = obj && typeof obj === 'object' ? obj : {};
  const set = (id, val) => { const el = $(id, root); if (el) el.value = val; };
  set(`#${prefix}PlannedDays`, String(x.plannedDays == null ? '' : x.plannedDays));
  set(`#${prefix}AttendDays`, String(x.attendDays == null ? '' : x.attendDays));
  set(`#${prefix}HolidayWorkDays`, String(x.holidayWorkDays == null ? '' : x.holidayWorkDays));
  set(`#${prefix}StandbyDays`, String(x.standbyDays == null ? '' : x.standbyDays));
  set(`#${prefix}TotalWork`, minToHm(x.totalWorkMinutes == null ? 0 : x.totalWorkMinutes));
  set(`#${prefix}Night`, minToHm(x.nightMinutes == null ? 0 : x.nightMinutes));
  set(`#${prefix}Overtime`, minToHm(x.overtimeMinutes == null ? 0 : x.overtimeMinutes));
  set(`#${prefix}LegalOvertime`, minToHm(x.legalOvertimeMinutes == null ? 0 : x.legalOvertimeMinutes));
  set(`#${prefix}PaidDays`, String(x.paidDays == null ? '' : x.paidDays));
  set(`#${prefix}SubstituteDays`, String(x.substituteDays == null ? '' : x.substituteDays));
  set(`#${prefix}UnpaidDays`, String(x.unpaidDays == null ? '' : x.unpaidDays));
  set(`#${prefix}AbsentDays`, String(x.absentDays == null ? '' : x.absentDays));
  if (prefix === 'sumAll') {
    set('#sumAllDeduction', minToHm(x.deductionMinutes == null ? 0 : x.deductionMinutes));
    set('#sumAllOnsiteDays', String(x.onsiteDays == null ? '' : x.onsiteDays));
    set('#sumAllRemoteDays', String(x.remoteDays == null ? '' : x.remoteDays));
    set('#sumAllSatelliteDays', String(x.satelliteDays == null ? '' : x.satelliteDays));
  }
}

function getSummaryValues(root, prefix) {
  const val = (id) => $(id, root)?.value || '';
  const totalWorkMinutes = hmToMin(val(`#${prefix}TotalWork`));
  const nightMinutes = hmToMin(val(`#${prefix}Night`));
  const overtimeMinutes = hmToMin(val(`#${prefix}Overtime`));
  const legalOvertimeMinutes = hmToMin(val(`#${prefix}LegalOvertime`));
  if (totalWorkMinutes == null || nightMinutes == null || overtimeMinutes == null || legalOvertimeMinutes == null) return null;
  const base = {
    plannedDays: num(val(`#${prefix}PlannedDays`)),
    attendDays: num(val(`#${prefix}AttendDays`)),
    holidayWorkDays: num(val(`#${prefix}HolidayWorkDays`)),
    standbyDays: num(val(`#${prefix}StandbyDays`)),
    totalWorkMinutes,
    nightMinutes,
    overtimeMinutes,
    legalOvertimeMinutes,
    paidDays: num(val(`#${prefix}PaidDays`)),
    substituteDays: num(val(`#${prefix}SubstituteDays`)),
    unpaidDays: num(val(`#${prefix}UnpaidDays`)),
    absentDays: num(val(`#${prefix}AbsentDays`))
  };
  if (prefix === 'sumAll') {
    const deductionMinutes = hmToMin(val('#sumAllDeduction'));
    if (deductionMinutes == null) return null;
    return {
      ...base,
      deductionMinutes,
      onsiteDays: num(val('#sumAllOnsiteDays')),
      remoteDays: num(val('#sumAllRemoteDays')),
      satelliteDays: num(val('#sumAllSatelliteDays'))
    };
  }
  return base;
}

export async function mount() {
  const root = document.querySelector('#adminContent');
  if (!root) return;
  try { wireAdminShell({ logoutRedirect: '/ui/login' }); } catch {}
  try { wireTopbarMenus(); } catch {}
  try { delete root.dataset.monthlySummaryMounted; } catch {}
  try {
    const status = document.querySelector('#status');
    if (status) {
      status.textContent = '';
      status.style.display = 'none';
    }
  } catch {}
  renderScaffold(root);

  const empSelect = $('#msEmpSelect', root);
  const monthEl = $('#sumMonth', root);
  const statusEl = $('#sumStatus', root);
  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ''; };
  if (monthEl && !monthEl.value) monthEl.value = currentMonthJST();

  const users = await fetchEmployees().catch(() => []);
  const qUserId = new URL(window.location.href).searchParams.get('userId') || '';
  if (empSelect) {
    if (!users.length) {
      empSelect.innerHTML = `<option value="">社員が見つかりません</option>`;
      empSelect.disabled = true;
    } else {
      empSelect.disabled = false;
      empSelect.innerHTML = users.map((u) => {
        const selected = String(u.id) === String(qUserId || users[0]?.id || '') ? ' selected' : '';
        return `<option value="${u.id}"${selected}>${nameOf(u)}（${codeOf(u)}）</option>`;
      }).join('');
    }
  }

  const load = async () => {
    const ym = String(monthEl?.value || '').trim();
    const uid = String(empSelect?.value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym) || !uid) return;
    const y = parseInt(ym.slice(0, 4), 10);
    const m = parseInt(ym.slice(5, 7), 10);
    setStatus('読込中...');
    const bust = `&_=${Date.now()}`;
    const [detail, timesheet] = await Promise.all([
      fetchJSONAuth(`/api/attendance/month/detail?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(uid)}${bust}`),
      fetchJSONAuth(`/api/attendance/month?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(uid)}${bust}`).catch(() => null)
    ]);
    // Fast path: compute directly from API payload to avoid long iframe-based extraction.
    setSummaryValues(root, 'sumAll', computeSummary(detail, timesheet, 'sumAll'));
    setSummaryValues(root, 'sumIh', computeSummary(detail, timesheet, 'sumIh'));
    setStatus('読込完了');
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('userId', uid);
      u.searchParams.set('month', ym);
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {}
  };

  const save = async () => {
    const ym = String(monthEl?.value || '').trim();
    const uid = String(empSelect?.value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(ym) || !uid) return;
    const all = getSummaryValues(root, 'sumAll');
    const inhouse = getSummaryValues(root, 'sumIh');
    if (!all || !inhouse) {
      setStatus('時間はH:MMで入力してください');
      return;
    }
    const y = parseInt(ym.slice(0, 4), 10);
    const m = parseInt(ym.slice(5, 7), 10);
    setStatus('保存中...');
    await fetchJSONAuth(`/api/attendance/month/summary?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}&userId=${encodeURIComponent(uid)}`, {
      method: 'PUT',
      body: JSON.stringify({ year: y, month: m, userId: uid, all, inhouse })
    });
    setStatus('保存しました');
  };

  $('#btnSumLoad', root)?.addEventListener('click', () => { load().catch(e => setStatus(String(e?.message || '読込失敗'))); });
  $('#btnSumSave', root)?.addEventListener('click', () => { save().catch(e => setStatus(String(e?.message || '保存失敗'))); });
  empSelect?.addEventListener('change', () => { load().catch(e => setStatus(String(e?.message || '読込失敗'))); });
  monthEl?.addEventListener('change', () => { load().catch(e => setStatus(String(e?.message || '読込失敗'))); });
  await load().catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
  await mount();
});
