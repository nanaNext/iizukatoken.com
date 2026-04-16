import { myPaidBalance, listMyRequests } from '../api/leave.api.js';
import { me } from '../api/auth.api.js';

const $ = (sel) => document.querySelector(sel);

function fmtDate(d) {
  if (!d) return '-';
  return String(d);
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
      const paidReqs = (reqs || []).filter(r => r.type === 'paid' && r.status === 'approved' && r.endDate >= jan1 && r.startDate <= dec31);
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
    const expTbl = buildTable(
      ['項目名','説明'],
      [] // placeholder; we will append rows manually
    );
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
    const expTbody = expTbl.querySelector('tbody');
    expTbody.innerHTML = '';
    for (const [k, v] of expItems) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = k;
      const td2 = document.createElement('td'); td2.textContent = v;
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
