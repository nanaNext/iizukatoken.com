import { me, refresh, logout } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const showSpinner = () => {
  try { $('#pageSpinner')?.removeAttribute('hidden'); } catch {}
};
const hideSpinner = () => {
  try { $('#pageSpinner')?.setAttribute('hidden', ''); } catch {}
};

const showErr = (msg) => {
  const el = $('#error');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
};

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtTime = (dt) => {
  if (!dt) return '—';
  const s = String(dt);
  return s.length >= 16 ? s.slice(11, 16) : s;
};
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

async function ensureAuthProfile() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) { try { profile = await me(token); } catch {} }
  if (!profile) {
    try {
      const r = await refresh();
      sessionStorage.setItem('accessToken', r.accessToken);
      profile = await me(r.accessToken);
    } catch {}
  }
  if (!profile) {
    try {
      const userStr = sessionStorage.getItem('user') || localStorage.getItem('user') || '';
      profile = userStr ? JSON.parse(userStr) : null;
    } catch {}
  }
  return profile || null;
}

const wireUserMenu = () => {
  const btn = $('#userBtn');
  const menu = $('#userMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = !menu.hasAttribute('hidden');
    if (open) { menu.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); }
    else { menu.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
  });
  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('#userBtn') || e.target?.closest?.('#userMenu')) return;
    try { menu.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); } catch {}
  });
  $('#btnLogout')?.addEventListener('click', async () => {
    try { await logout(); } catch {}
    try { sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('user'); } catch {}
    try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch {}
    window.location.replace('/ui/login');
  });
};

const wireTopNavDropdowns = () => {
  const btns = Array.from(document.querySelectorAll('.kintai-nav-btn[data-dd]'));
  const panels = Array.from(document.querySelectorAll('.kintai-dd[data-dd-panel]'));
  if (!btns.length || !panels.length) return;
  try { document.body.classList.add('nav-js'); } catch {}

  const closeAll = () => {
    for (const b of btns) {
      try { b.setAttribute('aria-expanded', 'false'); } catch {}
    }
    for (const p of panels) {
      try { p.setAttribute('hidden', ''); p.style.display = ''; } catch {}
    }
    document.querySelectorAll('.kintai-nav-dd').forEach(dd => { try { dd.classList.remove('open'); } catch {} });
  };

  const openOne = (key) => {
    closeAll();
    const btn = btns.find(b => b.dataset.dd === key);
    const panel = panels.find(p => p.dataset.ddPanel === key);
    if (!btn || !panel) return;
    try { btn.setAttribute('aria-expanded', 'true'); } catch {}
    try { panel.removeAttribute('hidden'); panel.style.display = 'block'; } catch {}
    try { btn.closest('.kintai-nav-dd')?.classList.add('open'); } catch {}
    try {
      panel.style.position = '';
      panel.style.left = '';
      panel.style.top = '';
      panel.style.maxWidth = '';
      panel.style.width = '';
    } catch {}
  };

  for (const b of btns) {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const key = b.dataset.dd;
      const panel = panels.find(p => p.dataset.ddPanel === key);
      const isOpen = panel && !panel.hasAttribute('hidden');
      if (isOpen) closeAll();
      else openOne(key);
    });
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const key = b.dataset.dd;
      const panel = panels.find(p => p.dataset.ddPanel === key);
      const isOpen = panel && !panel.hasAttribute('hidden');
      if (isOpen) closeAll();
      else openOne(key);
    }, { passive: false });
    b.addEventListener('touchend', (e) => {
      e.preventDefault();
      const key = b.dataset.dd;
      const panel = panels.find(p => p.dataset.ddPanel === key);
      const isOpen = panel && !panel.hasAttribute('hidden');
      if (isOpen) closeAll();
      else openOne(key);
    }, { passive: false });
  }

  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('.kintai-nav-dd')) return;
    closeAll();
  });
};

