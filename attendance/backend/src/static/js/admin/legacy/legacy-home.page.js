import { api } from '../../shared/api/client.js';

export async function mountHome({ content }) {
  let stats = null;
  try {
    stats = await api.get('/api/admin/home/stats');
  } catch {
    stats = { todayCheckin: 0, lateCount: 0, leaveCount: 0, pendingCount: 0 };
  }

  content.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'dashboard';

  const head = document.createElement('div');
  head.className = 'dashboard-head';
  const title = document.createElement('h3');
  title.textContent = 'Admin Dashboard';
  head.appendChild(title);
  wrap.appendChild(head);

  const kpi = document.createElement('div');
  kpi.className = 'kpi-grid';
  const makeKpi = (t, v, s) => {
    const c = document.createElement('div');
    c.className = 'kpi-card';
    const tt = document.createElement('div');
    tt.className = 'kpi-title';
    tt.textContent = t;
    const vv = document.createElement('div');
    vv.className = 'kpi-value';
    vv.textContent = String(v);
    const ss = document.createElement('div');
    ss.className = 'kpi-sub';
    ss.textContent = s;
    c.appendChild(tt);
    c.appendChild(vv);
    c.appendChild(ss);
    return c;
  };
  kpi.appendChild(makeKpi('Today Work', stats.todayCheckin, '出勤人数'));
  kpi.appendChild(makeKpi('Late', stats.lateCount, '遅刻人数'));
  kpi.appendChild(makeKpi('Leave', stats.leaveCount, '休暇人数'));
  kpi.appendChild(makeKpi('Pending', stats.pendingCount, '未承認申請'));
  wrap.appendChild(kpi);

  const grid = document.createElement('div');
  grid.className = 'dash-grid';
  const chartCard = document.createElement('div');
  chartCard.className = 'dash-card';
  const chartTitle = document.createElement('div');
  chartTitle.className = 'dash-card-title';
  chartTitle.textContent = 'Attendance Chart';
  chartCard.appendChild(chartTitle);
  const chart = document.createElement('div');
  chart.className = 'dash-chart';
  const vals = [stats.todayCheckin, stats.lateCount, stats.leaveCount, stats.pendingCount].map(v => Math.max(0, Number(v) || 0));
  const max = Math.max(1, ...vals);
  for (const v of vals) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.setProperty('--h', `${Math.max(10, Math.round((v / max) * 100))}%`);
    chart.appendChild(bar);
  }
  chartCard.appendChild(chart);
  grid.appendChild(chartCard);

  const recentCard = document.createElement('div');
  recentCard.className = 'dash-card';
  const recentTitle = document.createElement('div');
  recentTitle.className = 'dash-card-title';
  recentTitle.textContent = 'Recent Requests';
  recentCard.appendChild(recentTitle);
  const table = document.createElement('table');
  table.className = 'dash-table';
  table.innerHTML = '<thead><tr><th>User</th><th>Type</th><th>Status</th></tr></thead>';
  const tbody = document.createElement('tbody');
  let rows = [];
  try { rows = await api.get('/api/leave/pending'); } catch { rows = []; }
  for (const r of (Array.isArray(rows) ? rows.slice(0, 6) : [])) {
    const tr = document.createElement('tr');
    const tdU = document.createElement('td');
    tdU.textContent = String(r.userId == null ? '' : r.userId);
    const tdT = document.createElement('td');
    tdT.textContent = String(r.type == null ? '' : r.type);
    const tdS = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'dash-pill';
    pill.textContent = String(r.status == null ? '' : r.status);
    tdS.appendChild(pill);
    tr.appendChild(tdU);
    tr.appendChild(tdT);
    tr.appendChild(tdS);
    tbody.appendChild(tr);
  }
  if (!tbody.children.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'No pending requests';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  recentCard.appendChild(table);
  grid.appendChild(recentCard);
  wrap.appendChild(grid);

  content.appendChild(wrap);
}
