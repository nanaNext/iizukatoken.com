import { requireAdmin } from '../_shared/require-admin.js';
import { fetchJSONAuth } from '../../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

const showSpinner = () => {
  try { const el = document.querySelector('#pageSpinner'); if (el) { el.removeAttribute('hidden'); el.style.display = 'flex'; } } catch {}
};
const hideSpinner = () => {
  try { const el = document.querySelector('#pageSpinner'); if (el) { el.setAttribute('hidden', ''); el.style.display = 'none'; } } catch {}
};

const todayMonth = () => new Date().toISOString().slice(0, 7);
const fmtDT = (v) => {
  if (!v) return '';
  try {
    const d = typeof v === 'string' ? new Date(v) : v;
    if (!d || isNaN(d.getTime())) return String(v).replace('T',' ').slice(0,16);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch { return String(v).replace('T',' ').slice(0,16); }
};

const render = async () => {
  const host = $('#adminContent');
  if (!host) return;
  const globalStatus = document.getElementById('status');
  if (globalStatus) { globalStatus.textContent = ''; globalStatus.style.display = 'none'; }
  host.className = 'card';
  host.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;">
      <h3 style="margin:0 0 12px;">交通費計算管理</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <label for="expMonth" style="color:#475569;font-weight:650;">対象月</label>
        <input id="expMonth" type="month" style="height:32px;padding:4px 8px;">
        <label for="expUserFilter" style="color:#475569;font-weight:650;margin-left:12px;">社員</label>
        <select id="expUserFilter" style="height:32px;padding:4px 8px;">
          <option value="">全員</option>
        </select>
        <button id="expReload" class="btn" type="button" style="height:32px;">再読込</button>
      </div>
      <div id="chatNotice" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;margin-bottom:12px;">
        <div style="font-weight:800;color:#0b2c66;margin-bottom:6px;">チャット通知</div>
        <div id="chatList" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
      <div id="expStatus" style="color:#64748b;font-weight:600;margin-bottom:6px;"></div>
      <div id="expTableHost"></div>
    </div>
  `;
  const m = $('#expMonth');
  if (m) m.value = todayMonth();
  const reload = async () => {
    const month = $('#expMonth') ? $('#expMonth').value : todayMonth();
    const status = $('#expStatus');
    const tableHost = $('#expTableHost');
    if (tableHost) tableHost.innerHTML = '';
    if (status) status.textContent = '読み込み中…';
    showSpinner();
    try {
      const [rowsRes, usersRes, chatsRes] = await Promise.allSettled([
        fetchJSONAuth(`/api/expenses/admin/list?month=${encodeURIComponent(month)}`),
        fetchJSONAuth('/api/admin/users'),
        fetchJSONAuth(`/api/expenses/admin/messages?month=${encodeURIComponent(month)}`)
      ]);
      const rows = rowsRes.status === 'fulfilled' && Array.isArray(rowsRes.value) ? rowsRes.value : [];
      const users = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
      const chats = chatsRes.status === 'fulfilled' && Array.isArray(chatsRes.value) ? chatsRes.value : [];
      const nameMap = new Map(users.map(u => [String(u.id), u.username || u.email || '']));
      const uf = $('#expUserFilter');
      if (uf && !uf.dataset.bound) {
        uf.dataset.bound = '1';
        uf.innerHTML = '<option value="">全員</option>' + users.map(u => `<option value="${String(u.id)}">${u.username || u.email || String(u.id)}</option>`).join('');
        uf.addEventListener('change', reload);
      }
      const selUser = uf ? (uf.value || '') : '';
      const filteredRows = selUser ? rows.filter(r => String(r.userId) === String(selUser)) : rows;
      const chatList = $('#chatList');
      if (chatList) {
        chatList.innerHTML = chats.length
          ? chats.slice(0, 10).map(c => {
              const sender = c.sender_name || '';
              const emp = c.employee_name || '';
              const dt = fmtDT(c.created_at);
              const route = [c.origin || '', c.via || '', c.destination || ''].filter(Boolean).join('→');
              const purpose = c.purpose || '';
              return `<div data-exp-id="${String(c.expense_id)}" style="display:flex;gap:8px;align-items:center;">
                <span style="color:#334155;font-size:12px;">${dt}</span>
                <span style="color:#1f2937;font-weight:700;">${sender}</span>
                <span style="color:#64748b;">→</span>
                <span style="color:#1f2937;">${emp}</span>
                <span style="color:#334155;flex:1;">${route} ${purpose ? ('／目的: ' + purpose) : ''}</span>
                <button class="btn" data-action="open-chat" style="height:28px;">表示</button>
              </div>`;
            }).join('')
          : '<div style="color:#64748b;">通知なし</div>';
        chatList.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-action="open-chat"]');
          if (!b) return;
          const wrap = b.closest('div[data-exp-id]');
          const expId = wrap ? wrap.getAttribute('data-exp-id') : '';
          if (!expId) return;
          const tbody = tableHost.querySelector('tbody');
          const rowEl = tbody ? tbody.querySelector(`tr[data-id="${CSS.escape(String(expId))}"]`) : null;
          if (!rowEl) return;
          const fakeBtn = document.createElement('button');
          fakeBtn.setAttribute('data-action','chat');
          rowEl.dispatchEvent(new CustomEvent('click', { bubbles: true, detail: { proxyButton: true }, composed: true }));
        });
      }
      if (!filteredRows.length) {
        if (tableHost) tableHost.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>データはありません</div></div>';
      } else {
        const thead = '<thead><tr><th>ユーザー</th><th>日付</th><th>種別</th><th>出発</th><th>到着</th><th>金額</th><th>状態</th><th>領収書</th><th>操作</th></tr></thead>';
        const rowsHtml = filteredRows.map(r => {
          const d = String(r.date || '').slice(0, 10);
          const a = Number(r.amount || 0).toLocaleString('ja-JP');
          const user = nameMap.get(String(r.userId)) || String(r.userId || '');
          const st = String(r.status || 'pending');
          const id = String(r.id || '');
          const applied = r.applied_at ? fmtDT(r.applied_at) : '';
          const approved = r.approved_at ? fmtDT(r.approved_at) : '';
          const timeHtml =
            st === 'applied' ? (applied ? `<div style="color:#6b7280;font-size:12px;">申請: ${applied}</div>` : '') :
            st === 'approved' ? (approved ? `<div style="color:#6b7280;font-size:12px;">承認: ${approved}</div>` : '') :
            st === 'rejected' ? (approved ? `<div style="color:#6b7280;font-size:12px;">却下: ${approved}</div>` : '') : '';
          const approver = r.approver_id ? (nameMap.get(String(r.approver_id)) || '') : '';
          const whoHtml = approver ? `<div style="color:#6b7280;font-size:12px;">担当: ${approver}</div>` : '';
          const empNote = r.employee_note ? `<div style="color:#334155;font-size:12px;">社員理由: ${String(r.employee_note)}</div>` : '';
          const ru = r.receipt_url ? String(r.receipt_url) : (r.first_file_path ? String(r.first_file_path) : '');
          const ruAttr = ru ? ` data-url="${ru}"` : '';
          const count = Number(r.file_count || 0);
          const ruInline = ru ? `<a href="${ru.startsWith('/')?ru:'/'+ru}" class="receipt-link" data-count="${String(count)}" target="_blank" rel="noopener" style="font-size:12px;color:#1e40af;text-decoration:none;">表示${count>1?`(${count}件)`:''}</a>` : (count>0 ? `<button class="btn" data-action="files" type="button" style="height:24px;">表示(${count}件)</button>` : '<span style="color:#64748b;font-size:12px;">なし</span>');
          return `
            <tr data-id="${id}">
              <td>${user}</td>
              <td>${d}</td>
              <td>${r.type || ''}</td>
              <td>${r.origin || ''}</td>
              <td>${r.destination || ''}</td>
              <td style="text-align:right;">${a}</td>
              <td><span class="dash-pill">${st}</span>${timeHtml}${whoHtml}${empNote}</td>
              <td><button class="icon-btn" data-action="files"${ruAttr} aria-label="領収書"><img src="/static/images/paperclip.png" alt=""></button>${ruInline}</td>
              <td>
                <button class="btn" data-action="edit" style="height:28px;">編集</button>
                <button class="btn" data-action="approve" style="height:28px;">承認</button>
                <button class="btn" data-action="reject" style="height:28px;">却下</button>
                <button class="btn" data-action="delete" style="height:28px;">削除</button>
                <button class="btn" data-action="chat" style="height:28px;">チャット</button>
              </td>
            </tr>`;
        }).join('');
        const tbl = `
          <div class="adj-table-card">
            <table class="adj-table">
              ${thead}
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
        tableHost.innerHTML = tbl;
        const tbody = tableHost.querySelector('tbody');
        if (tbody && !tbody.dataset.bound) {
          tbody.dataset.bound = '1';
          tbody.addEventListener('click', async (e) => {
            const link = e.target.closest('a.receipt-link');
            const rowEl2 = e.target.closest('tr[data-id]');
            if (link && rowEl2) {
              const c = parseInt(String(link.getAttribute('data-count')||'0'),10);
              if (c>1) {
                e.preventDefault();
                const filesBtn = rowEl2.querySelector('button[data-action="files"]');
                filesBtn?.click();
                return;
              }
            }
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const rowEl3 = btn.closest('tr[data-id]');
            const id = rowEl3 ? rowEl3.getAttribute('data-id') : '';
            if (!id) return;
            const action = btn.getAttribute('data-action');
            const status = action === 'approve' ? 'approved' : 'rejected';
            btn.disabled = true;
            try {
              if (action === 'approve' || action === 'reject') {
                let note = '';
                if (action === 'reject') {
                  note = window.prompt('却下理由を入力してください（必須）', '') || '';
                }
                await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/status`, { method:'PATCH', body: JSON.stringify({ status, note }) });
                await reload();
              } else if (action === 'edit') {
                const ensureEditModal = () => {
                  let modal = document.getElementById('adminEditModal');
                  if (modal) return modal;
                  modal = document.createElement('div');
                  modal.id = 'adminEditModal';
                  modal.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);width:720px;max-width:95%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 24px 48px rgba(0,0,0,.16);padding:16px;display:none;z-index:1400;';
                  modal.innerHTML = `
                    <div style="font-weight:800;color:#0b2c66;margin-bottom:8px;">編集（管理）</div>
                    <div class="adjust-grid" style="grid-template-columns: 120px 1fr;">
                      <div class="adjust-label">日付</div><div><input id="adDate" type="date" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">費目</div><div><select id="adType" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"><option value="train">電車</option><option value="bus">バス</option><option value="taxi">タクシー</option><option value="private_car">自家用車</option><option value="parking">駐車場</option><option value="highway">高速道路</option></select></div>
                      <div class="adjust-label">出発</div><div><input id="adOrigin" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">経由</div><div><input id="adVia" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">到着</div><div><input id="adDestination" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">片道/往復</div><div><select id="adTripType" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"><option value="one_way">片道</option><option value="round_trip">往復</option></select></div>
                      <div class="adjust-label">回数</div><div><input id="adTripCount" type="number" min="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">距離(km)</div><div><input id="adKm" type="number" step="0.1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">単価</div><div><input id="adUnitPrice" type="number" step="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">目的</div><div><input id="adPurpose" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">定期</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="adTeiki" type="checkbox"><span>定期区間内</span></label></div>
                      <div class="adjust-label">通勤</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="adCommuter" type="checkbox"><span>通勤パス</span></label></div>
                      <div class="adjust-label">金額</div><div><input id="adAmount" type="number" step="1" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                      <div class="adjust-label">メモ</div><div><input id="adMemo" class="adjust-input" style="background:#fff;border:1px solid #cbd5e1;"></div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                      <button id="adCancel" class="btn" type="button" style="height:32px;">キャンセル</button>
                      <button id="adSave" class="btn btn-primary" type="button" style="height:32px;">保存</button>
                      <button id="adApply" class="btn" type="button" style="height:32px;">申請</button>
                    </div>
                  `;
                  document.body.appendChild(modal);
                  return modal;
                };
                const openEdit = async (recId) => {
                  const modal = ensureEditModal();
                  const backdrop = document.getElementById('drawerBackdrop');
                  try {
                    const r = filteredRows.find(x => String(x.id) === String(recId)) || await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`);
                    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
                    set('adDate', r.date ? String(r.date).slice(0,10) : todayMonth()+'-01');
                    set('adType', r.type || (r.category || 'train'));
                    set('adOrigin', r.origin || '');
                    set('adVia', r.via || '');
                    set('adDestination', r.destination || '');
                    set('adTripType', r.trip_type || 'one_way');
                    set('adTripCount', r.trip_count != null ? String(r.trip_count) : '1');
                    set('adKm', r.distance_km != null ? String(r.distance_km) : '');
                    set('adUnitPrice', r.unit_price_per_km != null ? String(r.unit_price_per_km) : '');
                    set('adPurpose', r.purpose || '');
                    try { const c1 = document.getElementById('adTeiki'); if (c1) c1.checked = !!r.teiki_flag; } catch {}
                    try { const c2 = document.getElementById('adCommuter'); if (c2) c2.checked = !!r.commuter_pass; } catch {}
                    set('adAmount', r.amount != null ? String(r.amount) : '');
                    set('adMemo', r.memo || '');
                  } catch {}
                  if (backdrop) { backdrop.removeAttribute('hidden'); backdrop.style.display='block'; }
                  modal.style.display = 'block';
                  const onCancel = () => { modal.style.display='none'; if (backdrop){backdrop.setAttribute('hidden',''); backdrop.style.display='none';} cleanup(); };
                  const onSave = async () => {
                    const payload = {
                      date: document.getElementById('adDate')?.value,
                      type: document.getElementById('adType')?.value,
                      origin: document.getElementById('adOrigin')?.value,
                      via: document.getElementById('adVia')?.value,
                      destination: document.getElementById('adDestination')?.value,
                      trip_type: document.getElementById('adTripType')?.value,
                      trip_count: parseInt(String(document.getElementById('adTripCount')?.value||'1'),10),
                      distance_km: parseFloat(String(document.getElementById('adKm')?.value||'')),
                      unit_price_per_km: parseFloat(String(document.getElementById('adUnitPrice')?.value||'')),
                      purpose: document.getElementById('adPurpose')?.value,
                      teiki_flag: !!document.getElementById('adTeiki')?.checked,
                      commuter_pass: !!document.getElementById('adCommuter')?.checked,
                      amount: parseFloat(String(document.getElementById('adAmount')?.value||'')),
                      memo: document.getElementById('adMemo')?.value
                    };
                    try {
                      const current = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`);
                      const changed = [];
                      const cmp = (k, nv, ov) => { const n = nv==null?'':String(nv); const o = ov==null?'':String(ov); if (n!==o) changed.push(`${k}: ${o} → ${n}`); };
                      cmp('日付', payload.date, current.date ? String(current.date).slice(0,10) : '');
                      cmp('費目', payload.type, current.type || current.category);
                      cmp('出発', payload.origin, current.origin);
                      cmp('経由', payload.via, current.via);
                      cmp('到着', payload.destination, current.destination);
                      cmp('片道/往復', payload.trip_type, current.trip_type);
                      cmp('回数', payload.trip_count, current.trip_count);
                      cmp('距離(km)', payload.distance_km, current.distance_km);
                      cmp('単価', payload.unit_price_per_km, current.unit_price_per_km);
                      cmp('目的', payload.purpose, current.purpose);
                      cmp('定期', payload.teiki_flag, current.teiki_flag);
                      cmp('通勤', payload.commuter_pass, current.commuter_pass);
                      cmp('金額', payload.amount, current.amount);
                      cmp('メモ', payload.memo, current.memo);
                      const msg = changed.length ? ('変更内容:\n' + changed.join('\n') + '\n保存しますか？') : '変更はありません。保存しますか？';
                      const ok = window.confirm(msg);
                      if (!ok) return;
                    } catch {}
                    try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`, { method:'PATCH', body: JSON.stringify(payload) }); await reload(); onCancel(); } catch (errU) {
                      const status = document.getElementById('expStatus');
                      if (status) {
                        status.textContent = `更新に失敗しました: ${String(errU?.message || 'unknown')}`;
                        status.style.display = 'block';
                        status.style.color = '#b00020';
                      }
                    }
                  };
                  const onApply = async () => {
                    try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}/apply`, { method:'POST' }); await reload(); onCancel(); } catch (errA) {
                      const status = document.getElementById('expStatus');
                      if (status) {
                        status.textContent = `申請に失敗しました: ${String(errA?.message || 'unknown')}`;
                        status.style.display = 'block';
                        status.style.color = '#b00020';
                      }
                    }
                  };
                  const cancelBtn = document.getElementById('adCancel');
                  const saveBtn = document.getElementById('adSave');
                  const applyBtn = document.getElementById('adApply');
                  cancelBtn?.addEventListener('click', onCancel);
                  saveBtn?.addEventListener('click', onSave);
                  applyBtn?.addEventListener('click', onApply);
                  const cleanup = () => {
                    cancelBtn?.removeEventListener('click', onCancel);
                    saveBtn?.removeEventListener('click', onSave);
                    applyBtn?.removeEventListener('click', onApply);
                  };
                };
                await openEdit(id);
              } else if (action === 'files') {
                let rows = [];
                try { rows = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/files`); } catch {}
                const next = rowEl3.nextElementSibling;
                if (next && next.classList.contains('files-row')) {
                  next.remove();
                  btn.disabled = false;
                  return;
                }
                if (Array.isArray(rows) && rows.length === 1) {
                  const f = rows[0];
                  const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                  try { window.open(url, '_blank'); } catch { window.location.href = url; }
                }
                if ((!rows || rows.length === 0) && btn.hasAttribute('data-url')) {
                  const url2 = btn.getAttribute('data-url') || '';
                  if (url2) { try { window.open(url2.startsWith('/')?url2:'/'+url2, '_blank'); } catch { window.location.href = (url2.startsWith('/')?url2:'/'+url2); } }
                }
                const filesHtml = Array.isArray(rows) && rows.length
                  ? rows.map(f => {
                      const isImg = String(f.mime || '').startsWith('image/');
                      const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                      const thumb = isImg ? `<img src="${url}" alt="${f.name || ''}" style="width:80px;height:auto;border:1px solid #e5e7eb;border-radius:8px;" />` : `<span style="font-weight:700;color:#1e40af;">PDF</span>`;
                      const name = f.name || f.original_name || url.split('/').pop();
                      return `<li style="display:flex;align-items:center;gap:8px;"><a href="${url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:none;">${thumb}<span>${name}</span></a></li>`;
                    }).join('')
                  : '<li>ファイルなし</li>';
                const expand = document.createElement('tr');
                expand.className = 'files-row';
                expand.innerHTML = `<td colspan="9"><ul style="list-style:none;padding:0;margin:6px 0;display:flex;gap:8px;flex-wrap:wrap;">${filesHtml}</ul></td>`;
                rowEl3.after(expand);
              } else if (action === 'delete') {
                const ok = window.confirm('削除しますか？');
                if (!ok) { btn.disabled = false; return; }
                await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}`, { method:'DELETE' });
                await reload();
              }
            } catch {}
            if (action === 'chat') {
              const next = rowEl3.nextElementSibling;
              if (next && next.classList.contains('chat-row')) {
                next.remove();
                btn.disabled = false;
                return;
              }
              const chat = document.createElement('tr');
              chat.className = 'chat-row';
              chat.innerHTML = `<td colspan="9">
                <div class="chat-box" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;">
                  <div class="chat-header" style="font-weight:700;color:#1f2937;margin-bottom:8px;">やり取り</div>
                  <div class="chat-reason" style="margin-bottom:8px;color:#7f1d1d;font-weight:700;"></div>
                  <div class="chat-messages" style="max-height:220px;overflow:auto;padding:6px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;"></div>
                  <div class="chat-input" style="display:flex;gap:8px;margin-top:8px;">
                    <input type="text" class="chat-text" placeholder="メッセージを入力…" style="flex:1;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;">
                    <button class="btn chat-send" type="button" style="height:36px;">送信</button>
                  </div>
                </div>
              </td>`;
              rowEl3.after(chat);
              const box = chat.querySelector('.chat-messages');
              const text = chat.querySelector('.chat-text');
              const send = chat.querySelector('.chat-send');
              const reasonEl = chat.querySelector('.chat-reason');
              try {
                const rec = rows.find(x => String(x.id) === String(id));
                const reason = rec && rec.manager_note ? String(rec.manager_note) : '';
                if (reasonEl) reasonEl.textContent = reason ? ('差戻し理由: ' + reason) : '';
              } catch {}
              const load = async () => {
                try {
                  const msgs = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/messages`);
                  box.innerHTML = Array.isArray(msgs) && msgs.length
                    ? msgs.map(m => {
                        const who = m.sender_name || '';
                        const when = fmtDT(m.created_at);
                        const me = String(m.sender_user_id) === String(window.ADMIN_ID || '');
                        return `<div style="display:flex;margin:6px 0;${me?'justify-content:flex-end':''}">
                          <div style="max-width:70%;padding:8px 10px;border-radius:12px;${me?'background:#dbeafe;color:#1e3a8a;':'background:#e2e8f0;color:#111827;'}">
                            <div style="font-size:12px;color:#334155;font-weight:700;display:flex;justify-content:space-between;gap:8px;"><span>${who}</span><span style="color:#64748b;">${when}</span></div>
                            <div>${m.message}</div>
                          </div>
                        </div>`;
                      }).join('')
                    : '<div style="color:#64748b;">メッセージはありません</div>';
                } catch {
                  box.innerHTML = '<div style="color:#b00020;">読み込みに失敗しました</div>';
                }
              };
              await load();
              const doSend = async () => {
                const val = String(text.value || '').trim();
                if (!val) return;
                send.disabled = true;
                try {
                  await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/messages`, { method:'POST', body: JSON.stringify({ message: val }) });
                  text.value = '';
                  await load();
                } catch (errSend) {}
                send.disabled = false;
              };
              send.addEventListener('click', doSend);
              text.addEventListener('keydown', async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); await doSend(); } });
              btn.disabled = false;
              return;
            }
            btn.disabled = false;
          });
        }
      }
      if (status) status.textContent = '';
    } catch (e) {
      if (status) status.textContent = `取得失敗: ${String(e?.message || 'unknown')}`;
    } finally { hideSpinner(); }
  };
  const btn = $('#expReload');
  if (btn) btn.addEventListener('click', reload);
  await reload();
  try {
    const t = setInterval(async () => {
      try {
        const month = $('#expMonth') ? $('#expMonth').value : todayMonth();
        const chats = await fetchJSONAuth(`/api/expenses/admin/messages?month=${encodeURIComponent(month)}`);
        const chatList = $('#chatList');
        if (chatList) {
          chatList.innerHTML = Array.isArray(chats) && chats.length
            ? chats.slice(0, 10).map(c => {
                const sender = c.sender_name || '';
                const emp = c.employee_name || '';
                const dt = fmtDT(c.created_at);
                const route = [c.origin || '', c.via || '', c.destination || ''].filter(Boolean).join('→');
                const purpose = c.purpose || '';
                return `<div data-exp-id="${String(c.expense_id)}" style="display:flex;gap:8px;align-items:center;">
                  <span style="color:#334155;font-size:12px;">${dt}</span>
                  <span style="color:#1f2937;font-weight:700;">${sender}</span>
                  <span style="color:#64748b;">→</span>
                  <span style="color:#1f2937;">${emp}</span>
                  <span style="color:#334155;flex:1;">${route} ${purpose ? ('／目的: ' + purpose) : ''}</span>
                  <button class="btn" data-action="open-chat" style="height:28px;">表示</button>
                </div>`;
              }).join('')
            : '<div style="color:#64748b;">通知なし</div>';
        }
      } catch {}
    }, 30000);
    void t;
  } catch {}
};

export async function mount() {
  const profile = await requireAdmin();
  if (!profile) return;
  try { window.ADMIN_ID = profile.id; } catch {}
  await render();
}