const renderNotice = async (profile) => {
  const host = $('#noticeHost');
  if (!host) return;
  const date = todayJST();
  const month = date.slice(0, 7);
  const data = await fetchJSONAuth(`/api/notices?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}&limit=10`).catch(() => null);
  const rows = Array.isArray(data?.notices) ? data.notices : [];
  const parseDbTsAsJst = (s) => {
    const x = String(s || '').trim();
    if (!x) return null;
    if (/[zZ]$/.test(x) || /[+-]\d{2}:\d{2}$/.test(x)) {
      const d0 = new Date(x);
      return Number.isFinite(d0.getTime()) ? d0 : null;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(x)) {
      const d0 = new Date(x.replace(' ', 'T') + '+09:00');
      return Number.isFinite(d0.getTime()) ? d0 : null;
    }
    const d0 = new Date(x);
    return Number.isFinite(d0.getTime()) ? d0 : null;
  };
  const fmtTarget = (r) => {
    if (r?.target_user_id != null && String(r.target_user_id) !== '') return '個人';
    const d = r?.target_date ? String(r.target_date).slice(0, 10) : '';
    const m = r?.target_month ? String(r.target_month).slice(0, 7) : '';
    return d || m || '全体';
  };
  const fmtCreated = (r) => {
    const s = String(r?.created_at || '');
    if (s.length >= 16) return s.slice(0, 16).replace('T', ' ');
    return s || '—';
  };
  const preview1 = (t) => {
    const s = String(t || '').replace(/\r/g, '');
    const line = (s.split('\n')[0] || '').trim();
    if (!line) return '（内容なし）';
    return line.length > 80 ? (line.slice(0, 80) + '…') : line;
  };
  const today = date;
  const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
  const NEW_HOURS = 72;
  const unreadIds = [];
  const listHtml = rows.length
    ? `<div class="kintai-notice-list">
        ${rows.map((r, i) => {
          const target = fmtTarget(r);
          const created = fmtCreated(r);
          const msg = String(r?.message || '');
          const cdt = parseDbTsAsJst(r?.created_at);
          const isNew = cdt ? ((nowJst.getTime() - cdt.getTime()) <= NEW_HOURS * 3600 * 1000) : (String(r?.created_at || '').slice(0, 10) === today);
          const isRead = !!r?.read_at;
          const nid = parseInt(String(r?.id || 0), 10) || 0;
          if (nid && !isRead) unreadIds.push(nid);
          return `
            <details class="kintai-notice-item ${isRead ? 'is-read' : 'is-unread'}" data-notice-id="${esc(nid)}">
              <summary class="kintai-notice-summary">
                <span class="kintai-notice-left">
                  <span class="kintai-notice-tag">${esc(target)}</span>
                  ${isNew ? `<span class="kintai-notice-new">NEW</span>` : ``}
                  <span class="kintai-notice-preview">${esc(preview1(msg))}</span>
                </span>
                <span class="kintai-notice-time">${esc(created)}</span>
              </summary>
              <div class="kintai-notice-body">${esc(msg)}</div>
            </details>
          `;
        }).join('')}
      </div>`
    : `<div class="kintai-notice-empty">お知らせはありません。</div>`;
  const prefKey = 'noticePanel.visible';
  const isVisible = (() => {
    try {
      const v = localStorage.getItem(prefKey);
      if (v === '0') return false;
      if (v === '1') return true;
    } catch {}
    return true;
  })();
  host.innerHTML = `
    <div class="kintai-notice-meta">
      <div class="kintai-notice-meta-row"><div class="kintai-notice-meta-label">対象日</div><div class="kintai-notice-meta-value">${esc(date)}</div></div>
      <div class="kintai-notice-meta-row"><div class="kintai-notice-meta-label">ユーザー</div><div class="kintai-notice-meta-value">${esc(profile?.username || profile?.email || '—')}</div></div>
    </div>
    <div class="kintai-notice-toolbar">
      <button type="button" class="kintai-notice-toggle" id="btnNoticeToggle">${isVisible ? '非表示' : '表示'}</button>
    </div>
    <div class="kintai-notice-section" id="noticeBody" ${isVisible ? '' : 'hidden'}>
      ${listHtml}
    </div>
  `;

  try {
    host.querySelector('#btnNoticeToggle')?.addEventListener('click', () => {
      const body = host.querySelector('#noticeBody');
      const curHidden = !!body?.hasAttribute?.('hidden');
      const nextHidden = !curHidden;
      if (nextHidden) body?.setAttribute?.('hidden', '');
      else body?.removeAttribute?.('hidden');
      try { localStorage.setItem(prefKey, nextHidden ? '0' : '1'); } catch {}
      try { host.querySelector('#btnNoticeToggle').textContent = nextHidden ? '表示' : '非表示'; } catch {}
    });
  } catch {}

  const markOne = async (id) => {
    if (!id) return;
    try { await fetchJSONAuth('/api/notices/read', { method: 'POST', body: JSON.stringify({ ids: [id] }) }); } catch {}
  };
  host.querySelectorAll('details[data-notice-id]').forEach((el) => {
    el.addEventListener('toggle', () => {
      try {
        if (!el.open) return;
        if (!el.classList.contains('is-unread')) return;
        const id = parseInt(String(el.getAttribute('data-notice-id') || 0), 10) || 0;
        el.classList.remove('is-unread');
        el.classList.add('is-read');
        markOne(id);
      } catch {}
    });
  });
};

