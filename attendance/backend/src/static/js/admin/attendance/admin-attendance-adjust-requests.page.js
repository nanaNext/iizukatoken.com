// admin-attendance-adjust-requests.page.js
import { fetchJSONAuth } from '../../api/http.api.js';
import { wireAdminShell } from '../../shell/admin-shell.js';

const host = document.getElementById('adjustRequestsHost');

// Tháng hiện tại dạng "2026-04"
const nowDate = new Date();
let currentMonth = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

// Cache toàn bộ dữ liệu để lọc phía client không cần gọi API lại
let allRows = [];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDateTime(val) {
  if (!val) return '—';
  const s = String(val).slice(0, 16).replace('T', ' ');
  const [date, time] = s.split(' ');
  if (!date) return '—';
  return `<span class="dt-date">${date}</span><span class="dt-time">${time || ''}</span>`;
}

// Lấy tháng trước / tháng sau
function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Format "2026-04" → "2026年4月"
function fmtMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}年${m}月`;
}

async function checkAdminAuth() {
  try {
    const profile = await fetchJSONAuth('/api/auth/me');
    const role = String(profile?.role || '').toLowerCase();
    if (!profile || role !== 'admin') { window.location.replace('/ui/login'); return false; }
    const nameEl = document.querySelector('#userName');
    if (nameEl) nameEl.textContent = profile.username || profile.email || 'Admin';
    return true;
  } catch { window.location.replace('/ui/login'); return false; }
}

async function updateRequestStatus(id, status) {
  try {
    await fetchJSONAuth(`/api/adjust/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    // Cập nhật cache local thay vì gọi API lại
    const row = allRows.find(r => String(r.id) === String(id));
    if (row) row.status = status;
    renderTable();
  } catch (e) {
    alert('ステータス更新に失敗しました: ' + (e?.message || 'unknown'));
  }
}

function attachButtonListeners() {
  host.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('この申請を承認しますか？')) updateRequestStatus(id, 'approved');
    });
  });
  host.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      if (confirm('この申請を却下しますか？')) updateRequestStatus(id, 'rejected');
    });
  });
  host.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('この申請を削除しますか？この操作は取り消せません。')) return;
      try {
        await fetchJSONAuth(`/api/adjust/${id}`, { method: 'DELETE' });
        allRows = allRows.filter(r => String(r.id) !== String(id));
        renderTable();
      } catch (err) {
        alert('削除に失敗しました: ' + (err?.message || 'unknown'));
      }
    });
  });

  // Nút điều hướng tháng
  const btnPrev = document.getElementById('btnMonthPrev');
  const btnNext = document.getElementById('btnMonthNext');
  const btnNow  = document.getElementById('btnMonthNow');
  if (btnPrev) btnPrev.onclick = () => { currentMonth = shiftMonth(currentMonth, -1); renderTable(); };
  if (btnNext) btnNext.onclick = () => { currentMonth = shiftMonth(currentMonth,  1); renderTable(); };
  if (btnNow)  btnNow.onclick  = () => {
    const n = new Date();
    currentMonth = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    renderTable();
  };
}

function renderTable() {
  // Lọc theo tháng đã chọn (dựa vào created_at)
  const filtered = allRows.filter(r => {
    const ym = r.created_at ? String(r.created_at).slice(0, 7) : '';
    return ym === currentMonth;
  });

  const pendingCount = filtered.filter(r => r.status === 'pending').length;
  const isCurrentMonth = currentMonth === `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

  const tbody = filtered.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:28px;">この月の申請はありません</td></tr>`
    : filtered.map(r => {
        const user      = esc(r.username || r.email || r.userId || '—');
        const created   = fmtDateTime(r.created_at);
        const cin       = fmtDateTime(r.requestedCheckIn);
        const cout      = fmtDateTime(r.requestedCheckOut);
        const st        = String(r.status || 'pending');
        let stLabel, stClass, actionCell;        if (st === 'pending') {
          stLabel    = '確認待ち';
          stClass    = 'adj-status-pending';
          actionCell = `<button class="btn-approve" data-id="${r.id}">承認</button><button class="btn-reject" data-id="${r.id}">却下</button><button class="btn-delete" data-id="${r.id}">削除</button>`;
        } else if (st === 'approved') {
          stLabel = '承認済み'; stClass = 'adj-status-approved'; actionCell = `<button class="btn-delete" data-id="${r.id}">削除</button>`;
        } else {
          stLabel = '却下'; stClass = 'adj-status-rejected'; actionCell = `<button class="btn-delete" data-id="${r.id}">削除</button>`;
        }        return `<tr>
          <td>${user}</td>
          <td>${created}</td>
          <td>${cin}</td>
          <td>${cout}</td>
          <td>${esc(r.reason || '')}</td>
          <td><span class="${stClass}">${stLabel}</span></td>
          <td style="white-space:nowrap;">${actionCell}</td>
        </tr>`;
      }).join('');  host.innerHTML = `
    <div class="adj-month-nav">
      <button id="btnMonthPrev" class="adj-month-btn" title="前月">&#8249;</button>
      <span class="adj-month-label">
        ${fmtMonthLabel(currentMonth)}
        ${pendingCount > 0 ? `<span class="adj-pending-badge">${pendingCount}件 確認待ち</span>` : ''}
      </span>
      <button id="btnMonthNext" class="adj-month-btn" title="翌月">&#8250;</button>
      ${!isCurrentMonth ? `<button id="btnMonthNow" class="adj-month-today">今月</button>` : ''}
    </div>
    <div class="adj-table-card">
      <table class="adj-table">
        <colgroup>
          <col style="width:13%">
          <col style="width:13%">
          <col style="width:13%">
          <col style="width:13%">
          <col style="width:19%">
          <col style="width:12%">
          <col style="width:17%">
        </colgroup>
        <thead>
          <tr>
            <th>ユーザー</th>
            <th>作成</th>
            <th>修正(出勤)</th>
            <th>修正(退勤)</th>
            <th>理由</th>
            <th>状態</th>
            <th>アクション</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;

  attachButtonListeners();
}

async function renderList() {
  if (!host) return;
  host.innerHTML = '<div style="color:#475569;padding:16px;">読み込み中…</div>';
  try {
    allRows = await fetchJSONAuth('/api/adjust/admin');
    if (!Array.isArray(allRows)) allRows = [];
    renderTable();
  } catch (e) {
    host.innerHTML = `<div style="color:#b00020;padding:16px;">取得失敗: ${esc(e?.message || 'unknown')}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  wireAdminShell();
  const isAdmin = await checkAdminAuth();
  if (isAdmin) await renderList();
});
