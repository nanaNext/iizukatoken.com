import { me, logout, refresh } from '../api/auth.api.js';
import { fetchJSONAuth, fetchResponseAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

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
    if (el) { el.removeAttribute('hidden'); el.style.display = 'flex'; }
  } catch {}
};
const hideSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
  } catch {}
};

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const monthJST = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};
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

const ensureAuthProfile = async () => {
  let accessToken = '';
  try { accessToken = sessionStorage.getItem('accessToken') || ''; } catch {}
  if (!accessToken) {
    let refreshToken = '';
    try { refreshToken = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || ''; } catch {}
    if (refreshToken) {
      const r = await refresh(refreshToken || undefined);
      accessToken = r?.accessToken || '';
      try {
        if (accessToken) sessionStorage.setItem('accessToken', accessToken);
        if (r?.refreshToken) {
          sessionStorage.setItem('refreshToken', r.refreshToken);
          localStorage.setItem('refreshToken', r.refreshToken);
        } else if (refreshToken) {
          sessionStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('refreshToken', refreshToken);
        }
      } catch {}
    }
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
      try {
        const rt = sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken') || '';
        await logout(rt);
      } catch {}
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
  };
  const open = () => {
    try { drawer.removeAttribute('hidden'); backdrop.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); } catch {}
  };
  if (btn) btn.addEventListener('click', () => { if (drawer?.hasAttribute('hidden')) open(); else close(); });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
};

