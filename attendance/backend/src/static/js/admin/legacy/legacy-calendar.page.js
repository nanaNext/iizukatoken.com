import { escapeHtml as esc } from '../_shared/dom.js';
import { api, downloadWithAuth } from '../../shared/api/client.js';

let controller = null;

export async function mountCalendar({ content }) {
  // Tạo AbortController mới mỗi lần mount
  controller = new AbortController();
  const { signal } = controller;

  const pad2 = (n) => String(n).padStart(2, '0');
  const monthOf = (date) => String(date || '').slice(0, 7);
  const splitLabel = (name) => {
    const parts = String(name || '').split(' / ');
    return { ja: parts[0] || '', en: parts.length > 1 ? parts.slice(1).join(' / ') : '' };
  };
  const dowJa = (dateStr) => {
    try {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      return ['日','月','火','水','木','金','土'][dt.getUTCDay()];
    } catch {
      return '';
    }
  };
  const isWeekend = (dateStr) => {
    try {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(x => parseInt(x, 10));
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      const w = dt.getUTCDay();
      return w === 0 || w === 6;
    } catch {
      return false;
    }
  };
  const typeLabel = (t) => {
    const s = String(t || '');
    if (s === 'jp_auto') return '祝日';
    if (s === 'jp_substitute') return '振替';
    if (s === 'jp_bridge') return '国民の休日';
    if (s === 'fixed') return '会社';
    if (s === 'custom') return '任意';
    return s || '—';
  };

  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const year0 = now.getUTCFullYear();
  const month0 = `${year0}-${pad2(now.getUTCMonth() + 1)}`;

  // Render UI
  content.innerHTML = `
    <h3>カレンダー</h3>
    <div class="dash-card attrec-card">
      <div class="attrec-controls">
        <div class="attrec-control">
          <div class="attrec-label">年</div>
          <input id="calYear" class="attrec-input" type="number" min="2000" max="2100" value="${esc(year0)}" style="width:120px;">
          <button type="button" id="calLoad" class="attrec-btn">表示</button>
          <button type="button" id="calExportCsv" class="attrec-btn">Excel</button>
          <button type="button" id="calExportIcs" class="attrec-btn">ICS</button>
        </div>
        <div class="attrec-control">
          <div class="attrec-label">月</div>
          <select id="calMonth" class="attrec-input" style="min-width:140px;">
            <option value="">全て</option>
            ${Array.from({ length: 12 }).map((_, i) => {
              const m = pad2(i + 1);
              const v = `${year0}-${m}`;
              return `<option value="${esc(v)}" ${v === month0 ? 'selected' : ''}>${esc(v)}</option>`;
            }).join('')}
          </select>
          <label style="display:flex;align-items:center;gap:6px;font-weight:800;font-size:12px;color:#475569;">
            <input id="calOnlyOff" type="checkbox" checked>
            休日のみ
          </label>
        </div>
      </div>
      <div id="calInfo" class="attrec-summary" aria-live="polite"></div>
      <div id="calTable" class="attrec-table"></div>
    </div>
  `;

  const infoHost = content.querySelector('#calInfo');
  const tableHost = content.querySelector('#calTable');

  const render = (rows, meta) => {
    if (!tableHost) return;
    const list = Array.isArray(rows) ? rows : [];

    const byType = list.reduce((acc, r) => {
      const k = String((r && r.type) ? r.type : '');
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    if (infoHost) {
      const pingTxt = (meta && meta.ping) ? `Ping: ${esc(meta.ping)}` : 'OK';
      const total = list.length;
      const pills = Object.keys(byType).sort().map(k => 
        `<span class="attrec-pill neutral">${esc(typeLabel(k))}: ${esc(byType[k])}</span>`
      ).join(' ');

      infoHost.innerHTML = `
        <span class="attrec-pill ok">${pingTxt}</span>
        <span class="attrec-pill neutral">件数: ${esc(total)}</span>
        ${pills}
      `;
    }

    if (!list.length) {
      tableHost.innerHTML = `
        <div class="empty-state">
          <div style="font-size:28px;">🗂️</div>
          <div>データがありません</div>
        </div>
      `;
      return;
    }

    const table = document.createElement('table');
    table.className = 'dash-table cal-dash-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>日付</th><th>曜日</th><th>種別</th><th>休日</th><th>名称</th><th>English</th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');

    for (const r of list) {
      const dt = String((r && r.date) ? r.date : '').slice(0, 10);
      const nm = splitLabel((r && r.name) ? r.name : '');
      const off = Number((r && r.is_off) ? r.is_off : 0) ? '休' : '';
      const offCls = Number((r && r.is_off) ? r.is_off : 0) ? 'attrec-pill ok' : 'attrec-pill neutral';

      const tr = document.createElement('tr');
      tr.className = Number((r && r.is_off) ? r.is_off : 0)
        ? 'cal-row off'
        : (isWeekend(dt) ? 'cal-row weekend' : 'cal-row');

      tr.innerHTML = `
        <td>${esc(dt)}</td>
        <td>${esc(dowJa(dt))}</td>
        <td>${esc(typeLabel((r && r.type) ? r.type : ''))}</td>
        <td><span class="${offCls}">${esc(off || '—')}</span></td>
        <td title="${esc(nm.ja)}">${esc(nm.ja || '')}</td>
        <td title="${esc(nm.en)}">${esc(nm.en || '')}</td>
      `;
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableHost.innerHTML = '';
    tableHost.appendChild(table);
  };

  const load = async () => {
    if (!tableHost) return;

    tableHost.innerHTML = `
      <div class="empty-state">
        <div style="font-size:28px;">⏳</div>
        <div>読み込み中…</div>
      </div>
    `;
    if (infoHost) infoHost.innerHTML = '';

    const yEl = content.querySelector('#calYear');
    const mEl = content.querySelector('#calMonth');
    const onlyEl = content.querySelector('#calOnlyOff');
    const y = parseInt((yEl && yEl.value) ? yEl.value : year0, 10);
    const mSel = String((mEl && mEl.value) ? mEl.value : '');
    const onlyOff = !!(onlyEl && onlyEl.checked);

    const ping = await api.get(`/api/admin/calendar/ping?year=${encodeURIComponent(y)}`).catch(() => null);
    const raw = await api.get(`/api/admin/calendar/raw?year=${encodeURIComponent(y)}`).catch(() => null);

    let rows = (raw && Array.isArray(raw.rows)) ? raw.rows : [];
    if (mSel) rows = rows.filter(r => monthOf(r && r.date ? r.date : '') === mSel);
    if (onlyOff) rows = rows.filter(r => Number((r && r.is_off) ? r.is_off : 0) === 1);

    rows.sort((a, b) =>
      String((a && a.date) ? a.date : '').localeCompare(String((b && b.date) ? b.date : '')) ||
      String((a && a.type) ? a.type : '').localeCompare(String((b && b.type) ? b.type : ''))
    );

    render(rows, { ping: (ping && ping.version) ? ping.version : null });
  };

  // Event listeners (có signal để auto cleanup)
  const btnLoad = content.querySelector('#calLoad');
  const mEl = content.querySelector('#calMonth');
  const onlyEl = content.querySelector('#calOnlyOff');
  const yEl = content.querySelector('#calYear');
  if (btnLoad) btnLoad.addEventListener('click', load, { signal });
  if (mEl) mEl.addEventListener('change', load, { signal });
  if (onlyEl) onlyEl.addEventListener('change', load, { signal });

  const btnCsv = content.querySelector('#calExportCsv');
  if (btnCsv) btnCsv.addEventListener('click', async () => {
    const yEl2 = content.querySelector('#calYear');
    const y = parseInt((yEl2 && yEl2.value) ? yEl2.value : year0, 10);
    const url = `/api/admin/calendar/export.xlsx?year=${encodeURIComponent(y)}&type=jp_auto,jp_substitute,jp_bridge,fixed,custom&include_nonoff=false`;
    try {
      await downloadWithAuth(url, `company_holidays_${y}.xlsx`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  }, { signal });

  const btnIcs = content.querySelector('#calExportIcs');
  if (btnIcs) btnIcs.addEventListener('click', async () => {
    const yEl3 = content.querySelector('#calYear');
    const y = parseInt((yEl3 && yEl3.value) ? yEl3.value : year0, 10);
    const url = `/api/admin/calendar/export?year=${encodeURIComponent(y)}&include_nonoff=false&lang=ja`;
    try {
      await downloadWithAuth(url, `company_holidays_${y}.ics`);
    } catch (e) {
      alert(String((e && e.message) ? e.message : 'エクスポートに失敗しました'));
    }
  }, { signal });

  if (yEl) yEl.addEventListener('change', () => {
    const y = parseInt((yEl && yEl.value) ? yEl.value : year0, 10);
    const sel = content.querySelector('#calMonth');
    if (sel) {
      sel.innerHTML = `<option value="">全て</option>` +
        Array.from({ length: 12 }).map((_, i) => {
          const m = pad2(i + 1);
          const v = `${y}-${m}`;
          return `<option value="${esc(v)}">${esc(v)}</option>`;
        }).join('');
    }
    load();
  }, { signal });

  await load();
}

// Cleanup khi rời tab
export function unmountCalendar() {
  if (controller) {
    controller.abort();
    controller = null;
  }
}