const renderAttendance = async () => {
  const host = $('#attendanceHost');
  if (!host) return;
  host.innerHTML = '<div style="font-weight:700;color:#475569;">読み込み中…</div>';
  showSpinner();
  try {
    const date = todayJST();
    const cal = await fetchJSONAuth(`/api/attendance/calendar/day/${encodeURIComponent(date)}`).catch(() => null);
    const weekend = (() => {
      try {
        const y = parseInt(date.slice(0, 4), 10);
        const m = parseInt(date.slice(5, 7), 10) - 1;
        const d = parseInt(date.slice(8, 10), 10);
        if (!y || m < 0 || d <= 0) return false;
        const dt = new Date(Date.UTC(y, m, d, 0, 0, 0));
        const dow = dt.getUTCDay();
        return dow === 0 || dow === 6;
      } catch {
        return false;
      }
    })();
    const isOff = Number(cal?.is_off || 0) === 1 || weekend;
    const daily0 = await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`).catch(() => null);
    const daily = daily0?.daily || null;
    const defaultKubun = isOff ? '休日' : '出勤';
    const kubunSaved = String(daily?.kubun || '').trim();
    const kubunInit = kubunSaved || defaultKubun;
    const wtKey = 'attendance.workType.default';
    const loadWT = () => {
      try {
        const v = localStorage.getItem(wtKey) || '';
        return v === 'onsite' || v === 'remote' || v === 'satellite' ? v : 'onsite';
      } catch {
        return 'onsite';
      }
    };
    const day = await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}`);
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    let last = null;
    for (const s of segments) {
      if (!last || String(s?.checkIn || '') > String(last?.checkIn || '')) last = s;
    }
    const st = last?.checkIn ? (last?.checkOut ? '退勤済' : '出勤中') : '未出勤';
    const canIn = !last?.checkIn;
    const canOut = !!last?.checkIn && !last?.checkOut;
    const wtLabel = (v) => v === 'onsite' ? '出社' : v === 'remote' ? '在宅' : v === 'satellite' ? '現場/出張' : '出社';
    const kubunOptions = isOff
      ? ['休日', '休日出勤', '代替出勤']
      : ['出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日'];
    const kubunGroupLabel = isOff ? '[予定休日]' : '[予定出勤]';
    const kubunOptionsHtml = `
      <option value="" disabled>${esc(kubunGroupLabel)}</option>
      ${kubunOptions.map(k => `<option value="${esc(k)}" ${kubunInit === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}
    `;
    host.innerHTML = `
      <table class="kintai-table">
        <tbody>
          <tr><th>状態</th><td><strong>${esc(st)}</strong></td></tr>
          <tr>
            <th>勤務区分</th>
            <td>
              <select id="kubun" style="min-width:180px;">
                ${kubunOptionsHtml}
              </select>
            </td>
          </tr>
          <tr>
            <th>勤務形態</th>
            <td>
              <select id="workType" style="min-width:180px;">
                <option value="onsite">出社</option>
                <option value="remote">在宅</option>
                <option value="satellite">現場/出張</option>
              </select>
            </td>
          </tr>
          <tr id="rowCheckIn"><th>出勤</th><td>${esc(fmtTime(last?.checkIn))}</td></tr>
          <tr id="rowCheckOut"><th>退勤</th><td>${esc(fmtTime(last?.checkOut))}</td></tr>
        </tbody>
      </table>
      <div class="kintai-actions kintai-actions-split">
        <div class="kintai-actions-left">
          <a class="kintai-monthly-link" href="/ui/attendance/monthly">
            月次勤怠入力へ
            <svg class="kintai-icon-pc" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"></path>
              <path d="M8 21h8"></path>
              <path d="M12 18v3"></path>
            </svg>
          </a>
          <button class="kintai-btn primary" id="btnCheckIn" type="button" ${canIn ? '' : 'disabled'}>出勤</button>
          <button class="kintai-btn" id="btnCheckOut" type="button" ${canOut ? '' : 'disabled'}>退勤</button>
          <a class="kintai-btn" href="/ui/work-report?date=${encodeURIComponent(date)}" style="text-decoration:none;display:inline-flex;align-items:center;">作業報告</a>
        </div>
        <div class="kintai-actions-right">
          <button class="kintai-btn" id="btnConfirm" type="button">確定</button>
        </div>
      </div>
    `;
    try {
      const sel = $('#workType');
      if (sel) sel.value = loadWT();
      sel?.addEventListener('change', async () => {
        const v = String(sel.value || '');
        try { localStorage.setItem(wtKey, v); } catch {}
        try {
          await fetchJSONAuth('/api/attendance/worktype', { method: 'POST', body: JSON.stringify({ date, workType: v }) });
          const kubun = String($('#kubun')?.value || kubunInit);
          await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, { method: 'PUT', body: JSON.stringify({ kubun, workType: v }) });
        } catch {}
      });
    } catch {}
    const hideKubunSet = new Set(['欠勤', '有給休暇', '半休', '無給休暇', '休日', '代替休日']);
    const toggleWorkTypeRow = () => {
      const kubun = String($('#kubun')?.value || defaultKubun);
      const tr = $('#workType')?.closest('tr');
      const hide = hideKubunSet.has(kubun);
      if (tr) tr.style.display = hide ? 'none' : '';
      const rIn = document.getElementById('rowCheckIn');
      const rOut = document.getElementById('rowCheckOut');
      if (rIn) rIn.style.display = hide ? 'none' : '';
      if (rOut) rOut.style.display = hide ? 'none' : '';
      const btnIn = $('#btnCheckIn');
      const btnOut = $('#btnCheckOut');
      if (btnIn) btnIn.disabled = hide ? true : btnIn.disabled;
      if (btnOut) btnOut.disabled = hide ? true : btnOut.disabled;
      if (hide) {
        const wtSel = $('#workType');
        if (wtSel) wtSel.value = '';
      } else {
        const wtSel = $('#workType');
        if (wtSel && !wtSel.value) wtSel.value = loadWT();
      }
    };
    toggleWorkTypeRow();
    try {
      const sel2 = $('#kubun');
      sel2?.addEventListener('change', async () => {
        const kubun = String(sel2.value || defaultKubun);
        const wt = hideKubunSet.has(kubun) ? null : (String($('#workType')?.value || loadWT()) || null);
        toggleWorkTypeRow();
        showErr('');
        showSpinner();
        try {
          await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, { method: 'PUT', body: JSON.stringify({ kubun, workType: wt }) });
        } catch (e) {
          showErr(e?.message || '保存に失敗しました');
        } finally {
          hideSpinner();
        }
      });
    } catch {}
    $('#btnCheckIn')?.addEventListener('click', async () => {
      showErr('');
      showSpinner();
      try {
        const kubun = String($('#kubun')?.value || defaultKubun);
        const wt = hideKubunSet.has(kubun) ? null : (String($('#workType')?.value || loadWT()) || null);
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, { method: 'PUT', body: JSON.stringify({ kubun, workType: wt }) });
        await fetchJSONAuth('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ workType: wt }) });
        await renderAttendance();
      } catch (e) {
        showErr(e?.message || '出勤に失敗しました');
      } finally {
        hideSpinner();
      }
    });
    $('#btnCheckOut')?.addEventListener('click', async () => {
      showErr('');
      showSpinner();
      try {
        const kubun = String($('#kubun')?.value || defaultKubun);
        const wt = hideKubunSet.has(kubun) ? null : (String($('#workType')?.value || loadWT()) || null);
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, { method: 'PUT', body: JSON.stringify({ kubun, workType: wt }) });
        await fetchJSONAuth('/api/attendance/checkout', { method: 'POST', body: JSON.stringify({}) });
        await renderAttendance();
      } catch (e) {
        showErr(e?.message || '退勤に失敗しました');
      } finally {
        hideSpinner();
      }
    });
    $('#btnConfirm')?.addEventListener('click', async () => {
      showErr('');
      showSpinner();
      try {
        const kubun = String($('#kubun')?.value || defaultKubun);
        const wt = hideKubunSet.has(kubun) ? null : (String($('#workType')?.value || loadWT()) || null);
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, { method: 'PUT', body: JSON.stringify({ kubun, workType: wt }) });
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/submit`, { method: 'POST', body: JSON.stringify({}) }).catch(() => null);
        await renderAttendance();
      } catch (e) {
        showErr(e?.message || '確定に失敗しました');
      } finally {
        hideSpinner();
      }
    });
  } catch (e) {
    host.innerHTML = '';
    showErr(e?.message || '読み込みに失敗しました');
  } finally {
    hideSpinner();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
    const params = (() => { try { return new URLSearchParams(String(window.location.search||'')); } catch { return new URLSearchParams(); } })();
    const isBack = params.get('back') === '1';
    const ref = String(document.referrer || '');
    const fromSimple = ref.includes('/ui/attendance/simple');
    if (isMobile && !isBack && !fromSimple) {
      window.location.href = '/ui/attendance/simple';
      return;
    }
  } catch {}
  try {
    const prevent = () => { try { history.pushState(null, '', location.href); } catch {} };
    prevent();
    window.addEventListener('popstate', () => { prevent(); });
  } catch {}
  showErr('');
  wireUserMenu();
  wireTopNavDropdowns();
  showSpinner();
  const profile = await ensureAuthProfile();
  if (!profile) {
    window.location.replace('/ui/login');
    return;
  }
  const role = String(profile?.role || '').toLowerCase();
  if (role === 'admin') {
    try { document.body.dataset.roleAdmin = '1'; } catch {}
  }
  try { $('#userName').textContent = profile.username || profile.email || 'ユーザー'; } catch {}
  await renderNotice(profile);
  await renderAttendance();
  hideSpinner();
});
