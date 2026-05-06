import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);
const todayMonth = () => new Date().toISOString().slice(0, 7);

const fmtStatus = (v) => {
  const s = String(v || '').toLowerCase();
  if (s === 'approved') return '承認済み';
  if (s === 'applied') return '申請中';
  if (s === 'rejected') return '差戻し';
  return s || '-';
};

const render = async () => {
  const host = $('#adminContent');
  if (!host) return;
  const params = new URLSearchParams(window.location.search || '');
  const month = params.get('month') || todayMonth();
  const userId = params.get('userId') || '';

  host.className = '';
  host.style.maxWidth = 'none';
  host.style.width = '100%';
  host.style.margin = '0';
  host.style.padding = '0';
  host.innerHTML = `
    <div class="exp-month-detail">
      <style>
        .exp-month-detail { display:grid; gap:10px; color:#0f172a; }
        .exp-month-detail .head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .exp-month-detail .title { margin:0; font-size:20px; font-weight:700; }
        .exp-month-detail .meta { color:#475569; font-size:13px; }
        .exp-month-detail .btn { height:32px; padding:0 12px; border:1px solid #cbd5e1; background:#fff; border-radius:0; cursor:pointer; }
        .exp-month-detail .table-wrap { border:1px solid #dbe3ee; border-radius:0; background:#fff; overflow:hidden; }
        .exp-month-detail table { width:100%; border-collapse:collapse; border-spacing:0; }
        .exp-month-detail th, .exp-month-detail td { border:1px solid #e5eaf2; padding:10px 12px; font-size:13px; }
        .exp-month-detail th { background:#f8fafc; text-align:left; }
      </style>
      <div class="head">
        <h3 class="title">交通費申請詳細</h3>
        <button id="backToExpenseList" class="btn" type="button">一覧へ戻る</button>
      </div>
      <div id="detailMeta" class="meta"></div>
      <div id="detailTableHost"></div>
    </div>
  `;

  const meta = $('#detailMeta');
  const tableHost = $('#detailTableHost');
  const backBtn = $('#backToExpenseList');
  backBtn?.addEventListener('click', () => {
    try { window.location.assign('/admin/expenses'); } catch { window.location.href = '/admin/expenses'; }
  });

  try {
    const [usersRes, rowsRes] = await Promise.all([
      fetchJSONAuth('/api/admin/users'),
      fetchJSONAuth(`/api/expenses/admin/list?month=${encodeURIComponent(month)}&userId=${encodeURIComponent(userId)}&page=1&limit=1000&sortBy=date&sortDir=desc`)
    ]);
    const users = Array.isArray(usersRes) ? usersRes : [];
    const rows = Array.isArray(rowsRes) ? rowsRes : (Array.isArray(rowsRes?.rows) ? rowsRes.rows : []);
    const nameMap = new Map(users.map((u) => [String(u.id), (u.username || u.email || String(u.id))]));
    const selectedName = nameMap.get(String(userId)) || String(userId || '全員');
    if (meta) meta.textContent = `対象: ${selectedName} / ${month}`;
    if (!rows.length) {
      if (tableHost) tableHost.innerHTML = '<div class="table-wrap"><table><tbody><tr><td>データがありません</td></tr></tbody></table></div>';
      return;
    }
    const body = rows.map((r) => {
      const d = String(r.date || '').slice(0, 10);
      const route = [r.origin || '', r.via || '', r.destination || ''].filter(Boolean).join(' → ') || '-';
      const amount = Number(r.amount || 0).toLocaleString('ja-JP');
      const status = fmtStatus(r.status);
      return `<tr>
        <td>${d}</td>
        <td>${route}</td>
        <td style="text-align:right;">${amount}</td>
        <td>${status}</td>
      </tr>`;
    }).join('');
    if (tableHost) {
      tableHost.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>日付</th><th>経路</th><th>金額</th><th>状態</th></tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `;
    }
  } catch (e) {
    if (meta) meta.textContent = `取得失敗: ${String(e?.message || 'unknown')}`;
  }
};

export async function mount() {
  const profile = await requireAdmin();
  if (!profile) return;
  return await render();
}
