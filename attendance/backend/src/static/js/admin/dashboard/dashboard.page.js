import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

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

const fmtInt = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '0';
  return String(Math.trunc(n));
};

const makeKpi = (title, value, sub) => {
  const c = document.createElement('div');
  c.className = 'kpi-card';
  const t = document.createElement('div');
  t.className = 'kpi-title';
  t.textContent = title;
  const v = document.createElement('div');
  v.className = 'kpi-value';
  v.textContent = value;
  const s = document.createElement('div');
  s.className = 'kpi-sub';
  s.textContent = sub;
  c.appendChild(t);
  c.appendChild(v);
  c.appendChild(s);
  return c;
};

const renderDashboard = async (profile) => {
  const content = $('#adminContent');
  if (!content) return;
  content.className = 'card';
  content.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'dashboard';

  const head = document.createElement('div');
  head.className = 'dashboard-head';
  const title = document.createElement('h3');
  title.textContent = 'ホーム';
  head.appendChild(title);
  wrap.appendChild(head);

  showSpinner();
  const [statsRes, usersRes, pendingLeaveRes, pendingProfileRes, workReportsRes] = await Promise.allSettled([
    fetchJSONAuth('/api/admin/home/stats'),
    fetchJSONAuth('/api/admin/users'),
    fetchJSONAuth('/api/leave/pending'),
    fetchJSONAuth('/api/manager/profile-change/pending'),
    fetchJSONAuth('/api/admin/work-reports')
  ]);
  hideSpinner();

  const stats = statsRes.status === 'fulfilled' && statsRes.value ? statsRes.value : { todayCheckin: 0, lateCount: 0, leaveCount: 0, pendingCount: 0 };
  const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
  const pendingLeave = pendingLeaveRes.status === 'fulfilled' && Array.isArray(pendingLeaveRes.value) ? pendingLeaveRes.value : [];
  const pendingProfile = pendingProfileRes.status === 'fulfilled' && Array.isArray(pendingProfileRes.value) ? pendingProfileRes.value : [];
  const workReports = workReportsRes.status === 'fulfilled' && workReportsRes.value ? workReportsRes.value : null;

  const kpi = document.createElement('div');
  kpi.className = 'kpi-grid';
  const make = (cls, t, v, sub, delta) => {
    const c = makeKpi(t, v, sub);
    c.classList.add(cls);
    if (typeof delta === 'number') {
      const d = document.createElement('div');
      d.className = 'kpi-delta ' + (delta >= 0 ? 'pos' : 'neg');
      d.textContent = (delta >= 0 ? '▲' : '▼') + Math.abs(delta).toFixed(0) + '%';
      c.appendChild(d);
    }
    return c;
  };
  // deltas: backend may not provide -> only show when available
  const deltas = stats && typeof stats === 'object' ? {
    users: stats.usersDelta == null ? null : stats.usersDelta,
    work: stats.todayCheckinDelta == null ? null : stats.todayCheckinDelta,
    leave: stats.leaveDelta == null ? null : stats.leaveDelta,
    pending: stats.pendingDelta == null ? null : stats.pendingDelta
  } : {};
  const activeUsers = (users || []).filter(u => {
    const role = String((u && u.role) ? u.role : '').toLowerCase();
    const st = String((u && u.employment_status) ? u.employment_status : 'active').toLowerCase();
    if (st === 'inactive' || st === 'retired') return false;
    return role === 'employee' || role === 'manager' || role === 'admin';
  });
  const usersCard = make('kpi-users', 'ユーザー', fmtInt(activeUsers.length), 'Users', deltas.users == null ? null : deltas.users);
  usersCard.classList.add('clickable');
  usersCard.setAttribute('role', 'button');
  usersCard.setAttribute('tabindex', '0');
  usersCard.addEventListener('click', () => { window.location.href = '/admin/employees#list'; });
  usersCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = '/admin/employees#list';
    }
  });
  kpi.appendChild(usersCard);
  const workCard = make('kpi-work', '本日の出勤', fmtInt(stats.todayCheckin), 'Today work', deltas.work == null ? null : deltas.work);
  workCard.classList.add('clickable');
  workCard.setAttribute('role', 'button');
  workCard.setAttribute('tabindex', '0');
  workCard.addEventListener('click', () => { window.location.href = '/ui/today-work'; });
  workCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = '/ui/today-work';
    }
  });
  kpi.appendChild(workCard);
  kpi.appendChild(make('kpi-leave', '休暇', fmtInt(stats.leaveCount), 'Leave', deltas.leave == null ? null : deltas.leave));
  kpi.appendChild(make('kpi-pending', '未承認', fmtInt(stats.pendingCount), 'Pending', deltas.pending == null ? null : deltas.pending));
  wrap.appendChild(kpi);

  const grid = document.createElement('div');
  grid.className = 'dash-grid';

  const chartCard = document.createElement('div');
  chartCard.className = 'dash-card';
  const chartTitle = document.createElement('div');
  chartTitle.className = 'dash-card-title';
  chartTitle.textContent = 'Attendance Chart';
  chartCard.appendChild(chartTitle);
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.innerHTML = '<button data-range="day" class="active">Today</button><button data-range="week">This week</button><button data-range="month">This month</button>';
  chartCard.appendChild(seg);
  const chart = document.createElement('div');
  chart.className = 'dash-chart';
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  chart.appendChild(tooltip);
  const renderBars = (arr, labels) => {
    chart.querySelectorAll('.bar').forEach(b => b.remove());
    const vals = arr.map(v => Math.max(0, Number(v) || 0));
    const max = Math.max(1, ...vals);
    vals.forEach((v,i) => {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.setProperty('--h', `${Math.max(10, Math.round((v / max) * 100))}%`);
      bar.addEventListener('mousemove', (e) => {
        tooltip.style.display = 'block';
        tooltip.textContent = `${labels[i]}: ${fmtInt(arr[i])}`;
        const rect = chart.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left}px`;
        tooltip.style.top = `${e.clientY - rect.top}px`;
      });
      bar.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
      chart.appendChild(bar);
    });
  };
  const dayData = [stats.todayCheckin, stats.lateCount, stats.leaveCount, stats.pendingCount];
  renderBars(dayData, ['Work','Late','Leave','Pending']);
  const tryFetchSummary = async (range) => {
    // try several conventional endpoints; fallback if not available
    const candidates = [
      `/api/admin/attendance/summary?range=${range}`,
      `/api/admin/attendance/summary/${range}`
    ];
    for (const url of candidates) {
      try {
        const r = await fetchJSONAuth(url);
        if (r && Array.isArray(r.values)) return r;
      } catch {}
    }
    return null;
  };
  seg.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-range]');
    if (!btn) return;
    seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const range = btn.dataset.range;
    if (range === 'day') {
      renderBars(dayData, ['Work','Late','Leave','Pending']);
      return;
    }
    const res = await tryFetchSummary(range);
    if (res && Array.isArray(res.values) && res.labels) {
      renderBars(res.values, res.labels);
    } else {
      // graceful fallback: reuse day data
      renderBars(dayData, ['Work','Late','Leave','Pending']);
    }
  });
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

  const rows = [];
  for (const r of pendingLeave.slice(0, 6)) {
    rows.push({ user: r.userId == null ? '' : r.userId, type: r.type == null ? 'Leave' : r.type, status: r.status == null ? 'pending' : r.status });
  }
  for (const r of pendingProfile.slice(0, 6)) {
    rows.push({ user: (r.userId == null ? '' : r.userId) + (r.username ? ` ${r.username}` : ''), type: 'Profile', status: r.status == null ? 'pending' : r.status });
  }
  for (const it of rows.slice(0, 8)) {
    const tr = document.createElement('tr');
    const tdU = document.createElement('td');
    tdU.textContent = String(it.user);
    const tdT = document.createElement('td');
    tdT.textContent = String(it.type);
    const tdS = document.createElement('td');
    const pill = document.createElement('span');
    pill.className = 'dash-pill';
    pill.textContent = String(it.status);
    tdS.appendChild(pill);
    tr.appendChild(tdU);
    tr.appendChild(tdT);
    tr.appendChild(tdS);
    tbody.appendChild(tr);
  }
  if (!tbody.children.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<div style="font-size:28px;">🗂️</div><div>保留中の申請はありません</div><a class="cta" href="/admin/leave/requests">承認待ち一覧を開く</a>';
    recentCard.appendChild(empty);
  } else {
    recentCard.appendChild(table);
  }

  table.appendChild(tbody);
  grid.appendChild(recentCard);

  const workCard2 = document.createElement('div');
  workCard2.className = 'dash-card';
  const workTitle2 = document.createElement('div');
  workTitle2.className = 'dash-card-title';
  workTitle2.textContent = '作業報告';
  workCard2.appendChild(workTitle2);
  try {
    const sum = (workReports && workReports.summary) ? workReports.summary : {};
    const dayStr = String((workReports && workReports.date) ? workReports.date : '');
    const monthStr = dayStr && dayStr.length >= 7 ? dayStr.slice(0, 7) : '';
    const monthHref = monthStr ? `/admin/work-reports?mode=month&month=${encodeURIComponent(monthStr)}` : '/admin/work-reports';
    workCard2.style.cursor = 'pointer';
    workCard2.setAttribute('role', 'button');
    workCard2.setAttribute('tabindex', '0');
    const openMonth = () => {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      try {
        const sp = document.querySelector('#pageSpinner');
        if (sp) { sp.removeAttribute('hidden'); sp.style.display = 'flex'; }
      } catch {}
      window.location.href = monthHref;
    };
    workCard2.addEventListener('click', (e) => {
      const t = e && e.target;
      const a = (t && t.closest) ? t.closest('a') : null;
      if (a) return;
      openMonth();
    });
    workCard2.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMonth();
      }
    });
    const top = document.createElement('div');
    top.style.color = '#475569';
    top.style.fontWeight = '650';
    top.style.marginBottom = '10px';
    top.textContent = `必要(退勤済): ${fmtInt(sum.required == null ? 0 : sum.required)} / 提出: ${fmtInt(sum.submitted == null ? 0 : sum.submitted)} / 未提出: ${fmtInt(sum.missing == null ? 0 : sum.missing)}`;
    workCard2.appendChild(top);
    const hint = document.createElement('div');
    hint.style.color = '#64748b';
    hint.style.fontWeight = '550';
    hint.style.fontSize = '13px';
    hint.style.marginBottom = '10px';
    hint.textContent = '詳細は「一覧を開く」から確認できます。';
    workCard2.appendChild(hint);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.flexWrap = 'wrap';
    const link = document.createElement('a');
    link.href = monthHref;
    link.textContent = '一覧を開く';
    link.className = 'btn';
    link.style.textDecoration = 'none';
    link.addEventListener('click', () => {
      try { sessionStorage.setItem('navSpinner', '1'); } catch {}
      try {
        const sp = document.querySelector('#pageSpinner');
        if (sp) { sp.removeAttribute('hidden'); sp.style.display = 'flex'; }
      } catch {}
    });
    actions.appendChild(link);
    workCard2.appendChild(actions);
  } catch {}
  grid.appendChild(workCard2);

  wrap.appendChild(grid);
  content.appendChild(wrap);

  try {
    const err = $('#error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
  } catch {}
  try {
    const status = $('#status');
    if (status) status.textContent = '';
  } catch {}
  try {
    const userName = $('#userName');
    if (userName) userName.textContent = profile.username || profile.email || '管理者';
  } catch {}
};

export async function mount() {
  const profile = await requireAdmin();
  if (!profile) return;
  await renderDashboard(profile);
}