const render = async () => {
  const host = $('#salaryHost');
  if (!host) return;
  const m0 = monthJST();

  // Add styles for the buttons and table
  const style = document.createElement('style');
  style.textContent = `
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
    
    .sal-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
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
    .sal-sub{font-size:12px;color:#64748b;margin-top:2px}
  `;
  document.head.appendChild(style);

  host.innerHTML = `
    <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:start;">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
        <div style="font-weight:900;color:#0f172a;margin-bottom:10px;">配布物名</div>
        <div id="salList" class="sal-list" style="max-height:460px;overflow:auto;"></div>
      </div>
      <div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:20px;background:#fff;padding:15px;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <div style="font-weight:bold;color:#475569;">対象年月:</div>
          <input id="salMonth" type="month" value="${m0}" style="padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;">
          <button id="salLoad" class="sal-btn sal-btn-primary" type="button">表示する</button>
        </div>
        <div id="salMeta" style="color:#64748b;font-weight:600;margin-bottom:12px;font-size:14px;"></div>
        <div id="salBody"></div>
      </div>
    </div>
  `;

  const meta = $('#salMeta');
  const body = $('#salBody');
  const listEl = $('#salList');

  const loadList = async () => {
    if (!listEl) return [];
    try {
      const r = await fetchJSONAuth('/api/salary/my/published');
      const items = Array.isArray(r?.items) ? r.items : [];
      if (!items.length) {
        listEl.innerHTML = `<div class="sal-sub">公開された給与明細がありません</div>`;
        return [];
      }
      listEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${items.map(it => {
              const month = String(it.month || '');
              const y = month.slice(0, 4);
              const m = month.slice(5, 7);
              const title = `${y}年${m}月給与明細`;
              const pub = it.publishedAt ? `送信: ${formatDateTime(it.publishedAt)}` : '';
              const file = it.fileName ? `ファイル: ${esc(it.fileName)}` : (it.hasPdf ? '' : 'ファイル: 未作成');
              return `
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                    <a href="#" data-month="${esc(month)}">${esc(title)}</a>
                    ${pub ? `<div class="sal-sub">${esc(pub)}</div>` : ''}
                    ${file ? `<div class="sal-sub">${file}</div>` : ''}
                  </td>
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
          const input = $('#salMonth');
          if (input) input.value = m;
          load();
        });
      });
      return items;
    } catch (e) {
      listEl.innerHTML = `<div class="sal-sub">一覧の取得に失敗しました</div>`;
      return [];
    }
  };

  const load = async () => {
    showErr('');
    const month = String($('#salMonth')?.value || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      showErr('月を選択してください');
      return;
    }
    showSpinner();
    try {
      const r = await fetchJSONAuth(`/api/salary/my?month=${encodeURIComponent(month)}`);
      
      if (r?.notPublished) {
        if (body) body.innerHTML = `
          <div class="sal-empty">
            <div style="font-size:32px;margin-bottom:10px;">🔒</div>
            <div style="font-size:16px;font-weight:bold;">${esc(r.message || 'まだ公開されていません')}</div>
            <div style="font-size:14px;margin-top:5px;">管理者が公開するまでお待ちください。</div>
          </div>`;
        if (meta) meta.textContent = '';
        return;
      }
      
      const company = r?.companyName || '';
      const issue = r?.issueDate || '';
      const emp = Array.isArray(r?.employees) && r.employees.length ? r.employees[0] : null;
      
      if (meta) {
        meta.innerHTML = `
          <span style="color:#3b82f6;">●</span> ${esc(company)} 
          <span style="margin:0 10px;color:#cbd5e1;">|</span> 
          発行日: ${esc(issue)}
        `;
      }

      if (!emp) {
        if (body) body.innerHTML = `
          <div class="sal-empty">
            <div style="font-size:32px;margin-bottom:10px;">🗂️</div>
            <div style="font-size:16px;font-weight:bold;">データがありません</div>
            <div style="font-size:14px;margin-top:5px;">この月の給与明細はまだ作成されていません。</div>
          </div>`;
        return;
      }

      // Render a nice table instead of raw JSON
      const netPay = new Intl.NumberFormat('ja-JP').format(emp?.合計?.差引支給額 || 0);
      const grossPay = new Intl.NumberFormat('ja-JP').format(emp?.合計?.総支給額 || 0);
      const dedPay = new Intl.NumberFormat('ja-JP').format(emp?.合計?.総控除額 || 0);
      
      const y = month.slice(0, 4);
      const mStr = month.slice(5, 7);
      const filename = `${y}年${mStr}月給与明細.pdf`;

      if (body) {
        body.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">
            <div style="font-size:20px;font-weight:bold;color:#0f172a;">${y}年${mStr}月 給与明細</div>
            <button id="salDownload" class="sal-btn" type="button">
              PDFダウンロード
            </button>
          </div>
          
          <table class="sal-table">
            <thead>
              <tr>
                <th style="width:30%">項目</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>社員名</strong></td>
                <td style="font-weight:bold;">${esc(emp.氏名)} <span style="color:#64748b;font-weight:normal;font-size:12px;">(${esc(emp.従業員コード)})</span></td>
              </tr>
              <tr>
                <td><strong>所属</strong></td>
                <td>${esc(emp.所属 || '-')}</td>
              </tr>
              <tr>
                <td><strong>ファイル名</strong></td>
                <td style="color:#64748b;">${esc(filename)}</td>
              </tr>
              <tr style="background:#f0f9ff;">
                <td style="color:#0369a1;"><strong>総支給額</strong></td>
                <td style="color:#0369a1;font-weight:bold;">${grossPay} 円</td>
              </tr>
              <tr style="background:#fdf2f8;">
                <td style="color:#be185d;"><strong>総控除額</strong></td>
                <td style="color:#be185d;font-weight:bold;">${dedPay} 円</td>
              </tr>
              <tr style="background:#f0fdf4;">
                <td style="color:#15803d;font-size:16px;"><strong>差引支払額（手取り）</strong></td>
                <td style="color:#15803d;font-size:18px;font-weight:900;">${netPay} 円</td>
              </tr>
            </tbody>
          </table>
        `;

        // Attach event listener to the newly created download button
        document.getElementById('salDownload').addEventListener('click', async () => {
          showErr('');
          showSpinner();
          try {
            const res = await fetchJSONAuth(`/api/salary/me/${encodeURIComponent(y)}/${encodeURIComponent(mStr)}/download`);
            if (res?.notPublished) {
              showErr(res.message || 'まだ公開されていません');
              return;
            }
            const secureUrl = res?.secureUrl;
            if (!secureUrl) {
              showErr('PDFが見つかりません');
              return;
            }
            const r2 = await fetchResponseAuth(secureUrl);
            const ct = String(r2.headers.get('content-type') || '').toLowerCase();
            if (!ct.includes('application/pdf')) {
              let t = '';
              try { t = await r2.clone().text(); } catch {}
              showErr(t || 'PDF取得に失敗しました');
              return;
            }
            const blob = await r2.blob();
            const url = URL.createObjectURL(blob);
            try { window.open(url, '_blank', 'noopener'); } catch { window.location.href = url; }
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 30000);
          } catch (e) {
            showErr(e?.message || 'PDF取得に失敗しました');
          } finally {
            hideSpinner();
          }
        });
      }
    } catch (e) {
      if (body) body.innerHTML = '';
      showErr(e?.message || '取得に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  $('#salLoad')?.addEventListener('click', load);
  $('#salMonth')?.addEventListener('change', load);

  const publishedItems = await loadList();
  try {
    const current = String($('#salMonth')?.value || '').trim();
    const hasCurrent = publishedItems.some(it => String(it.month) === current);
    if (!hasCurrent && publishedItems.length) {
      $('#salMonth').value = String(publishedItems[0].month || m0);
    }
  } catch {}

  await load();
};

document.addEventListener('DOMContentLoaded', async () => {
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
