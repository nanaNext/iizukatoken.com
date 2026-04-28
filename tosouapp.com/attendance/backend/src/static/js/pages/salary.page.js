import { me, logout, refresh } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const prefillUserName = () => {
  try {
    const el = $('#userName');
    if (!el) return;
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
    const u = raw ? JSON.parse(raw) : null;
    const name = (u && (u.username || u.email)) ? String(u.username || u.email) : '';
    if (name) el.textContent = name;
  } catch {}
};

const showErr = (msg) => {
  const el = $('#error');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
};

const showSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    if (el) { el.removeAttribute('hidden'); el.style.display = 'grid'; }
  } catch {}
};
const hideSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
  } catch {}
};

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const formatDateTime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
};

const getViewerId = () => {
  try {
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
    const u = raw ? JSON.parse(raw) : null;
    return String(u?.username || u?.email || 'anonymous');
  } catch {
    return 'anonymous';
  }
};

const viewedKey = () => `salaryViewedMonths:${getViewerId()}`;

const getViewedMonths = () => {
  try {
    const raw = localStorage.getItem(viewedKey()) || '[]';
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(v => String(v)) : []);
  } catch {
    return new Set();
  }
};

const markMonthViewed = (month) => {
  const m = String(month || '');
  if (!/^\d{4}-\d{2}$/.test(m)) return;
  try {
    const set = getViewedMonths();
    set.add(m);
    localStorage.setItem(viewedKey(), JSON.stringify(Array.from(set)));
  } catch {}
};

const ensureAuthProfile = async () => {
  let accessToken = '';
  try { accessToken = sessionStorage.getItem('accessToken') || ''; } catch {}
  if (!accessToken) {
    const r = await refresh();
    accessToken = r?.accessToken || '';
    try {
      if (accessToken) sessionStorage.setItem('accessToken', accessToken);
    } catch {}
  }
  if (!accessToken) throw new Error('Missing access token');
  const profile = await me(accessToken);
  try {
    const s = JSON.stringify(profile || {});
    sessionStorage.setItem('user', s);
    localStorage.setItem('user', s);
  } catch {}
  return profile;
};

const wireUserMenu = () => {
  const btn = document.querySelector('.user-btn');
  const dd = $('#userDropdown');
  if (!btn || !dd) return;
  btn.addEventListener('click', () => {
    const open = !dd.hasAttribute('hidden');
    if (open) dd.setAttribute('hidden', '');
    else dd.removeAttribute('hidden');
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.user-menu')) return;
    try { dd.setAttribute('hidden', ''); } catch {}
  });
  const logoutBtn = $('#btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await logout(); } catch {}
      try { sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('user'); } catch {}
      try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
      window.location.replace('/ui/login');
    });
  }
};

const wireDrawer = () => {
  const btn = $('#mobileMenuBtn');
  const drawer = $('#mobileDrawer');
  const backdrop = $('#drawerBackdrop');
  const closeBtn = $('#mobileClose');
  const close = () => {
    try { drawer.setAttribute('hidden', ''); backdrop.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); } catch {}
    try {
      drawer?.querySelectorAll?.('.drawer-group-btn[data-drawer-group]').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
        b.classList.remove('open');
      });
      drawer?.querySelectorAll?.('.drawer-group-list[data-drawer-panel]').forEach((p) => p.setAttribute('hidden', ''));
    } catch {}
  };
  const open = () => {
    try { drawer.removeAttribute('hidden'); backdrop.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); } catch {}
  };
  if (btn) btn.addEventListener('click', () => { if (drawer?.hasAttribute('hidden')) open(); else close(); });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  try {
    drawer?.querySelectorAll?.('.drawer-group-btn[data-drawer-group]').forEach((groupBtn) => {
      groupBtn.addEventListener('click', () => {
        const key = String(groupBtn.getAttribute('data-drawer-group') || '');
        const panel = drawer.querySelector(`.drawer-group-list[data-drawer-panel="${key}"]`);
        if (!panel) return;
        const openNow = panel.hasAttribute('hidden');
        drawer.querySelectorAll('.drawer-group-btn[data-drawer-group]').forEach((b) => {
          b.setAttribute('aria-expanded', 'false');
          b.classList.remove('open');
        });
        drawer.querySelectorAll('.drawer-group-list[data-drawer-panel]').forEach((p) => p.setAttribute('hidden', ''));
        if (openNow) {
          panel.removeAttribute('hidden');
          groupBtn.setAttribute('aria-expanded', 'true');
          groupBtn.classList.add('open');
        }
      });
    });
    drawer?.querySelectorAll?.('a.drawer-item[href]').forEach((a) => {
      a.addEventListener('click', () => close());
    });
  } catch {}
};

