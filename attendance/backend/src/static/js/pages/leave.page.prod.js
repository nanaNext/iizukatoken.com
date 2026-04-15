import { myPaidBalance, applyPaidLeave, listMyRequests } from '../api/leave.api.js';

const $ = (sel) => document.querySelector(sel);

const draftKey = () => {
  const path = String(window.location.pathname || '');
  return `se.leaveDraft.v1:${path}`;
};

const loadDraft = () => {
  try {
    const raw = localStorage.getItem(draftKey());
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
};

const saveDraft = () => {
  try {
    const form = $('#applyForm');
    if (!form) return;
    const payload = {
      savedAt: Date.now(),
      startDate: String($('#startDate')?.value || ''),
      endDate: String($('#endDate')?.value || ''),
      reason: String($('#reason')?.value || '')
    };
    localStorage.setItem(draftKey(), JSON.stringify(payload));
  } catch {}
};

const clearDraft = () => {
  try { localStorage.removeItem(draftKey()); } catch {}
};

async function renderBalance() {
  const box = $('#balance');
  box.innerHTML = '<div>残数を読み込み中…</div>';
  try {
    const r = await myPaidBalance();
    const g = r.grants || [];
    const rows = g.map(it => `<tr><td>${it.grantDate}</td><td>${it.expiryDate}</td><td>${it.daysGranted}</td><td>${it.daysRemaining}</td></tr>`).join('');
    box.innerHTML = `
      <h3>残数</h3>
      <div>付与合計: <strong>${g.reduce((s,it)=>s+it.daysGranted,0)}</strong>日</div>
      <div>使用日数: <strong>${r.usedDays || 0}</strong>日</div>
      <div>残日数: <strong>${r.totalAvailable}</strong>日</div>
      <div>取得義務(年5日) 残り: <strong>${Math.max(0, (r.obligation?.remaining || 0))}</strong>日</div>
      <table style="width:100%;margin-top:8px">
        <thead><tr><th>付与日</th><th>期限</th><th>付与</th><th>残</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    await renderMyRequests();
  } catch (e) {
    box.innerHTML = `<div style="color:#b00">取得失敗: ${e?.message || 'error'}</div>`;
  }
}

async function renderMyRequests() {
  const box = $('#applyResult');
  try {
    const rows = await listMyRequests();
    const tr = rows.map((r, i) => {
      const no = `R-${String(i + 1).padStart(7, '0')}`;
      const type = r.type || '—';
      const status = String(r.status || '').toLowerCase();
      const label = status === 'approved' ? '承認済み' : status === 'rejected' ? '却下' : '承認待ち';
      const cls = status === 'approved' ? 'adj-status-approved' : status === 'rejected' ? 'adj-status-rejected' : 'adj-status-pending';
      return `
        <tr>
          <td style="white-space:nowrap;"><a href="#">${no}</a></td>
          <td><span class="${cls}">${label}</span></td>
          <td>${type}</td>
          <td>${r.startDate || ''} 〜 ${r.endDate || ''}</td>
        </tr>
      `;
    }).join('');
    box.innerHTML = `
      <div class="adjust-list-header-row">
        <h3 class="adj-list-title">申請一覧</h3>
        <div class="adj-toolbar">
          <input id="leaveSearch" placeholder="このリストを検索…" class="adj-search-input">
        </div>
      </div>
      <div class="adj-table-card">
        <table class="adj-table">
          <thead><tr><th>申請番号</th><th>ステータス</th><th>レコードタイプ</th><th>期間</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
    const q = document.getElementById('leaveSearch');
    if (q) {
      let t = 0;
      q.addEventListener('input', () => {
        try { clearTimeout(t); } catch {}
        t = setTimeout(() => {
          const text = String(q.value || '').trim().toLowerCase();
          box.querySelectorAll('.adj-table tbody tr').forEach(tr => {
            const hit = tr.textContent.toLowerCase().includes(text);
            tr.style.display = hit ? '' : 'none';
          });
        }, 180);
      });
    }
  } catch (err) {
    box.innerHTML = '履歴取得失敗: ' + (err?.message || 'error');
  }
}

function initApply() {
  const form = $('#applyForm');
  const result = $('#applyResult');
  const d = loadDraft();
  if (d) {
    try { if (d.startDate) $('#startDate').value = d.startDate; } catch {}
    try { if (d.endDate) $('#endDate').value = d.endDate; } catch {}
    try { if (d.reason != null) $('#reason').value = d.reason; } catch {}
  }
  try {
    const g = globalThis;
    if (!Array.isArray(g.__draftFlushers)) g.__draftFlushers = [];
    g.__draftFlushers.push(saveDraft);
  } catch {}
  let t = 0;
  const schedule = () => {
    try { clearTimeout(t); } catch {}
    t = setTimeout(saveDraft, 400);
  };
  form.addEventListener('input', schedule);
  form.addEventListener('change', schedule);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDate = $('#startDate').value;
    const endDate = $('#endDate').value;
    const reason = $('#reason').value || '';
    if (!startDate || !endDate) {
      result.textContent = '日付を選択してください';
      return;
    }
    try {
      await applyPaidLeave({ startDate, endDate, reason });
      result.textContent = '申請しました';
      clearDraft();
      await renderBalance();
    } catch (err) {
      result.textContent = '申請失敗: ' + (err?.message || 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initApply();
  await renderBalance();
});
