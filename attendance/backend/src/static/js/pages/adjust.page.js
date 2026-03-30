import { logout } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const showErr = (msg) => {
  const el = $('#error');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
};

let spinnerCount = 0;
const showSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    spinnerCount++;
    if (el) { el.removeAttribute('hidden'); el.style.display = 'flex'; }
  } catch {}
};
const hideSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    spinnerCount = Math.max(0, spinnerCount - 1);
    if (spinnerCount !== 0) return;
    if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
  } catch {}
};

const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayISO = () => new Date().toLocaleDateString('sv-SE');

const toMySQLDateTime = (dtLocal) => {
  const s = String(dtLocal || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s.replace('T', ' ') + ':00';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return s.replace('T', ' ');
  return null;
};

const wireUserMenu = () => {
  const btn = document.querySelector('.user-btn');
  const dd = $('#userDropdown');
  if (!btn || !dd) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const open = !dd.hasAttribute('hidden');
    if (open) dd.setAttribute('hidden', '');
    else dd.removeAttribute('hidden');
    try { btn.setAttribute('aria-expanded', open ? 'false' : 'true'); } catch {}
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.user-menu')) return;
    try { dd.setAttribute('hidden', ''); } catch {}
    try { btn.setAttribute('aria-expanded', 'false'); } catch {}
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
  if (!btn || !drawer || !backdrop) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  const close = () => {
    try { drawer.setAttribute('hidden', ''); backdrop.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); } catch {}
    try { document.body.classList.remove('drawer-open'); } catch {}
  };
  const open = () => {
    try { drawer.removeAttribute('hidden'); backdrop.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); } catch {}
    try { document.body.classList.add('drawer-open'); } catch {}
  };
  btn.addEventListener('click', (e) => { e.preventDefault(); if (drawer.hasAttribute('hidden')) open(); else close(); });
  closeBtn?.addEventListener('click', (e) => { e.preventDefault(); close(); });
  backdrop.addEventListener('click', (e) => { e.preventDefault(); close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
};

const pickLatestSegment = (segments) => {
  const arr = Array.isArray(segments) ? segments : [];
  if (!arr.length) return null;
  let best = arr[0];
  for (const s of arr) {
    const a = String(s?.checkIn || '');
    const b = String(best?.checkIn || '');
    if (a && a > b) best = s;
  }
  return best;
};

const renderForm = async () => {
  const host = $('#adjustFormHost');
  if (!host) return;
  host.innerHTML = `
    <div class="adjust-grid">
      <div class="adjust-label">対象日</div>
      <div><input id="adjDate" class="adjust-input" type="date" value="${todayISO()}"></div>

      <div class="adjust-label">現在の打刻</div>
      <div id="adjCurrent" style="color:#0f172a;font-weight:650;">—</div>

      <div class="adjust-label">修正(出勤)</div>
      <div><input id="adjIn" class="adjust-input" type="datetime-local"></div>

      <div class="adjust-label">修正(退勤)</div>
      <div><input id="adjOut" class="adjust-input" type="datetime-local"></div>

      <div class="adjust-label">理由(任意)</div>
      <div><input id="adjReason" class="adjust-input full" placeholder="例: 打刻し忘れ"></div>
    </div>
    <div class="adjust-actions">
      <button id="adjSubmit" class="btn" type="button">申請</button>
      <div id="adjStatus" class="adjust-status"></div>
    </div>
  `;

  const els = {
    date: $('#adjDate'),
    current: $('#adjCurrent'),
    in: $('#adjIn'),
    out: $('#adjOut'),
    reason: $('#adjReason'),
    submit: $('#adjSubmit'),
    status: $('#adjStatus')
  };

  const setCurrent = (seg) => {
    const el = els.current;
    if (!el) return;
    if (!seg) { el.textContent = '対象日の勤怠が見つかりません'; return; }
    const cin = String(seg.checkIn || '').slice(0, 16).replace('T', ' ');
    const cout = String(seg.checkOut || '').slice(0, 16).replace('T', ' ');
    el.textContent = `出勤: ${cin || '—'} / 退勤: ${cout || '—'}`;
  };

  let attendanceId = null;
  const loadDay = async () => {
    showErr('');
    const d = els.date?.value;
    if (!isISODate(d)) return;
    showSpinner();
    try {
      const r = await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(d)}`);
      const seg = pickLatestSegment(r?.segments);
      attendanceId = seg?.id || null;
      setCurrent(seg);
      try { if (els.in && seg?.checkIn) els.in.value = String(seg.checkIn).slice(0, 16); } catch {}
      try { if (els.out && seg?.checkOut) els.out.value = String(seg.checkOut).slice(0, 16); } catch {}
    } catch (e) {
      attendanceId = null;
      setCurrent(null);
      showErr(e?.message || '読み込みに失敗しました');
    } finally {
      hideSpinner();
    }
  };

  els.date?.addEventListener('change', loadDay);
  await loadDay();

  els.submit?.addEventListener('click', async () => {
    if (!els.submit || els.submit.disabled) return;
    showErr('');
    els.submit.disabled = true;
    if (els.status) els.status.textContent = '申請中…';
    const inV = toMySQLDateTime(els.in?.value);
    const outV = toMySQLDateTime(els.out?.value);
    const reason = String(els.reason?.value || '').trim();
    if (!attendanceId) {
      if (els.status) els.status.textContent = '';
      els.submit.disabled = false;
      showErr('対象日の勤怠が見つかりません');
      return;
    }
    if (!inV && !outV) {
      if (els.status) els.status.textContent = '';
      els.submit.disabled = false;
      showErr('修正(出勤)または修正(退勤)を入力してください');
      return;
    }
    showSpinner();
    try {
      await fetchJSONAuth('/api/adjust', { method: 'POST', body: JSON.stringify({ attendanceId, requestedCheckIn: inV, requestedCheckOut: outV, reason }) });
      if (els.status) els.status.textContent = '申請しました';
      await renderList();
    } catch (e) {
      if (els.status) els.status.textContent = '';
      showErr(e?.message || '申請に失敗しました');
    } finally {
      hideSpinner();
      try { if (els.submit) els.submit.disabled = false; } catch {}
    }
  });
};

const renderList = async () => {
  const host = $('#adjustListHost');
  if (!host) return;
  host.innerHTML = '<div style="color:#475569;font-weight:650;">履歴を読み込み中…</div>';
  showSpinner();
  try {
    const rows = await fetchJSONAuth('/api/adjust/my');
    if (!Array.isArray(rows) || rows.length === 0) {
      host.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>申請はありません</div></div>';
      return;
    }
    const tr = rows.map(r => {
      const cin = String(r.requestedCheckIn || '').slice(0, 16).replace('T', ' ');
      const cout = String(r.requestedCheckOut || '').slice(0, 16).replace('T', ' ');
      const st = String(r.status || 'pending');
      const color = st === 'approved' ? '#166534' : (st === 'rejected' ? '#991b1b' : '#0b2c66');
      return `<tr><td>${r.created_at ? String(r.created_at).slice(0, 16).replace('T', ' ') : '—'}</td><td>${cin || '—'}</td><td>${cout || '—'}</td><td style="color:${color};font-weight:650;">${esc(st)}</td><td>${esc(r.reason || '')}</td></tr>`;
    }).join('');
    host.innerHTML = `
      <h3 style="margin:0 0 10px;">申請履歴</h3>
      <div class="adjust-table-wrap">
        <table class="dash-table">
          <thead><tr><th>作成</th><th>修正(出勤)</th><th>修正(退勤)</th><th>状態</th><th>理由</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
  } catch (e) {
    host.innerHTML = `<div style="color:#b00020;font-weight:650;">取得失敗: ${esc(e?.message || 'unknown')}</div>`;
  } finally {
    hideSpinner();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const profile = await fetchJSONAuth('/api/auth/me');
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
  await renderForm();
  await renderList();
});