const render = async () => {
  const host = $('#salaryHost');
  if (!host) return;
  const params = new URLSearchParams(String(window.location.search || ''));
  const monthFromQuery = String(params.get('month') || '').trim();
  // Add styles for the buttons and table
  const style = document.createElement('style');
  style.textContent = `
    .sal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .sal-title{font-size:18px;font-weight:900;color:#0f172a}
    .sal-subtle{font-size:12px;color:#64748b}
    .sal-row{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}
    .sal-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px}
    .sal-btn {
      padding: 8px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #334155;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .sal-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .sal-btn-primary {
      background: #3b82f6;
      color: white;
      border-color: #2563eb;
    }
    .sal-btn-primary:hover {
      background: #2563eb;
      border-color: #1d4ed8;
    }
    .sal-chip{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;border:1px solid #e0e7ff}
    .sal-kv{display:grid;grid-template-columns:160px 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
    .sal-kv .k{background:#f8fafc;font-weight:700;color:#475569;padding:12px;border-right:1px solid #e2e8f0}
    .sal-kv .v{padding:12px}
    
    .sal-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .sal-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    .sal-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .sal-table tr:last-child td {
      border-bottom: none;
    }
    .sal-table tr:hover td {
      background: #f8fafc;
    }
    .sal-empty {
      padding: 40px;
      text-align: center;
      color: #64748b;
      background: #fff;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .sal-list a{color:#1d4ed8;text-decoration:underline;font-weight:700}
    .sal-list a:hover{color:#1e40af}
    .mobile-drawer .drawer-group-btn{
      width: 100%;
      text-align: left;
      border: 0;
      border-top: 1px solid #cfe0f5;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font: inherit;
      color: #124;
    }
    .mobile-drawer .drawer-group-btn .drawer-group-caret{
      transition: transform .15s ease;
    }
    .mobile-drawer .drawer-group-btn.open .drawer-group-caret{
      transform: rotate(180deg);
    }
    .mobile-drawer .drawer-group-list[hidden]{
      display: none !important;
    }
    .mobile-drawer .drawer-sub-item{
      padding-left: 28px;
      background: #f4f9ff;
      border-top-color: #e2eefc;
      font-size: 14px;
    }
    .sal-sub{font-size:12px;color:#64748b;margin-top:2px}
    .sal-list table{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
    .sal-list td{padding:10px 12px}
    .sal-list tr:hover td{background:#f8fafc}
    .sal-list a{display:inline-flex;align-items:center;gap:8px}
    .sal-list .dot{width:6px;height:6px;border-radius:50%;background:#22c55e;flex:0 0 auto}
    .sal-list .dot.is-hidden{display:none}
    .sal-list tr.is-active td{background:#eef4ff}
    .sal-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;color:#1d4ed8;text-decoration:none;font-weight:700}
    .sal-back:hover{color:#1e40af}
    .sal-detail-title{font-size:20px;font-weight:900;color:#0f172a}
    .sal-tabs{display:flex;gap:18px;border-bottom:1px solid #e2e8f0;margin-bottom:12px}
    .sal-tab{padding:8px 4px;color:#475569;cursor:pointer;font-weight:700;position:relative}
    .sal-tab.active{color:#0f172a}
    .sal-tab.active::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#3b82f6}
    .sal-pane{display:none}
    .sal-pane.active{display:block}
    .sal-related-group{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
    .sal-related-head{padding:10px 12px;color:#475569;font-weight:800;border-bottom:1px solid #e2e8f0}
    .sal-related-item{padding:12px}
    .sal-related-item a{color:#1d4ed8;text-decoration:underline;font-weight:700}
    .sal-related-item a:hover{color:#1e40af}
    @media (max-width: 700px){
      .sal-card{padding:10px !important;border-radius:10px}
      .sal-header{margin-bottom:10px}
      .sal-title{font-size:15px}
      .sal-subtle{font-size:11px}
      .sal-row{gap:10px}
      .sal-list table{border-radius:8px}
      .sal-table th,.sal-table td{padding:8px}
      .sal-table th{font-size:11px}
      .sal-table td{font-size:13px}
      .sal-list th:nth-child(2), .sal-list td:nth-child(2){
        width: 130px;
        white-space: nowrap;
      }
      .sal-list a{
        gap:6px;
        align-items:flex-start;
        line-height:1.25;
      }
      .sal-list .dot{margin-top:6px}
      .sal-back{font-size:13px;margin-bottom:8px}
      .sal-tabs{gap:12px}
      .sal-tab{font-size:12px;padding:7px 2px}
      .sal-detail-title{font-size:16px}
      .sal-kv{grid-template-columns:110px 1fr}
      .sal-kv .k,.sal-kv .v{padding:9px}
      #salOpenPdf{padding:6px 10px;font-size:12px}
    }
    @media (max-width: 480px){
      :root { --topbar-height: 52px; }
      body.drawer-open .topbar,
      body.drawer-open .subbar,
      body.drawer-open .content{
        transform: translateX(var(--drawer-offset, 280px)) !important;
      }
      body.drawer-open{
        overflow: hidden;
        touch-action: none;
        overscroll-behavior: none;
      }
      body:not(.admin) .topbar{
        padding: 6px 10px !important;
        min-height: var(--topbar-height) !important;
      }
      body:not(.admin) .topbar-inner{
        gap: 8px !important;
        padding-right: 0 !important;
      }
      body:not(.admin) .mobile-btn{
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
      }
      body:not(.admin) .topbar .search{
        flex: 1 1 auto !important;
        max-width: none !important;
        margin: 0 4px !important;
      }
      body:not(.admin) .topbar .search input{
        height: 30px !important;
        line-height: 30px !important;
        font-size: 13px !important;
      }
      body:not(.admin) .topbar .user{
        min-width: 30px !important;
        width: 30px !important;
      }
      body:not(.admin) .topbar .user .user-btn{
        width: 30px !important;
        height: 30px !important;
        min-width: 30px !important;
        padding: 0 !important;
      }
      body:not(.admin) .topbar .user .user-icon{
        width: 24px !important;
        height: 24px !important;
      }
      body:not(.admin) .topbar #userName,
      body:not(.admin) .topbar .caret{
        display: none !important;
      }
      body:not(.admin) .subbar{ display: none !important; }
      body:not(.admin) .subbar + .content{
        padding-top: calc(var(--topbar-height) + 8px) !important;
      }
      body:not(.admin) .content{
        padding-left: 8px !important;
        padding-right: 8px !important;
      }
    }
  `;
  document.head.appendChild(style);

  const openPublishedFile = async (month) => {
    showErr('');
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    showSpinner();
    try {
      const y = month.slice(0, 4);
      const mStr = month.slice(5, 7);
      const dl = await fetchJSONAuth(`/api/salary/me/${encodeURIComponent(y)}/${encodeURIComponent(mStr)}/download`);
      const secureUrl = String(dl?.secureUrl || '').trim();
      if (!secureUrl) {
        showErr('PDFが見つかりません');
        return;
      }
      window.open(secureUrl, '_blank', 'noopener');
    } catch (e) {
      showErr(e?.message || 'PDF取得に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const renderDetailPage = async (month) => {
    markMonthViewed(month);
    host.innerHTML = `
      <div class="sal-card" style="padding:16px">
        <a class="sal-back" href="/ui/salary">← 配布物名一覧に戻る</a>
        <div id="salMeta" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div class="sal-subtle"></div>
        </div>
        <div id="salBody"></div>
      </div>
    `;
    const meta = $('#salMeta');
    const body = $('#salBody');
    showErr('');
    if (!/^\d{4}-\d{2}$/.test(month)) {
      showErr('月の指定が正しくありません');
      return;
    }
    showSpinner();
    try {
      const r = await fetchJSONAuth(`/api/salary/my?month=${encodeURIComponent(month)}`);
      if (r?.notPublished) {
        if (body) body.innerHTML = `<div class="sal-empty">${esc(r.message || 'まだ公開されていません')}</div>`;
        if (meta) meta.textContent = '';
        return;
      }
      const y = month.slice(0, 4);
      const mStr = month.slice(5, 7);
      const title = `${y}年${mStr}月給与明細`;
      const emp = Array.isArray(r?.employees) && r.employees.length ? r.employees[0] : null;
      const owner = emp?.氏名 ? `${emp.氏名}${emp?.従業員コード ? `（${emp.従業員コード}）` : ''}` : 'あなた';
      const pubRes = await fetchJSONAuth('/api/salary/my/published').catch(() => null);
      const rel = Array.isArray(pubRes?.items) ? pubRes.items.find(it => String(it.month) === month) : null;
      const fileName = rel?.fileName || `${title}.pdf`;
      const publishedAt = rel?.publishedAt ? formatDateTime(rel.publishedAt) : '';
      if (meta) {
        const company = r?.companyName || '';
        const issue = r?.issueDate || '';
        meta.innerHTML = `<div><span class="sal-chip">${esc(company)}</span> <span class="sal-subtle" style="margin-left:8px;">発行日: ${esc(issue)}</span></div>`;
      }
      if (body) {
        body.innerHTML = `
          <div class="sal-tabs">
            <div id="salTabDetails" class="sal-tab active">DETAILS</div>
            <div id="salTabRelated" class="sal-tab">RELATED</div>
          </div>
          <div id="salPaneDetails" class="sal-pane active">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">
              <div class="sal-detail-title">${esc(title)}</div>
              <button id="salOpenPdf" class="sal-btn" type="button">印刷用に表示</button>
            </div>
            <div class="sal-kv">
              <div class="k">所有者</div><div class="v">${esc(owner)}</div>
            </div>
          </div>
          <div id="salPaneRelated" class="sal-pane">
            <div class="sal-related-group">
              <div class="sal-related-head">メモ & 添付ファイル (1)</div>
              <div class="sal-related-item">
                <div><a href="#" id="salFileLink">${esc(fileName)}</a></div>
                <div class="sal-sub">${esc(publishedAt)} ・ 添付ファイル</div>
              </div>
            </div>
          </div>
        `;
        const activate = (key) => {
          const t1 = document.getElementById('salTabDetails');
          const t2 = document.getElementById('salTabRelated');
          const p1 = document.getElementById('salPaneDetails');
          const p2 = document.getElementById('salPaneRelated');
          if (!t1 || !t2 || !p1 || !p2) return;
          if (key === 'details') {
            t1.classList.add('active'); t2.classList.remove('active');
            p1.classList.add('active'); p2.classList.remove('active');
          } else {
            t2.classList.add('active'); t1.classList.remove('active');
            p2.classList.add('active'); p1.classList.remove('active');
          }
        };
        document.getElementById('salTabDetails')?.addEventListener('click', () => activate('details'));
        document.getElementById('salTabRelated')?.addEventListener('click', () => activate('related'));
      }
      document.getElementById('salOpenPdf')?.addEventListener('click', async () => {
        await openPublishedFile(month);
      });
      document.getElementById('salFileLink')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await openPublishedFile(month);
      });
    } catch (e) {
      if (body) body.innerHTML = '';
      showErr(e?.message || '取得に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const renderListPage = async () => {
    host.innerHTML = `
      <div class="sal-card" style="padding:16px">
        <div class="sal-header">
          <div>
            <div class="sal-title">給与明細など</div>
            <div class="sal-subtle">公開済みの給与明細から選択し、詳細ページを表示できます</div>
          </div>
        </div>
        <div class="sal-row">
          <div>
            <div id="salList" class="sal-list" style="max-height:520px;overflow:auto;"></div>
          </div>
        </div>
      </div>
    `;
    const listEl = $('#salList');
    if (!listEl) return;
    if (!listEl) return [];
    try {
      const r = await fetchJSONAuth('/api/salary/my/published');
      const items = Array.isArray(r?.items) ? r.items : [];
      const viewed = getViewedMonths();
      if (!items.length) {
        listEl.innerHTML = `<div class="sal-sub">公開された給与明細がありません</div>`;
        return;
      }
      listEl.innerHTML = `
        <table class="sal-table">
          <thead>
            <tr>
              <th>配布物名</th>
              <th style="width:180px">配信完了日</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const month = String(it.month || '');
              const y = month.slice(0, 4);
              const m = month.slice(5, 7);
              const title = `${y}年${m}月給与明細`;
              const pub = it.publishedAt ? formatDateTime(it.publishedAt) : '';
              const viewedCls = viewed.has(month) ? ' is-hidden' : '';
              return `
                <tr data-month="${esc(month)}">
                  <td><a href="#" data-month="${esc(month)}"><span class="dot${viewedCls}"></span><span>${esc(title)}</span></a></td>
                  <td>${esc(pub)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      listEl.querySelectorAll('a[data-month]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const m = a.getAttribute('data-month') || '';
          if (!m) return;
          markMonthViewed(m);
          window.location.href = `/ui/salary?month=${encodeURIComponent(m)}`;
        });
      });
    } catch (e) {
      listEl.innerHTML = `<div class="sal-sub">一覧の取得に失敗しました</div>`;
    }
  };
  if (/^\d{4}-\d{2}$/.test(monthFromQuery)) {
    await renderDetailPage(monthFromQuery);
  } else {
    await renderListPage();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  prefillUserName();
  try {
    const profile = await ensureAuthProfile();
    const role = String(profile?.role || '').toLowerCase();
    if (!profile || !(role === 'employee' || role === 'manager' || role === 'admin')) {
      window.location.replace('/ui/login');
      return;
    }
    const name = profile.username || profile.email || 'ユーザー';
    const el = $('#userName');
    if (el) el.textContent = name;
  } catch {
    window.location.replace('/ui/login');
    return;
  }
  wireUserMenu();
  wireDrawer();
  await render();
});
