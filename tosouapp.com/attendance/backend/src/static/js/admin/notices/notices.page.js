import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const fmtTarget = (r) => {
  const uid = parseInt(String((r && r.target_user_id) ? r.target_user_id : 0), 10) || 0;
  if (uid) return '個人';
  const d = (r && r.target_date) ? String(r.target_date).slice(0, 10) : '';
  const m = (r && r.target_month) ? String(r.target_month).slice(0, 7) : '';
  if (d) return d;
  if (m) return m;
  return '全体';
};

const fmtCreated = (r) => {
  const s = String((r && r.created_at) ? r.created_at : '');
  if (s.length >= 16) return s.slice(0, 16).replace('T', ' ');
  return s || '—';
};

export async function mount() {
  const profile = await requireAdmin();
  if (!profile) return;

  try {
    const userName = document.querySelector('#userName');
    if (userName) userName.textContent = profile.username || profile.email || '管理者';
  } catch {}
  try {
    const status = document.querySelector('#status');
    if (status) status.textContent = '';
  } catch {}

  const host = document.querySelector('#adminContent');
  if (!host) return;

  const role = String((profile && profile.role) ? profile.role : '').toLowerCase();
  let targetsCache = null;
  const loadTargets = async () => {
    if (targetsCache) return targetsCache;
    const endpoint = role === 'manager' ? '/api/manager/users' : '/api/admin/users';
    const rows = await fetchJSONAuth(endpoint).catch(() => []);
    const arr = Array.isArray(rows) ? rows : ((rows && Array.isArray(rows.rows)) ? rows.rows : []);
    const cleaned = arr
      .map(u => ({
        id: parseInt(String((u && u.id) ? u.id : 0), 10) || 0,
        username: String((u && (u.username || u.email)) ? (u.username || u.email) : '').trim(),
        employeeCode: String((u && (u.employee_code || u.employeeCode)) ? (u.employee_code || u.employeeCode) : '').trim(),
        role: String((u && u.role) ? u.role : '').toLowerCase()
      }))
      .filter(u => u.id);
    targetsCache = role === 'manager' ? cleaned : cleaned.filter(u => u.role === 'employee');
    return targetsCache;
  };

  const render = async () => {
    const apiListPath = '/api/notices/admin?limit=80';
    const apiPostPath = '/api/notices/admin';
    let rows = [];
    let apiError = '';
    try {
      const list = await fetchJSONAuth(apiListPath);
      rows = (list && Array.isArray(list.rows)) ? list.rows : [];
    } catch (e) {
      apiError = String((e && e.message) ? e.message : (e || ''));
      rows = [];
    }
    let targets = [];
    try { targets = await loadTargets(); } catch {}
    const composerKey = 'adminNotices.composer.visible';
    const composerVisible = (() => {
      try {
        const v = localStorage.getItem(composerKey);
        if (v === '0') return false;
        if (v === '1') return true;
      } catch {}
      return true;
    })();
    const tableKey = 'adminNotices.table.visible';
    const tableVisible = (() => {
      try {
        const v = localStorage.getItem(tableKey);
        if (v === '0') return false;
        if (v === '1') return true;
      } catch {}
      return true;
    })();
    const fmtRecipient = (r) => {
      const tid = parseInt(String((r && r.target_user_id) ? r.target_user_id : 0), 10) || 0;
      if (!tid) return '全社員';
      const code = String((r && r.target_employee_code) ? r.target_employee_code : '').trim();
      const name = String((r && (r.target_username || r.target_email)) ? (r.target_username || r.target_email) : '').trim();
      return [code, name].filter(Boolean).join(' ') || `ID:${tid}`;
    };
    const fmtRead = (r) => {
      const tid = parseInt(String((r && r.target_user_id) ? r.target_user_id : 0), 10) || 0;
      const tr = String((r && r.target_read_at) ? r.target_read_at : '').trim();
      if (tid) {
        if (!tr) return '未読';
        const s = tr.includes('T') ? tr.replace('T', ' ') : tr;
        const hhmm = s.length >= 16 ? s.slice(11, 16) : s;
        return `既読 ${hhmm}`;
      }
      const c = parseInt(String((r && r.read_count) ? r.read_count : 0), 10) || 0;
      return c ? `既読 ${c}` : '未読';
    };

    host.innerHTML = `
      <style>
        .notice-page h3 { font-weight: 900; letter-spacing: .2px; }
        .notice-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          padding: 12px;
        }
        .notice-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .notice-sub {
          font-size: 12px;
          font-weight: 800;
          color: #334155;
        }
        .notice-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .notice-input,
        .notice-select,
        .notice-btn {
          height: 34px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 0 10px;
          font-weight: 900;
          color: #0b2c66;
          background: #fff;
          box-sizing: border-box;
        }
        .notice-btn { cursor: pointer; }
        .notice-btn:hover { background: #f8fafc; }
        .notice-btn.primary {
          border-color: #0b2c66;
          background: #0b2c66;
          color: #fff;
          cursor: pointer;
          padding: 0 12px;
        }
        .notice-btn.primary:hover { background: #0a285c; }
        .notice-textarea {
          width: 100%;
          margin-top: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 700;
          font-size: 14px;
          line-height: 1.6;
          resize: none;
          min-height: 120px;
          overflow: hidden;
          box-sizing: border-box;
          display: block;
          max-width: 100%;
        }
        .notice-table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fff;
          overflow: auto;
        }
        .notice-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          border: 1px solid #e5e7eb;
        }
        .notice-table th {
          text-align: left;
          padding: 10px 12px;
          font-weight: 900;
          font-size: 12px;
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #0f172a;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .notice-table td {
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .notice-table tr:nth-child(even) td { background: #fbfdff; }
        .notice-table tr:hover td { background: #f1f5f9; }
        .notice-target { font-weight: 900; color: #0b2c66; white-space: nowrap; }
        .notice-message { font-weight: 700; color: #0f172a; white-space: pre-wrap; word-break: break-word; }
        .notice-created { font-weight: 700; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .notice-actions { text-align: right; white-space: nowrap; }
        .notice-empty { padding: 12px; color: #64748b; font-weight: 800; }
        .notice-listbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 8px;
          margin-bottom: 6px;
        }
        .notice-switch {
          position: relative;
          display: inline-block;
          width: 38px;
          height: 20px;
          flex: 0 0 auto;
        }
        .notice-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .notice-switch-track {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: #0b2c66;
          border: 1px solid #0b2c66;
          cursor: pointer;
          transition: background .15s ease, border-color .15s ease;
        }
        .notice-switch-track::before {
          content: '';
          position: absolute;
          width: 16px;
          height: 16px;
          left: 2px;
          top: 1px;
          border-radius: 50%;
          background: #fff;
          transition: transform .15s ease;
          box-shadow: 0 2px 8px rgba(2, 6, 23, .18);
        }
        .notice-switch input:not(:checked) + .notice-switch-track {
          background: #e2e8f0;
          border-color: #cbd5e1;
        }
        .notice-switch input:checked + .notice-switch-track::before {
          transform: translateX(18px);
        }
      </style>

      <div class="notice-page">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <h3 style="margin:0;">お知らせ</h3>
        <div style="font-size:12px;font-weight:800;color:#334155;">全社員に表示されます</div>
      </div>

      <div style="margin-top:12px;display:grid;grid-template-columns:1fr;gap:10px;">
        <div class="notice-card">
          ${apiError ? `
            <div style="border:1px solid #fecaca;background:#fff1f2;color:#7f1d1d;border-radius:12px;padding:10px 12px;font-weight:900;margin-bottom:10px;">
              APIエラー: ${esc(apiError)}
              <div style="margin-top:6px;font-weight:800;font-size:12px;opacity:.9;">
                origin: ${esc(window.location.origin)} / GET ${esc(apiListPath)} / POST ${esc(apiPostPath)}
              </div>
            </div>
          ` : ``}
          <div class="notice-controls">
            <select id="noticeRecipient" class="notice-select" style="min-width:240px;">
              <option value="">全社員</option>
              ${targets.map(t => `<option value="${esc(t.id)}">${esc([t.employeeCode, t.username].filter(Boolean).join(' '))}</option>`).join('')}
            </select>
            <select id="noticeScope" class="notice-select">
              <option value="global">全体</option>
              <option value="date">日付</option>
              <option value="month">月</option>
            </select>
            <input id="noticeDate" type="date" class="notice-input" style="display:none;">
            <input id="noticeMonth" type="month" class="notice-input" style="display:none;">
            <button id="btnNoticePost" type="button" class="notice-btn primary">登録</button>
            <button id="btnNoticeComposerToggle" type="button" class="notice-btn">${composerVisible ? '入力欄を隠す' : '入力欄を表示'}</button>
          </div>
          <div id="noticeComposerBody" ${composerVisible ? '' : 'hidden'}>
            <textarea id="noticeMessage" class="notice-textarea" placeholder="通知内容を入力"></textarea>
            <div id="noticeError" style="display:none;margin-top:8px;color:#b00020;font-weight:800;"></div>
          </div>
        </div>

        <div class="notice-listbar">
          <div class="notice-sub">一覧</div>
          <label class="notice-switch" title="一覧を表示/非表示">
            <input id="toggleNoticeTable" type="checkbox" ${tableVisible ? 'checked' : ''}>
            <span class="notice-switch-track"></span>
          </label>
        </div>
        <div id="noticeTableSection" ${tableVisible ? '' : 'hidden'}>
        <div class="notice-table-wrap">
          <table class="notice-table">
            <colgroup>
              <col style="width:120px;">
              <col style="width:auto;">
              <col style="width:180px;">
              <col style="width:120px;">
              <col style="width:150px;">
              <col style="width:90px;">
            </colgroup>
            <thead>
              <tr>
                <th>対象</th>
                <th>内容</th>
                <th>宛先</th>
                <th>既読</th>
                <th>作成</th>
                <th style="text-align:right;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows.map((r) => `
                    <tr>
                      <td class="notice-target">${esc(fmtTarget(r))}</td>
                      <td class="notice-message">${esc((r && r.message) ? r.message : '')}</td>
                      <td class="notice-created">${esc(fmtRecipient(r))}</td>
                      <td class="notice-created">${esc(fmtRead(r))}</td>
                      <td class="notice-created">${esc(fmtCreated(r))}</td>
                      <td class="notice-actions">
                        <button type="button" class="se-mini-btn" data-notice-del="${esc((r && r.id != null) ? r.id : '')}">削除</button>
                      </td>
                    </tr>
                  `).join('')
                  : `<tr><td colspan="6" class="notice-empty">まだお知らせがありません</td></tr>`
              }
            </tbody>
          </table>
        </div>
        </div>
      </div>
      </div>
    `;

    const showErr = (msg) => {
      const el = host.querySelector('#noticeError');
      if (!el) return;
      if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
      el.style.display = 'block';
      el.textContent = msg;
    };

    const btnToggleComposer = host.querySelector('#btnNoticeComposerToggle');
    if (btnToggleComposer) btnToggleComposer.addEventListener('click', () => {
      const body = host.querySelector('#noticeComposerBody');
      const curHidden = !!(body && body.hasAttribute && body.hasAttribute('hidden'));
      const nextHidden = !curHidden;
      if (nextHidden) { try { if (body) body.setAttribute('hidden', ''); } catch {} }
      else { try { if (body) body.removeAttribute('hidden'); } catch {} }
      try { localStorage.setItem(composerKey, nextHidden ? '0' : '1'); } catch {}
      try { host.querySelector('#btnNoticeComposerToggle').textContent = nextHidden ? '入力欄を表示' : '入力欄を隠す'; } catch {}
    });
    const toggleNoticeTable = host.querySelector('#toggleNoticeTable');
    if (toggleNoticeTable) toggleNoticeTable.addEventListener('change', () => {
      const chk = toggleNoticeTable;
      const sec = host.querySelector('#noticeTableSection');
      const vis = !!chk.checked;
      if (vis) { try { if (sec) sec.removeAttribute('hidden'); } catch {} }
      else { try { if (sec) sec.setAttribute('hidden', ''); } catch {} }
      try { localStorage.setItem(tableKey, vis ? '1' : '0'); } catch {}
    });

    const recipient = host.querySelector('#noticeRecipient');
    const scope = host.querySelector('#noticeScope');
    const date = host.querySelector('#noticeDate');
    const month = host.querySelector('#noticeMonth');
    const msg = host.querySelector('#noticeMessage');

    const autoGrow = () => {
      if (!msg) return;
      try {
        msg.style.height = '0px';
        const h = Math.max(120, msg.scrollHeight);
        msg.style.height = `${h}px`;
      } catch {}
    };

    const applyScope = () => {
      const v = String((scope && scope.value != null) ? scope.value : 'global');
      if (date) date.style.display = v === 'date' ? '' : 'none';
      if (month) month.style.display = v === 'month' ? '' : 'none';
    };
    if (scope) scope.addEventListener('change', applyScope);
    applyScope();
    if (msg) msg.addEventListener('input', autoGrow);
    autoGrow();

    const btnPost = host.querySelector('#btnNoticePost');
    if (btnPost) btnPost.addEventListener('click', async () => {
      showErr('');
      const targetUserId = recipient ? String(recipient.value || '').trim() : '';
      const scopeV = String((scope && scope.value != null) ? scope.value : 'global');
      const targetDate = scopeV === 'date' ? String((date && date.value) ? date.value : '').slice(0, 10) : null;
      const targetMonth = scopeV === 'month' ? String((month && month.value) ? month.value : '').slice(0, 7) : null;
      const message = String((msg && msg.value != null) ? msg.value : '').trim();
      if (!message) { showErr('内容を入力してください'); return; }
      try {
        await fetchJSONAuth(apiPostPath, { method: 'POST', body: JSON.stringify({ targetUserId: targetUserId || null, targetDate, targetMonth, message }) });
        await render();
      } catch (e) {
        const m = String((e && e.message) ? e.message : (e || ''));
        if (m === 'Not Found') {
          showErr(`Not Found: ${window.location.origin}${apiPostPath}`);
        } else {
          showErr(m || '登録に失敗しました');
        }
      }
    });

    host.querySelectorAll('[data-notice-del]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        showErr('');
        const id = btn.getAttribute('data-notice-del');
        const ok = window.confirm('削除しますか？');
        if (!ok) return;
        try {
          await fetchJSONAuth(`/api/notices/admin/${encodeURIComponent(String(id || ''))}`, { method: 'DELETE' });
          await render();
        } catch (e) {
          showErr((e && e.message) ? e.message : '削除に失敗しました');
        }
      });
    });
  };

  await render();
}
