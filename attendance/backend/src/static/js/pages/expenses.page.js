import { logout } from '/static/js/api/auth.api.js?v=20260416-1';
import { fetchJSONAuth } from '/static/js/api/http.api.js?v=20260416-1';
const $ = (sel) => document.querySelector(sel);
const showErr = (m) => { const el = $('#error'); if (!el) return; if (!m) { el.style.display='none'; el.textContent=''; return; } el.style.display='block'; el.textContent=String(m); };
let sc = 0;
const showSpinner = () => { try { const el = $('#pageSpinner'); sc++; if (el) { el.removeAttribute('hidden'); el.style.display='grid'; } } catch {} };
const hideSpinner = () => { try { const el = $('#pageSpinner'); sc=Math.max(0, sc-1); if (sc!==0) return; if (el) { el.setAttribute('hidden',''); el.style.display='none'; } } catch {} };
const todayISO = () => new Date().toLocaleDateString('sv-SE');
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
let formActive = false;
let navBusy = false;
const renderSummary = async () => {
  try {
    const m = new Date().toISOString().slice(0,7);
    const rows = await fetchJSONAuth(`/api/expenses/my?month=${encodeURIComponent(m)}`);
    const a = Array.isArray(rows) ? rows.filter(r => String(r.status) === 'applied').length : 0;
    const sA = document.getElementById('empSumApplied');
    if (sA) sA.textContent = String(a);
    try {
      const latest = await fetchJSONAuth('/api/expenses/months/applied');
      const label = latest && latest.month ? String(latest.month) : '';
      const cnt = latest && latest.count != null ? Number(latest.count || 0) : null;
      const elM = document.getElementById('empAppliedMonth');
      if (elM) elM.textContent = label ? (label.slice(0,4) + '年' + label.slice(5,7) + '月') : '-';
      if (cnt != null && sA) sA.textContent = String(cnt);
    } catch {}
  } catch {}
};
const renderNotices = async () => {
  try {
    const m = new Date().toISOString().slice(0,7);
    const rows = await fetchJSONAuth(`/api/expenses/my?month=${encodeURIComponent(m)}&status=rejected`);
    const n = Array.isArray(rows) ? rows.length : 0;
    const c = document.getElementById('empNoticeCount');
    if (c) c.textContent = String(n);
  } catch {}
};
const wireUserMenu = () => {
  const btn = $('.user-btn'); const dd = $('#userDropdown'); if (!btn || !dd || btn.dataset.bound==='1') return; btn.dataset.bound='1';
  btn.addEventListener('click',(e)=>{ e.preventDefault(); const open=!dd.hasAttribute('hidden'); if (open) dd.setAttribute('hidden',''); else dd.removeAttribute('hidden'); btn.setAttribute('aria-expanded', open?'false':'true'); });
  document.addEventListener('click',(e)=>{ if (e.target.closest('.user-menu')) return; dd.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); });
  const logoutBtn = $('#btnLogout'); if (logoutBtn) logoutBtn.addEventListener('click', async ()=>{ try{ await logout(); }catch{} try{ sessionStorage.removeItem('accessToken'); sessionStorage.removeItem('refreshToken'); sessionStorage.removeItem('user'); }catch{} try{ localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); }catch{} window.location.replace('/ui/logout?next=%2Fexpenses-login'); });
  
};
const wireDrawer = () => {
  const btn=$('#mobileMenuBtn'); const drawer=$('#mobileDrawer'); const backdrop=$('#drawerBackdrop'); const closeBtn=$('#mobileClose');
  if (!btn||!drawer||!backdrop||btn.dataset.bound==='1') return; btn.dataset.bound='1';
  const close=()=>{ drawer.setAttribute('hidden',''); backdrop.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); document.body.classList.remove('drawer-open'); };
  const open=()=>{ drawer.removeAttribute('hidden'); backdrop.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); document.body.classList.add('drawer-open'); };
  btn.addEventListener('click',(e)=>{ e.preventDefault(); if (drawer.hasAttribute('hidden')) open(); else close(); });
  closeBtn?.addEventListener('click',(e)=>{ e.preventDefault(); close(); });
  backdrop.addEventListener('click',(e)=>{ e.preventDefault(); close(); });
  document.addEventListener('keydown',(e)=>{ if (e.key==='Escape') close(); });
};
const renderList = async () => {
  const host = $('#exListHost'); if (!host) return; host.innerHTML = '<div style="color:#475569;font-weight:650;">読み込み中…</div>';
  try {
    const month = document.getElementById('exFilterMonth')?.value || new Date().toISOString().slice(0,7);
    const status = document.getElementById('exFilterStatus')?.value || '';
    const q = `/api/expenses/my?month=${encodeURIComponent(month)}&status=${encodeURIComponent(status)}`;
    const rows = await fetchJSONAuth(q);
    try { await renderSummary(); } catch {}
    if (!Array.isArray(rows) || rows.length===0) { host.innerHTML = '<div class="empty-state"><div style="font-size:28px;">🗂️</div><div>データはありません</div></div>'; return; }
    const tr = rows.map(r => {
      const d = String(r.date || '').slice(0,10);
      const a = Number(r.amount || 0).toLocaleString('ja-JP');
      const route = [r.origin || '', r.via || '', r.destination || ''].filter(Boolean).join('→');
      const st = String(r.status || 'pending');
      const stClass = (st==='applied'||st==='approved'||st==='rejected'||st==='draft') ? st : 'draft';
      const applied = fmtDT(r.applied_at || r.updated_at || r.created_at);
      const approved = fmtDT(r.approved_at);
      const approver = r.approver_name ? String(r.approver_name) : '';
      const timeHtml =
        st === 'applied' ? (applied ? `<div style="color:#6b7280;font-size:12px;">申請: ${applied}</div>` : '') :
        st === 'approved' ? (approved ? `<div style="color:#6b7280;font-size:12px;">承認: ${approved}</div>` : '') :
        st === 'rejected' ? (approved ? `<div style="color:#6b7280;font-size:12px;">却下: ${approved}</div>` : '') : '';
      const whoHtml = (st==='approved' || st==='rejected') && approver ? `<div style="color:#6b7280;font-size:12px;">担当: ${approver}</div>` : '';
      const noteHtml = st === 'rejected' && r.manager_note ? `<div style="color:#ef4444;font-size:12px;">理由: ${r.manager_note}</div>` : '';
      const replyBtn = st === 'rejected' ? `<button class="btn" data-action="reply" style="height:28px;margin-right:6px;">取り戻し理由</button>` : '';
      const ru = r.receipt_url ? String(r.receipt_url) : (r.first_file_path ? String(r.first_file_path) : '');
      const ruAttr = ru ? ` data-url="${ru}"` : '';
      const count = Number(r.file_count || 0);
      const ruInline = ru ? `<a href="${ru.startsWith('/')?ru:'/'+ru}" class="receipt-link" data-count="${String(count)}" target="_blank" rel="noopener" style="font-size:12px;color:#1e40af;text-decoration:none;">表示${count>1?`(${count}件)`:''}</a>` : (count>0 ? `<button class="btn" data-action="files" type="button" style="height:24px;">表示(${count}件)</button>` : '<span style="color:#64748b;font-size:12px;">なし</span>');
      return `<tr data-id="${String(r.id||'')}"><td>${d}</td><td>${route}</td><td style="text-align:right;">${a}</td><td><span class="status-pill status-${stClass}">${st}</span>${timeHtml}${whoHtml}</td><td>${r.memo || ''}${noteHtml}</td><td><button class="icon-btn" data-action="files"${ruAttr} aria-label="領収書"><img src="/static/images/paperclip.png" alt=""></button>${ruInline}</td><td>${replyBtn}<button class="icon-btn" data-action="delete" aria-label="削除"><img src="/static/images/xoa.png" alt=""></button></td></tr>`;
    }).join('');
    host.innerHTML = `
      <div class="adj-table-card">
        <table class="adj-table">
          <thead><tr><th>日付</th><th>経路</th><th>金額</th><th>ステータス</th><th>メモ</th><th>領収書</th><th>操作</th></tr></thead>
          <tbody>${tr}</tbody>
        </table>
      </div>
    `;
    const tbody = host.querySelector('tbody');
    if (tbody && !tbody.dataset.bindDel) {
      tbody.dataset.bindDel = '1';
      tbody.addEventListener('click', async (e) => {
        const link = e.target.closest('a.receipt-link');
        const tr = e.target.closest('tr[data-id]');
        if (link && tr) {
          const c = parseInt(String(link.getAttribute('data-count')||'0'),10);
          if (c>1) {
            e.preventDefault();
            const filesBtn = tr.querySelector('button[data-action="files"]');
            filesBtn?.click();
            return;
          }
        }
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const tr2 = btn.closest('tr[data-id]');
        const id = tr2 ? tr2.getAttribute('data-id') : '';
        if (!id) return;
        const action = btn.getAttribute('data-action');
        btn.disabled = true;
        try {
          if (action === 'delete') {
            const ok = window.confirm('削除しますか？');
            if (!ok) { btn.disabled = false; return; }
            try {
              await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}`, { method:'DELETE' });
            } catch (errDel) {
              showErr(errDel?.message || '削除に失敗しました'); btn.disabled = false; return;
            }
            await renderList();
          } else if (action === 'files') {
            let rows = [];
            try { rows = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/files`); } catch (errGet) {
              const warn = document.createElement('tr'); warn.className = 'files-row';
              warn.innerHTML = `<td colspan="7"><div style="color:#b00020;">領収書の読み込みに失敗しました：${String(errGet?.message || 'unknown')}</div></td>`;
              tr2.after(warn);
              btn.disabled = false; return;
            }
            const next = tr2.nextElementSibling;
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
              const url = btn.getAttribute('data-url') || '';
              if (url) { try { window.open(url.startsWith('/')?url:'/'+url, '_blank'); } catch { window.location.href = (url.startsWith('/')?url:'/'+url); } }
            }
            const filesHtml = Array.isArray(rows) && rows.length
              ? rows.map(f => {
                  const isImg = String(f.mime || '').startsWith('image/');
                  const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                  const thumb = isImg ? `<img src="${url}" alt="${f.name || ''}" style="width:80px;height:auto;border:1px solid #e5e7eb;border-radius:8px;" />` : `<span style="font-weight:700;color:#1e40af;">PDF</span>`;
                  const name = f.name || f.original_name || url.split('/').pop();
                  const deco = isImg ? 'none' : 'underline';
                  return `<li data-file-id="${String(f.id)}" style="display:flex;align-items:center;gap:8px;">
                    <a href="${url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:${deco};">${thumb}<span>${name}</span></a>
                    <button class="icon-btn" data-action="file-delete" aria-label="ファイル削除"><img src="/static/images/xoa.png" alt=""></button>
                  </li>`;
                }).join('')
              : '<li>ファイルなし</li>';
            const expand = document.createElement('tr');
            expand.className = 'files-row';
            expand.innerHTML = `<td colspan="7"><ul style="list-style:none;padding:0;margin:6px 0;display:flex;gap:8px;flex-wrap:wrap;">${filesHtml}</ul></td>`;
            tr2.after(expand);
            const ul = expand.querySelector('ul');
            ul?.addEventListener('click', async (ev) => {
              const b2 = ev.target.closest('button[data-action="file-delete"]');
              if (!b2) return;
              const li = b2.closest('li[data-file-id]');
              const fid = li ? li.getAttribute('data-file-id') : '';
              if (!fid) return;
              b2.disabled = true;
              try {
                const ok2 = window.confirm('ファイルを削除しますか？');
                if (!ok2) { b2.disabled = false; return; }
                try {
                  await fetchJSONAuth(`/api/expenses/files/${encodeURIComponent(fid)}`, { method:'DELETE' });
                } catch (errFd) {
                  showErr(errFd?.message || 'ファイル削除に失敗しました'); b2.disabled = false; return;
                }
                let newRows = [];
                try { newRows = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/files`); } catch {}
                const newHtml = Array.isArray(newRows) && newRows.length
                  ? newRows.map(f => {
                      const url = String(f.path || f.url || f.file_path || '').startsWith('/') ? String(f.path || f.url || f.file_path) : '/' + String(f.path || f.url || f.file_path || '');
                      const name = f.name || f.original_name || url.split('/').pop();
                      const isPdf = /\.pdf($|\?)/i.test(url) || /\.pdf$/i.test(String(name||''));
                      const deco = isPdf ? 'underline' : 'none';
                      return `<li data-file-id="${String(f.id)}"><a href="${url}" target="_blank" rel="noopener" style="text-decoration:${deco};">${name}</a> <button class="icon-btn" data-action="file-delete" aria-label="ファイル削除"><img src="/static/images/xoa.png" alt=""></button></li>`;
                    }).join('')
                  : '<li>ファイルなし</li>';
                ul.innerHTML = newHtml;
              } catch {}
              b2.disabled = false;
            });
          } else if (action === 'reply') {
            const next = tr.nextElementSibling;
            if (next && next.classList.contains('chat-row')) {
              next.remove();
              btn.disabled = false;
              return;
            }
            const chat = document.createElement('tr');
            chat.className = 'chat-row';
            chat.innerHTML = `<td colspan="7">
              <div class="chat-box" style="border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;">
                <div class="chat-header" style="font-weight:700;color:#1f2937;margin-bottom:8px;">やり取り</div>
                <div class="chat-reason" style="margin-bottom:8px;color:#7f1d1d;font-weight:700;"></div>
                <div class="chat-messages" style="max-height:220px;overflow:auto;padding:6px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;"></div>
                <div class="chat-input" style="display:flex;gap:8px;margin-top:8px;">
                  <input type="text" class="chat-text" placeholder="メッセージを入力…" style="flex:1;height:36px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;">
                  <button class="btn chat-send" type="button" style="height:36px;">送信</button>
                </div>
                <div class="chat-actions" style="display:flex;gap:8px;margin-top:8px;">
                  <button class="btn chat-edit" type="button" style="height:32px;">編集</button>
                  <button class="btn chat-new" type="button" style="height:32px;">新規作成</button>
                </div>
              </div>
            </td>`;
            tr.after(chat);
            const box = chat.querySelector('.chat-messages');
            const text = chat.querySelector('.chat-text');
            const send = chat.querySelector('.chat-send');
            const reasonEl = chat.querySelector('.chat-reason');
            try {
              const rec = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}`);
              const reason = rec && rec.manager_note ? String(rec.manager_note) : '';
              if (reasonEl) reasonEl.textContent = reason ? ('差戻し理由: ' + reason) : '';
            } catch {}
            const load = async () => {
              try {
                const rows = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(id)}/messages`);
                box.innerHTML = Array.isArray(rows) && rows.length
                  ? rows.map(m => {
                      const me = String(m.sender_user_id) === String(window.MY_ID || '');
                      const who = m.sender_name || '';
                      const when = fmtDT(m.created_at);
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
              } catch (errSend) {
                showErr(errSend?.message || '送信に失敗しました');
              }
              send.disabled = false;
            };
            send.addEventListener('click', doSend);
            text.addEventListener('keydown', async (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); await doSend(); } });
            const btnEdit = chat.querySelector('.chat-edit');
            const btnNew = chat.querySelector('.chat-new');
            const ensureEditModal = () => {
              let modal = document.getElementById('editModal');
              if (modal) return modal;
              modal = document.createElement('div');
              modal.id = 'editModal';
              modal.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);width:720px;max-width:95%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 24px 48px rgba(0,0,0,.16);padding:16px;display:none;z-index:1000;';
              modal.innerHTML = `
                <div style="font-weight:800;color:#0b2c66;margin-bottom:8px;">編集</div>
                <div class="adjust-grid" style="grid-template-columns: 120px 1fr;">
                  <div class="adjust-label">日付</div><div><input id="edDate" type="date"></div>
                  <div class="adjust-label">費目</div><div><select id="edType" class="adjust-input"><option value="train">電車</option><option value="bus">バス</option><option value="taxi">タクシー</option><option value="private_car">自家用車</option><option value="parking">駐車場</option><option value="highway">高速道路</option></select></div>
                  <div class="adjust-label">出発</div><div><input id="edOrigin" class="adjust-input"></div>
                  <div class="adjust-label">経由</div><div><input id="edVia" class="adjust-input"></div>
                  <div class="adjust-label">到着</div><div><input id="edDestination" class="adjust-input"></div>
                  <div class="adjust-label">片道/往復</div><div><select id="edTripType" class="adjust-input"><option value="one_way">片道</option><option value="round_trip">往復</option></select></div>
                  <div class="adjust-label">回数</div><div><input id="edTripCount" type="number" min="1" class="adjust-input"></div>
                  <div class="adjust-label">距離(km)</div><div><input id="edKm" type="number" step="0.1" class="adjust-input"></div>
                  <div class="adjust-label">単価</div><div><input id="edUnitPrice" type="number" step="1" class="adjust-input"></div>
                  <div class="adjust-label">目的</div><div><input id="edPurpose" class="adjust-input"></div>
                  <div class="adjust-label">定期</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="edTeiki" type="checkbox"><span>定期区間内</span></label></div>
                  <div class="adjust-label">通勤</div><div><label style="display:flex;align-items:center;gap:8px;"><input id="edCommuter" type="checkbox"><span>通勤パス</span></label></div>
                  <div class="adjust-label">金額</div><div><input id="edAmount" type="number" step="1" class="adjust-input"></div>
                  <div class="adjust-label">メモ</div><div><input id="edMemo" class="adjust-input"></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                  <button id="edCancel" class="btn" type="button" style="height:32px;">キャンセル</button>
                  <button id="edSave" class="btn btn-primary" type="button" style="height:32px;">保存</button>
                  <button id="edApply" class="btn" type="button" style="height:32px;">申請</button>
                </div>
              `;
              document.body.appendChild(modal);
              return modal;
            };
            const openEdit = async (recId) => {
              const modal = ensureEditModal();
              const backdrop = document.getElementById('drawerBackdrop');
              try {
                const r = await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`);
                const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
                set('edDate', r.date ? String(r.date).slice(0,10) : todayISO());
                set('edType', r.type || (r.category || 'train'));
                set('edOrigin', r.origin || '');
                set('edVia', r.via || '');
                set('edDestination', r.destination || '');
                set('edTripType', r.trip_type || 'one_way');
                set('edTripCount', r.trip_count != null ? String(r.trip_count) : '1');
                set('edKm', r.distance_km != null ? String(r.distance_km) : '');
                set('edUnitPrice', r.unit_price_per_km != null ? String(r.unit_price_per_km) : '');
                set('edPurpose', r.purpose || '');
                try { const c1 = document.getElementById('edTeiki'); if (c1) c1.checked = !!r.teiki_flag; } catch {}
                try { const c2 = document.getElementById('edCommuter'); if (c2) c2.checked = !!r.commuter_pass; } catch {}
                set('edAmount', r.amount != null ? String(r.amount) : '');
                set('edMemo', r.memo || '');
              } catch (errR) {}
              if (backdrop) { backdrop.removeAttribute('hidden'); backdrop.style.display='block'; }
              modal.style.display = 'block';
              try { document.getElementById('edOrigin')?.focus(); } catch {}
              const onCancel = () => { modal.style.display='none'; if (backdrop){backdrop.setAttribute('hidden',''); backdrop.style.display='none';} cleanup(); };
              const onSave = async () => {
                const payload = {
                  date: document.getElementById('edDate')?.value,
                  type: document.getElementById('edType')?.value,
                  origin: document.getElementById('edOrigin')?.value,
                  via: document.getElementById('edVia')?.value,
                  destination: document.getElementById('edDestination')?.value,
                  trip_type: document.getElementById('edTripType')?.value,
                  trip_count: parseInt(String(document.getElementById('edTripCount')?.value||'1'),10),
                  distance_km: parseFloat(String(document.getElementById('edKm')?.value||'')),
                  unit_price_per_km: parseFloat(String(document.getElementById('edUnitPrice')?.value||'')),
                  purpose: document.getElementById('edPurpose')?.value,
                  teiki_flag: !!document.getElementById('edTeiki')?.checked,
                  commuter_pass: !!document.getElementById('edCommuter')?.checked,
                  amount: parseFloat(String(document.getElementById('edAmount')?.value||'')),
                  memo: document.getElementById('edMemo')?.value
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
                try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}`, { method:'PATCH', body: JSON.stringify(payload) }); await renderList(); onCancel(); } catch (errU) { showErr(errU?.message || '保存に失敗しました'); }
              };
              const onApply = async () => {
                try { await fetchJSONAuth(`/api/expenses/${encodeURIComponent(recId)}/apply`, { method:'POST' }); await renderList(); onCancel(); } catch (errA) { showErr(errA?.message || '申請に失敗しました'); }
              };
              const cancelBtn = document.getElementById('edCancel');
              const saveBtn = document.getElementById('edSave');
              const applyBtn = document.getElementById('edApply');
              cancelBtn?.addEventListener('click', onCancel);
              saveBtn?.addEventListener('click', onSave);
              applyBtn?.addEventListener('click', onApply);
              const cleanup = () => {
                cancelBtn?.removeEventListener('click', onCancel);
                saveBtn?.removeEventListener('click', onSave);
                applyBtn?.removeEventListener('click', onApply);
              };
            };
            btnEdit?.addEventListener('click', async () => { try { await openEdit(id); } catch {} });
            btnNew?.addEventListener('click', async () => {
              try {
                const m = new Date().toISOString().slice(0,7);
                try { await fetchJSONAuth('/api/expenses/months/start', { method:'POST', body: JSON.stringify({ month: m }) }); } catch {}
                const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
                setVal('exDate', m + '-01');
                setVal('exType', 'train');
                setVal('exOrigin', '');
                setVal('exVia', '');
                setVal('exDestination', '');
                setVal('exTripType', 'one_way');
                setVal('exTripCount', '1');
                setVal('exKm', '');
                setVal('exUnitPrice', '');
                setVal('exPurpose', '');
                const teikiEl = document.getElementById('exTeiki'); if (teikiEl) teikiEl.checked = false;
                setVal('exAmount', '');
                setVal('exMemo', '');
                formActive = true;
                await showTab('home');
              } catch {}
            });
          }
        } finally {
          btn.disabled = false;
        }
      });
    }
  } catch (e) {
    host.innerHTML = `<div style="color:#b00020;font-weight:650;">取得失敗: ${String(e?.message || 'unknown')}</div>`;
  } finally {}
};
const renderHistoryTitle = () => {
  // no-op: history controls are now on the toolbar row
};
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const p = await fetchJSONAuth('/api/auth/me');
    const role = String(p.role||'').toLowerCase();
    if (!p || (role!=='employee' && role!=='manager')) {
      if (role==='admin') {
        showErr('このページへのアクセス権限がありません（管理者は管理画面をご利用ください）');
        window.location.replace('/admin/expenses');
        return;
      }
      window.location.replace('/expenses-login'); return;
    }
    const name = p.username || p.email || 'ユーザー'; const el = $('#userName'); if (el) el.textContent = name;
    try { window.MY_ID = p.id; } catch {}
    try {
      const params = new URLSearchParams(String(window.location.search||''));
      const m = params.get('month');
      if (m && /^\d{4}-\d{2}$/.test(String(m))) {
        const d = document.getElementById('exDate'); if (d) d.value = String(m) + '-01';
        const mf = document.getElementById('exFilterMonth'); if (mf) mf.value = String(m);
        try { await fetchJSONAuth('/api/expenses/months/start', { method:'POST', body: JSON.stringify({ month: String(m) }) }); } catch {}
        formActive = true;
      }
    } catch {}
  } catch { window.location.replace('/expenses-login'); return; }
  wireUserMenu(); wireDrawer();
  try {
    if (document.body.dataset.backLoginBound !== '1') {
      document.body.dataset.backLoginBound = '1';
      try { history.pushState({ back_to_expenses_login_guard: true }, '', window.location.href); } catch {}
      window.addEventListener('popstate', async () => {
        try { await logout(); } catch {}
        try { window.location.replace('/expenses-login'); } catch { window.location.href = '/expenses-login'; }
      });
    }
  } catch {}
  const back = document.getElementById('expBackBtn');
  if (back && !back.dataset.bound) {
    back.dataset.bound = '1';
    back.addEventListener('click', async (e) => {
      e.preventDefault();
      try { await logout(); } catch {}
      try { window.location.replace('/ui/logout?next=%2Fexpenses-login'); } catch { window.location.href = '/ui/logout?next=%2Fexpenses-login'; }
    });
  }
  const d = $('#exDate'); if (d && !d.value) d.value = todayISO();
  const typeSel = document.getElementById('exType');
  const kmEl = document.getElementById('exKm');
  const unitEl = document.getElementById('exUnitPrice');
  const amtEl = document.getElementById('exAmount');
  const tripSel = document.getElementById('exTripType');
  const tripCountEl = document.getElementById('exTripCount');
  const toggleCarFields = () => {
    const isCar = (typeSel?.value || '') === 'car';
    const kmRow = kmEl?.parentElement?.previousElementSibling ? kmEl.parentElement.previousElementSibling : null;
    const unitRow = unitEl?.parentElement?.previousElementSibling ? unitEl.parentElement.previousElementSibling : null;
    if (kmEl && unitEl) {
      kmEl.parentElement.style.display = isCar ? '' : 'none';
      unitEl.parentElement.style.display = isCar ? '' : 'none';
      if (kmRow) kmRow.style.display = isCar ? '' : 'none';
      if (unitRow) unitRow.style.display = isCar ? '' : 'none';
    }
  };
  const toggleTripCount = () => {
    const isMulti = (tripSel?.value || '') === 'multi';
    const cntRowLabel = tripCountEl?.parentElement?.previousElementSibling ? tripCountEl.parentElement.previousElementSibling : null;
    if (tripCountEl) {
      tripCountEl.parentElement.style.display = isMulti ? '' : 'none';
      if (cntRowLabel) cntRowLabel.style.display = isMulti ? '' : 'none';
    }
  };
  const recomputeAmountPreview = () => {
    const type = typeSel?.value || '';
    let base = Number(amtEl?.value || '0') || 0;
    const t = tripSel?.value || 'one_way';
    const cnt = Math.max(1, Number(tripCountEl?.value || '1') || 1);
    if (type === 'car') {
      const dist = Number(kmEl?.value || '0') || 0;
      const unit = Number(unitEl?.value || '0') || 0;
      if (dist > 0 && unit > 0) base = Math.round(dist * unit);
    }
    if (t === 'round_trip') base = base * 2;
    else if (t === 'multi') base = base * cnt;
    if (amtEl) amtEl.value = String(base);
  };
  typeSel?.addEventListener('change', () => { toggleCarFields(); recomputeAmountPreview(); });
  kmEl?.addEventListener('input', recomputeAmountPreview);
  unitEl?.addEventListener('input', recomputeAmountPreview);
  tripSel?.addEventListener('change', () => { toggleTripCount(); recomputeAmountPreview(); });
  tripCountEl?.addEventListener('input', recomputeAmountPreview);
  toggleCarFields();
  toggleTripCount();
  const submit = $('#exSubmit'); const status = $('#exStatus');
  const applyBtn = $('#exApply');
  submit?.addEventListener('click', async () => {
    if (!submit || submit.disabled) return;
    showErr(''); submit.disabled = true; if (status) status.textContent = '保存中…';
    const clientToken = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const date = $('#exDate')?.value || '';
    const type = $('#exType')?.value || 'train';
    const origin = $('#exOrigin')?.value || '';
    const via = $('#exVia')?.value || '';
    const destination = $('#exDestination')?.value || '';
    const tripType = $('#exTripType')?.value || 'one_way';
    const tripCount = Number($('#exTripCount')?.value || '1');
    const purpose = $('#exPurpose')?.value || '';
    const teiki = !!$('#exTeiki')?.checked;
    const km = $('#exKm')?.value || '';
    const unitPricePerKm = $('#exUnitPrice')?.value || '';
    const memo = $('#exMemo')?.value || '';
    let amount = $('#exAmount')?.value || '';
    if (type === 'train' && teiki) amount = '0';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) { if (status) status.textContent=''; showErr('日付が正しくありません'); submit.disabled=false; return; }
    if (!String(amount).trim()) { if (status) status.textContent=''; showErr('金額を入力してください'); submit.disabled=false; return; }
    showSpinner();
    try {
      const create = await fetchJSONAuth('/api/expenses', { method:'POST', body: JSON.stringify({
        date,
        type,
        origin,
        via,
        destination,
        tripType,
        tripCount,
        purpose,
        teiki,
        km: km ? Number(km) : null,
        unitPricePerKm: unitPricePerKm ? Number(unitPricePerKm) : null,
        amount: Number(amount),
        memo,
        clientToken
      }) });
      const newId = create?.id;
      const fFront = document.getElementById('exReceiptFront')?.files?.[0] || null;
      const fBack = document.getElementById('exReceiptBack')?.files?.[0] || null;
      const imgs = document.getElementById('exImages')?.files || [];
      if (newId && (fFront || fBack || (imgs && imgs.length))) {
        const fd = new FormData();
        if (fFront) fd.append('files', fFront, (fFront.name || 'front'));
        if (fBack) fd.append('files', fBack, (fBack.name || 'back'));
        for (const f of imgs) fd.append('files', f, f.name || 'image');
        await fetch(`/api/expenses/${encodeURIComponent(newId)}/files`, { method:'POST', body: fd, credentials: 'include' });
      }
      if (status) status.textContent = '保存しました';
      await renderList();
      try { await renderSummary(); } catch {}
    } catch (e) {
      if (status) status.textContent = '';
      showErr(e?.message || '保存に失敗しました');
    } finally { hideSpinner(); submit.disabled = false; }
  });
  applyBtn?.addEventListener('click', async () => {
    if (!applyBtn || applyBtn.disabled) return;
    const okApply = window.confirm('保存して申請しますか？');
    if (!okApply) return;
    showErr(''); applyBtn.disabled = true; if (status) status.textContent = '保存中…';
    const clientToken = 'ct_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const date = $('#exDate')?.value || '';
    const type = $('#exType')?.value || 'train';
    const origin = $('#exOrigin')?.value || '';
    const via = $('#exVia')?.value || '';
    const destination = $('#exDestination')?.value || '';
    const tripType = $('#exTripType')?.value || 'one_way';
    const tripCount = Number($('#exTripCount')?.value || '1');
    const purpose = $('#exPurpose')?.value || '';
    const teiki = !!$('#exTeiki')?.checked;
    const km = $('#exKm')?.value || '';
    const unitPricePerKm = $('#exUnitPrice')?.value || '';
    const memo = $('#exMemo')?.value || '';
    let amount = $('#exAmount')?.value || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) { if (status) status.textContent=''; showErr('日付が正しくありません'); applyBtn.disabled=false; return; }
    if (!String(amount).trim()) { if (status) status.textContent=''; showErr('金額を入力してください'); applyBtn.disabled=false; return; }
    showSpinner();
    try {
      const create = await fetchJSONAuth('/api/expenses', { method:'POST', body: JSON.stringify({
        date, type, origin, via, destination, tripType, tripCount, purpose, teiki,
        km: km ? Number(km) : null, unitPricePerKm: unitPricePerKm ? Number(unitPricePerKm) : null,
        amount: Number(amount), memo, clientToken
      }) });
      const newId = create?.id;
      if (status) status.textContent = '保存しました。申請送信中…';
      const fFront = document.getElementById('exReceiptFront')?.files?.[0] || null;
      const fBack = document.getElementById('exReceiptBack')?.files?.[0] || null;
      const imgs = document.getElementById('exImages')?.files || [];
      if (newId && (fFront || fBack || (imgs && imgs.length))) {
        const fd = new FormData();
        if (fFront) fd.append('files', fFront, (fFront.name || 'front'));
        if (fBack) fd.append('files', fBack, (fBack.name || 'back'));
        for (const f of imgs) fd.append('files', f, f.name || 'image');
        await fetch(`/api/expenses/${encodeURIComponent(newId)}/files`, { method:'POST', body: fd, credentials: 'include' });
      }
      if (newId) await fetchJSONAuth(`/api/expenses/${encodeURIComponent(newId)}/apply`, { method:'POST' });
      if (status) status.textContent = '保存済み・申請送信済み';
      await renderList();
      try { await renderSummary(); } catch {}
    } catch (e) {
      if (status) status.textContent = '';
      showErr(e?.message || '申請に失敗しました');
    } finally { hideSpinner(); applyBtn.disabled = false; }
  });
  // do not auto-render history list; wait for user to press "検索"

  const typesSel = document.getElementById('exFilterType');
  try {
    const types = await fetchJSONAuth('/api/expenses/types');
    if (Array.isArray(types) && types.length) {
      // optional enhancement: populate type filter dynamically if needed
    }
  } catch {}

  const monthFilter = document.getElementById('exFilterMonth');
  const statusFilter = document.getElementById('exFilterStatus');
  const btnSearch = document.getElementById('exSearch');
  const btnClear = document.getElementById('exClear');
  const btnCsv = document.getElementById('exCsv');
  const btnShowHistory = document.getElementById('exShowHistory');
  if (monthFilter && !monthFilter.value) {
    monthFilter.value = new Date().toISOString().slice(0,7);
  }
  btnSearch?.addEventListener('click', async () => { await renderList(); });
  btnShowHistory?.addEventListener('click', async () => { await renderList(); });
  btnClear?.addEventListener('click', async () => {
    if (monthFilter) monthFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    await renderList();
  });
  monthFilter?.addEventListener('change', () => { renderHistoryTitle(); });
  monthFilter?.addEventListener('input', () => { renderHistoryTitle(); });
  btnCsv?.addEventListener('click', async () => {
    const m = monthFilter?.value || '';
    const s = statusFilter?.value || '';
    const u = `/api/expenses/export.csv?month=${encodeURIComponent(m)}&status=${encodeURIComponent(s)}`;
    window.location.href = u;
  });
  const navNew = document.getElementById('topNavNew');
  const navApplied = document.getElementById('topNavApplied');
  const navNotice = document.getElementById('topNavNotice');
  const homeSection = document.getElementById('homeSection');
  const historySection = document.getElementById('historySection');
  const setNavActive = (name) => {
    navNew?.classList.toggle('active', name === 'new');
    navApplied?.classList.toggle('active', name === 'applied');
    navNotice?.classList.toggle('active', name === 'notice');
  };
  const showTab = async (name) => {
    if (name === 'new') {
      formActive = true;
      if (homeSection) homeSection.style.display = '';
      if (historySection) historySection.style.display = 'none';
    } else {
      if (homeSection) homeSection.style.display = 'none';
      if (historySection) historySection.style.display = '';
      renderHistoryTitle();
    }
    setNavActive(name);
  };
  navNew?.addEventListener('click', async (e) => {
    e.preventDefault();
    await showTab('new');
  });
  navApplied?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (navBusy) return;
    navBusy = true;
    const m = document.getElementById('exFilterMonth');
    const s = document.getElementById('exFilterStatus');
    if (s) s.value = 'applied';
    try {
      const latest = await fetchJSONAuth('/api/expenses/months/applied');
      if (m && latest && latest.month) m.value = String(latest.month);
    } catch {}
    try {
      await showTab('applied');
      await renderList();
    } finally {
      navBusy = false;
    }
  });
  navNotice?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (navBusy) return;
    navBusy = true;
    const s = document.getElementById('exFilterStatus');
    if (s) s.value = 'rejected';
    try {
      await showTab('notice');
      await renderList();
    } finally {
      navBusy = false;
    }
  });
  await showTab('new');
  try { await renderSummary(); } catch {}
  try {
    await renderNotices();
  } catch {}
  try {
    const t = setInterval(async () => { try { await renderNotices(); } catch {} }, 30000);
    void t;
  } catch {}
});

function setupAutocomplete(inputId) {
  const el = document.getElementById(inputId);
  if (!el || el.dataset.autocomplete === '1') return;
  el.dataset.autocomplete = '1';
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  const parent = el.parentElement;
  if (parent) {
    parent.style.position = 'relative';
  }
  const list = document.createElement('div');
  list.style.position = 'absolute';
  list.style.left = '0';
  list.style.right = '0';
  list.style.top = '100%';
  list.style.zIndex = '1000';
  list.style.background = '#fff';
  list.style.border = '1px solid #cbd5e1';
  list.style.borderRadius = '8px';
  list.style.boxShadow = '0 6px 16px rgba(0,0,0,.08)';
  list.style.padding = '4px';
  list.style.display = 'none';
  list.style.maxHeight = '180px';
  list.style.overflowY = 'auto';
  (parent || el).appendChild(list);
  let lastQ = ''; let tid = 0;
  const render = (rows) => {
    list.innerHTML = '';
    if (!rows || !rows.length) { list.style.display = 'none'; return; }
    for (const r of rows.slice(0, 20)) {
      const item = document.createElement('div');
      item.textContent = r.name + (r.line_name ? ` (${r.line_name})` : '');
      item.style.padding = '6px 8px';
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => { el.value = r.name; list.style.display = 'none'; });
      item.addEventListener('mouseover', () => { item.style.background = '#eef5ff'; });
      item.addEventListener('mouseout', () => { item.style.background = 'transparent'; });
      list.appendChild(item);
    }
    list.style.display = 'block';
  };
  el.addEventListener('input', () => {
    const q = String(el.value || '').trim();
    if (q.length < 2) { list.style.display = 'none'; lastQ = ''; return; }
    if (q === lastQ) return;
    lastQ = q;
    clearTimeout(tid);
    tid = setTimeout(async () => {
      try {
        const rows = await fetchJSONAuth('/api/stations?search=' + encodeURIComponent(q));
        render(Array.isArray(rows) ? rows : []);
      } catch {
        list.style.display = 'none';
      }
    }, 200);
  });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest || !t.closest('#' + inputId)) {
      if (list) list.style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupAutocomplete('exOrigin');
  setupAutocomplete('exDestination');
});
