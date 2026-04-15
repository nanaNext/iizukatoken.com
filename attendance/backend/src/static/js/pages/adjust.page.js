import { logout } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
  } catch { }
};
const hideSpinner = () => {
  try {
    const el = document.querySelector('#pageSpinner');
    spinnerCount = Math.max(0, spinnerCount - 1);
    if (spinnerCount !== 0) return;
    if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; }
  } catch { }
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
    try { btn.setAttribute('aria-expanded', open ? 'false' : 'true'); } catch { }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.user-menu')) return;
    try { dd.setAttribute('hidden', ''); } catch { }
    try { btn.setAttribute('aria-expanded', 'false'); } catch { }
  });
  const logoutBtn = $('#btnLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await logout(); } catch { }
      try { sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('user'); } catch { }
      try { localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); } catch { }
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
    try { drawer.setAttribute('hidden', ''); backdrop.setAttribute('hidden', ''); btn.setAttribute('aria-expanded', 'false'); } catch { }
    try { document.body.classList.remove('drawer-open'); } catch { }
  };
  const open = () => {
    try { drawer.removeAttribute('hidden'); backdrop.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); } catch { }
    try { document.body.classList.add('drawer-open'); } catch { }
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
      try { if (els.in && seg?.checkIn) els.in.value = String(seg.checkIn).slice(0, 16); } catch { }
      try { if (els.out && seg?.checkOut) els.out.value = String(seg.checkOut).slice(0, 16); } catch { }
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
    if (els.status) els.status.textContent = (els.submit.dataset.editId ? '更新中…' : '申請中…');
    const inV = toMySQLDateTime(els.in?.value);
    const outV = toMySQLDateTime(els.out?.value);
    const reason = String(els.reason?.value || '').trim();
    const editId = parseInt(String(els.submit?.dataset?.editId || 0), 10) || null;
    if (!attendanceId && !editId) {
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
      if (editId) {
        await fetchJSONAuth(`/api/adjust/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify({ requestedCheckIn: inV, requestedCheckOut: outV, reason })
        });
        if (els.status) els.status.textContent = '更新しました';
      } else {
        await fetchJSONAuth('/api/adjust', { method: 'POST', body: JSON.stringify({ attendanceId, requestedCheckIn: inV, requestedCheckOut: outV, reason }) });
        if (els.status) els.status.textContent = '申請しました';
      }
      try { delete els.submit.dataset.editId; els.submit.textContent = '申請'; } catch {}
      await renderList();
    } catch (e) {
      if (els.status) els.status.textContent = '';
      showErr(e?.message || '申請に失敗しました');
    } finally {
      hideSpinner();
      try { if (els.submit) els.submit.disabled = false; } catch { }
    }
  });
};

const renderList = async () => {
  const host = $('#adjustListHost');
  if (!host) return;
  host.innerHTML = '<div style="color:#475569;font-weight:650;">履歴を読み込み中…</div>';
  showSpinner();
  try {
    const [rows, profile] = await Promise.all([
      fetchJSONAuth('/api/adjust/my'),
      fetchJSONAuth('/api/auth/me').catch(() => null)
    ]);
    if (!Array.isArray(rows) || rows.length === 0) {
      host.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>申請はありません</div></div>';
      return;
    }
    // Thêm input chọn tháng nếu chưa có
    let selectedMonth = '';
    const now = new Date();
    selectedMonth = now.toISOString().slice(0, 7); // yyyy-MM

    const monthInput = document.getElementById('adjustMonthFilter');
    if (monthInput && monthInput.value) {
      selectedMonth = monthInput.value;
    }

    // Lọc dữ liệu theo tháng được chọn
    const filteredRows = rows.filter(r => {
      const created = r.created_at ? String(r.created_at).slice(0, 7) : '';
      return created === selectedMonth;
    });

    if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
      host.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>申請はありません</div></div>';
      return;
    }

    const tr = filteredRows.map((r, idx) => {
      const cin  = String(r.requestedCheckIn  || '').slice(0, 16).replace('T', ' ');
      const cout = String(r.requestedCheckOut || '').slice(0, 16).replace('T', ' ');
      const st = String(r.status || 'pending');
      let stLabel, stClass;
      if (st === 'approved') { stLabel = '承認済み'; stClass = 'adj-status-approved'; }
      else if (st === 'rejected') { stLabel = '却下'; stClass = 'adj-status-rejected'; }
      else { stLabel = '承認待ち'; stClass = 'adj-status-pending'; }
      const created = r.created_at ? String(r.created_at).slice(0, 16).replace('T', ' ') : '—';
      const staff = profile?.username || profile?.email || '';
      const appNo = `R-${String(r.id).padStart(7, '0')}`;
      const detail = r.reason ? `${r.reason}` : '';
      const type = '打刻修正（申請）';
      const actions = st === 'pending'
        ? `<button class="btn-edit" data-id="${r.id}" data-in="${cin}" data-out="${cout}" data-reason="${esc(r.reason || '')}">編集</button><button class="btn-delete" data-id="${r.id}">削除</button>`
        : '';
      return `<tr>
        <td class="adj-col-id"><a href="#" data-jump="${r.id}">${appNo}</a></td>
        <td class="adj-col-status"><span class="${stClass}">${esc(stLabel)}</span></td>
        <td class="adj-col-type">${type}</td>
        <td class="adj-col-detail">${esc(detail)}</td>
        <td class="adj-col-staff">${esc(staff)}</td>
        <td class="adj-col-office">—</td>
        <td class="adj-col-created">${created}</td>
        <td class="adj-col-actions">${actions}</td>
      </tr>`;
    }).join('');
    host.innerHTML = `
      <div class="adj-list-header-row">
        <h3 class="adj-list-title">申請</h3>
        <div class="adj-toolbar">
          <input id="adjustSearch" placeholder="このリストを検索…" class="adj-search-input">
          <input type="month" id="adjustMonthFilter" class="adj-month-input" value="${selectedMonth}">
          <button id="adjustNewBtn" class="btn-neutral">新規</button>
        </div>
      </div>
      <div class="adj-table-card">
        <table class="adj-table adj-wide">
          <thead>
            <tr>
              <th class="adj-col-id">申請番号</th>
              <th class="adj-col-status">ステータス</th>
              <th class="adj-col-type">レコードタイプ</th>
              <th class="adj-col-detail">申請詳細</th>
              <th class="adj-col-staff">スタッフ名</th>
              <th class="adj-col-office">申請者所属オフィス</th>
              <th class="adj-col-created">作成日時</th>
              <th class="adj-col-actions">アクション</th>
            </tr>
          </thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
    // Gắn lại sự kiện onchange cho input tháng
    setTimeout(() => {
      const monthFilter = document.getElementById('adjustMonthFilter');
      if (monthFilter) {
        monthFilter.addEventListener('change', renderList);
      }
      const searchInput = document.getElementById('adjustSearch');
      if (searchInput) {
        let t = 0;
        searchInput.addEventListener('input', () => {
          try { clearTimeout(t); } catch {}
          t = setTimeout(() => {
            const q = String(searchInput.value || '').trim().toLowerCase();
            const rows = host.querySelectorAll('.adj-table tbody tr');
            rows.forEach(tr => {
              const text = tr.textContent.toLowerCase();
              tr.style.display = text.includes(q) ? '' : 'none';
            });
          }, 180);
        });
      }
      const newBtn = document.getElementById('adjustNewBtn');
      if (newBtn) {
        newBtn.addEventListener('click', () => {
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
          try { document.getElementById('adjReason')?.focus(); } catch {}
        });
      }
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (!confirm('この申請を削除しますか？')) return;
          try {
            await fetchJSONAuth(`/api/adjust/${id}`, { method: 'DELETE' });
            await renderList();
          } catch (err) {
            alert(String(err?.message || '削除に失敗しました'));
          }
        });
      });
      document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          const cin = e.currentTarget.dataset.in || '';
          const cout = e.currentTarget.dataset.out || '';
          const reason = e.currentTarget.dataset.reason || '';
          const inEl = document.getElementById('adjIn');
          const outEl = document.getElementById('adjOut');
          const rsEl = document.getElementById('adjReason');
          if (inEl) inEl.value = cin.replace(' ', 'T');
          if (outEl) outEl.value = cout.replace(' ', 'T');
          if (rsEl) rsEl.value = reason;
          try { document.getElementById('adjSubmit').textContent = '更新'; } catch {}
          try { document.getElementById('adjSubmit').dataset.editId = id; } catch {}
          const statusEl = document.getElementById('adjStatus');
          if (statusEl) statusEl.textContent = '編集モード';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });
    }, 0);
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
    // Admin không được tạo request, chỉ được xét duyệt
    if (!profile || !(role === 'employee' || role === 'manager')) {
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
