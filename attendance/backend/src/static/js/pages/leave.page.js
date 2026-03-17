import { myPaidBalance, applyPaidLeave, listMyRequests } from '../api/leave.api.js';

const $ = (sel) => document.querySelector(sel);

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
    const tr = rows.map(r => `<tr><td>${r.startDate}〜${r.endDate}</td><td>${r.type}</td><td>${r.status}</td></tr>`).join('');
    const tbl = `
      <h3>申請履歴</h3>
      <table style="width:100%">
        <thead><tr><th>期間</th><th>種類</th><th>状態</th></tr></thead>
        <tbody>${tr}</tbody>
      </table>
    `;
    box.innerHTML = tbl;
  } catch (err) {
    box.innerHTML = '履歴取得失敗: ' + (err?.message || 'error');
  }
}

function initApply() {
  const form = $('#applyForm');
  const result = $('#applyResult');
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
