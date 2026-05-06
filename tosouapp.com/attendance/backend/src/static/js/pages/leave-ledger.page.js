import { myPaidBalance, listMyRequests } from '../api/leave.api.js';
import { me } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function fmtDate(d) {
  if (!d) return '-';
  return String(d);
}

function ymd(dt) {
  return dt.toISOString().slice(0, 10);
}

function enumerateDates(startDate, endDate) {
  const out = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cur <= end) {
    out.push(ymd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

async function renderEmpInfo() {
  try {
    const token = sessionStorage.getItem('accessToken') || '';
    const u = await me(token);
    $('#empCode').textContent = `${u.employeeCode || u.id}`;
    $('#empName').textContent = `${u.username || u.email || ''}`;
  } catch {
    $('#empCode').textContent = '';
    $('#empName').textContent = '';
  }
}

async function renderLedger() {
  try {
    const balance = await myPaidBalance();
    const grants = balance.grants || [];
    const years = Array.from(new Set(grants.map(g => new Date(g.grantDate).getFullYear()))).sort((a,b)=>b-a);
    const currentYear = (years[0] || new Date().getFullYear());
    const section = document.createElement('section');
    section.className = 'se-section';
    const headWrap = document.createElement('div');
    headWrap.className = 'se-section-head se-summary-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'se-daily-title';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'se-daily-switch';
    toggle.id = 'ledgerToggle';
    toggle.setAttribute('aria-label', '休暇欠勤台帳を折りたたむ');
    toggle.setAttribute('aria-pressed', 'false');
    const titleText = document.createElement('span');
    titleText.className = 'se-daily-text';
    titleText.textContent = '休暇欠勤台帳';
    titleWrap.appendChild(toggle);
    titleWrap.appendChild(titleText);
    const select = document.createElement('select');
    select.id = 'targetYear';
    select.style.margin = '0 8px';
    select.className = 'se-toolbar-select';
    // Options: pre-grant/migration, previous years, current year
    const yearOptions = [currentYear, currentYear-1, currentYear-2].filter((v,i,self)=>self.indexOf(v)===i);
    const pre = document.createElement('option');
    pre.value = 'pre';
    pre.textContent = '付与前・移行前';
    select.appendChild(pre);
    for (const y of yearOptions) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = `${y}年度`;
      select.appendChild(opt);
    }
    const headRight = document.createElement('div');
    headRight.className = 'se-toolbar-field';
    const yearLabel = document.createElement('span');
    yearLabel.className = 'se-toolbar-label';
    yearLabel.textContent = '対象年度';
    yearLabel.setAttribute('for', 'targetYear');
    headRight.appendChild(yearLabel);
    headRight.appendChild(select);
    headWrap.appendChild(titleWrap);
    headWrap.appendChild(headRight);
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'se-section-body';
    const tableContainer = document.createElement('div');
    tableContainer.id = 'ledgerSummaryTable';
    tableContainer.className = 'se-summary';
    bodyWrap.appendChild(tableContainer);
    section.appendChild(headWrap);
    section.appendChild(bodyWrap);
    const mount = document.querySelector('.layout-contents') || document.querySelector('.kintai-main');
    mount.insertBefore(section, mount.querySelector('.se-employee-bar').nextSibling);
    function buildTable(headers, values) {
      const tbl = document.createElement('table');
      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
      thead.appendChild(trh);
      const tbody = document.createElement('tbody');
      const trv = document.createElement('tr');
      values.forEach(v => { const td = document.createElement('td'); td.textContent = v; trv.appendChild(td); });
      tbody.appendChild(trv);
      tbl.appendChild(thead);
      tbl.appendChild(tbody);
      return tbl;
    }
    function daysBetween(a,b) {
      const d1 = new Date(a+'T00:00:00Z'); const d2 = new Date(b+'T00:00:00Z');
      return Math.max(0, Math.floor((d2 - d1)/(24*60*60*1000)) + 1);
    }
  function fmtNum(n) { return Number(n || 0).toFixed(1); }
    async function renderYear(y) {
      tableContainer.innerHTML = '';
      const isPre = (String(y) === 'pre' || Number.isNaN(Number(y)));
      const jan1 = isPre ? '' : `${y}-01-01`;
      const dec31 = isPre ? '' : `${y}-12-31`;
      const grantInYear = grants.find(g => new Date(g.grantDate).getFullYear() === y) || null;
      const grantDate = grantInYear ? grantInYear.grantDate : '-';
      const periodStart = isPre ? '-' : (grantInYear ? grantInYear.grantDate : jan1);
      const periodEnd = grantInYear ? new Date(grantInYear.grantDate) : new Date(jan1);
      if (!isPre && grantInYear) {
        periodEnd.setFullYear(periodEnd.getFullYear()+1);
        periodEnd.setDate(periodEnd.getDate()-1);
      } else if (!isPre) {
        periodEnd.setFullYear(y);
        periodEnd.setMonth(11);
        periodEnd.setDate(31);
      }
      const periodEndStr = isPre ? '-' : periodEnd.toISOString().slice(0,10);
      const currentRemain = Number(balance.totalAvailable || 0).toFixed(1);
      const topHeaders = ['対象年度','対象年度付与日','対象期間','現在の有休残日数'];
      const topValues = [isPre ? '付与前・移行前' : `${y}年度`, fmtDate(grantDate), isPre ? '-' : `${periodStart} 〜 ${periodEndStr}`, currentRemain];
      // second row metrics
      const reqs = isPre ? [] : await listMyRequests();
      const approvedReqs = (reqs || []).filter(r => r.status === 'approved' && r.endDate >= jan1 && r.startDate <= dec31);
      const paidReqs = approvedReqs.filter(r => r.type === 'paid');
      const usedDays = isPre ? 0 : paidReqs.reduce((s,r)=> s + daysBetween(r.startDate, r.endDate), 0);
      const yearGranted = isPre ? 0 : grants.filter(g => new Date(g.grantDate).getFullYear() === y).reduce((s,g)=>s+Number(g.daysGranted||0),0);
      const carryPrev = isPre ? 0 : grants
        .filter(g => new Date(g.grantDate).getFullYear() < y && new Date(g.expiryDate) >= new Date(jan1))
        .reduce((s,g)=> s + Number(g.daysRemaining||0), 0);
      const yearGrantEntries = isPre ? [] : grants.filter(g => new Date(g.grantDate).getFullYear() === y);
      const yearRemaining = isPre ? 0 : yearGrantEntries.reduce((s,g)=> s + Number(g.daysRemaining || 0), 0);
      const extinctAtYearEnd = isPre ? 0 : grants
        .filter(g => new Date(g.expiryDate).getFullYear() === y)
        .reduce((s,g)=> s + Math.max(0, Number(g.daysRemaining || 0)), 0);
      const bottomHeaders = ['前年繰越有休日数','対象年度有休付与日数','有休取得日数','休日調整充当日数','対象有休残日数','欠勤日数','無給休暇日数','年度末有休消滅数'];
      const yearGrantedDisplay = isPre ? `${fmtNum(yearGranted)}(付与前)` : fmtNum(yearGranted);
      const bottomValues = [fmtNum(carryPrev), yearGrantedDisplay, fmtNum(usedDays), '0', fmtNum(yearRemaining), '0', '0', fmtNum(extinctAtYearEnd)];
      const topTbl = buildTable(topHeaders, topValues);
      const bottomTbl = buildTable(bottomHeaders, bottomValues);
      bottomTbl.classList.add('metrics-table');
      tableContainer.appendChild(topTbl);
      const spacer = document.createElement('div'); spacer.style.height = '6px'; tableContainer.appendChild(spacer);
      tableContainer.appendChild(bottomTbl);

      // Daily usage list in the same structure as the sample: 有休 / 欠勤
      const usedWrap = document.createElement('div');
      usedWrap.style.marginTop = '10px';
      usedWrap.style.display = 'grid';
      usedWrap.style.gap = '10px';
      usedWrap.style.maxWidth = '520px';

      const dayRows = [];
      if (!isPre) {
        for (const r of approvedReqs) {
          const s = String(r.startDate) < jan1 ? jan1 : String(r.startDate);
          const e = String(r.endDate) > dec31 ? dec31 : String(r.endDate);
          for (const d of enumerateDates(s, e)) {
            dayRows.push({
              date: d,
              type: String(r.type || '').toLowerCase(),
              reason: String(r.reason || '')
            });
          }
        }
      }
      dayRows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const paidRows = dayRows.filter((r) => r.type === 'paid');
      const absentRows = dayRows.filter((r) => r.type !== 'paid');

      function buildSectionTitle(txt) {
        const t = document.createElement('div');
        t.textContent = txt;
        t.style.fontWeight = '700';
        t.style.fontSize = '14px';
        t.style.margin = '0';
        return t;
      }

      function buildSimpleTable(headers, rows) {
        const tbl = document.createElement('table');
        tbl.style.width = '100%';
        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (const h of headers) {
          const th = document.createElement('th');
          th.textContent = h;
          trh.appendChild(th);
        }
        thead.appendChild(trh);
        tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (const cols of rows) {
          const tr = document.createElement('tr');
          for (const c of cols) {
            const td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        tbl.appendChild(tbody);
        return tbl;
      }

      if (paidRows.length > 0) {
        const paidTitle = buildSectionTitle('● 有休');
        const paidTable = buildSimpleTable(
          ['取得年月日', '全休/半休', '区分'],
          paidRows.map((r) => [r.date, '全休', '有給休暇'])
        );
        usedWrap.appendChild(paidTitle);
        usedWrap.appendChild(paidTable);
      }

      if (absentRows.length > 0) {
        const absentTitle = buildSectionTitle('● 欠勤');
        const absentTable = buildSimpleTable(
          ['取得年月日', '出勤区分', '事由'],
          absentRows.map((r) => [r.date, r.type === 'unpaid' ? '無給休暇' : '欠勤', r.reason || ''])
        );
        usedWrap.appendChild(absentTitle);
        usedWrap.appendChild(absentTable);
      }

      if (paidRows.length > 0 || absentRows.length > 0) {
        tableContainer.appendChild(usedWrap);
      }
    }
    await renderYear(currentYear);
    select.addEventListener('change', () => {
      const val = select.value;
      if (val === 'pre') renderYear('pre'); else renderYear(parseInt(val,10));
    });
    toggle.addEventListener('click', () => {
      const isCollapsed = section.classList.contains('collapsed');
      const nextCollapsed = !isCollapsed;
      section.classList.toggle('collapsed', nextCollapsed);
      toggle.setAttribute('aria-pressed', String(nextCollapsed));
    });

    // Explanation section
    const explain = document.createElement('section');
    explain.className = 'se-section';
    const expHead = document.createElement('div');
    expHead.className = 'se-section-head se-summary-head';
    const expTitleWrap = document.createElement('div');
    expTitleWrap.className = 'se-daily-title';
    const expToggle = document.createElement('button');
    expToggle.type = 'button';
    expToggle.className = 'se-daily-switch';
    expToggle.id = 'explainToggle';
    expToggle.setAttribute('aria-label', '項目説明を折りたたむ');
    expToggle.setAttribute('aria-pressed', 'false');
    const expTitleText = document.createElement('span');
    expTitleText.className = 'se-daily-text';
    expTitleText.textContent = '項目説明';
    expTitleWrap.appendChild(expToggle);
    expTitleWrap.appendChild(expTitleText);
    expHead.appendChild(expTitleWrap);
    const expBody = document.createElement('div');
    expBody.className = 'se-section-body';
    const expTableWrap = document.createElement('div');
    expTableWrap.id = 'ledgerExplainTable';
    expTableWrap.className = 'se-summary';
    expTableWrap.style.maxWidth = '980px';
    expTableWrap.style.width = '100%';
    expTableWrap.style.margin = '0';
    expTableWrap.style.overflowX = 'visible';
    const expTbl = buildTable(
      ['項目名','説明'],
      [] // placeholder; we will append rows manually
    );
    expTbl.style.width = '100%';
    expTbl.style.tableLayout = 'auto';
    expTbl.style.minWidth = '0';
    // Replace tbody contents with key-value rows
    const expItems = [
      ['対象期間','その年度における有休付与日から次回有休付与まで（有休付与がない年度の場合は入社日から次回有休付与まで）'],
      ['現在の有休残日数','現時点で取得可能な有休の残日数の目安'],
      ['前年繰越有休日数','前年から繰り越された有休残日数'],
      ['対象年度有休付与日数','対象年度に付与された有休日数'],
      ['有休取得日数','対象年度に取得した有休日数'],
      ['休日調整充当日数','休日調整に充当した日数'],
      ['対象有休残日数','対象年度分の有休残日数（前年繰越分と対象年度付与分の合計残日数）'],
      ['欠勤日数','対象年度の欠勤日数'],
      ['無給休暇日数','対象年度の無給休暇日数'],
      ['年度末有休消滅数','年度末までに消滅する有休の見込み数']
    ];
    const expThead = expTbl.querySelector('thead');
    if (expThead) expThead.style.display = 'none';
    const expTbody = expTbl.querySelector('tbody');
    expTbody.innerHTML = '';
    for (const [k, v] of expItems) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = k;
      const td2 = document.createElement('td'); td2.textContent = v;
      td1.style.width = '180px';
      td1.style.whiteSpace = 'nowrap';
      td2.style.whiteSpace = 'normal';
      td2.style.wordBreak = 'break-word';
      tr.appendChild(td1); tr.appendChild(td2);
      expTbody.appendChild(tr);
    }
    expTableWrap.appendChild(expTbl);
    expBody.appendChild(expTableWrap);
    explain.appendChild(expHead);
    explain.appendChild(expBody);
    mount.insertBefore(explain, section.nextSibling);
    expToggle.addEventListener('click', () => {
      const isCollapsed = explain.classList.contains('collapsed');
      const nextCollapsed = !isCollapsed;
      explain.classList.toggle('collapsed', nextCollapsed);
      expToggle.setAttribute('aria-pressed', String(nextCollapsed));
    });
  } catch (e) {
    const mount = document.querySelector('.layout-contents') || document.querySelector('.kintai-main');
    const err = document.createElement('div');
    err.textContent = '取得失敗: ' + (e?.message || 'error');
    err.style.color = '#b91c1c';
    mount.appendChild(err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderEmpInfo();
  await renderLedger();
});
