(function () {
  const root = globalThis.AttendanceMonthly || {};
  const core = root.Core || globalThis.MonthlyMonthlyCore || {};
  const state = root.State || globalThis.MonthlyMonthlyState || {};
  const render = root.Render || globalThis.MonthlyMonthlyRender || {};

  const { cssEscape, setDirty } = core;
  const { recomputeRow } = render;

  const KEY_PREFIX = 'se.attMonthlyDraft.v2:';
  const MAX_BYTES = 3500000;

  const safeJSONParse = (s) => {
    try { return JSON.parse(String(s || '')); } catch { return null; }
  };

  const safeJSONSet = (key, value) => {
    try {
      const str = JSON.stringify(value);
      if (str.length > MAX_BYTES) return false;
      localStorage.setItem(key, str);
      return true;
    } catch {
      return false;
    }
  };

  const ymKey = (ctx, ym) => {
    const uid = String(ctx?.actingUserId || ctx?.profile?.id || 'me').trim() || 'me';
    const m = String(ym || ctx?.picker?.value || ctx?.initialYM || '').slice(0, 7);
    return `${KEY_PREFIX}${uid}:${m}`;
  };

  const listKeysForUser = (ctx) => {
    const uid = String(ctx?.actingUserId || ctx?.profile?.id || 'me').trim() || 'me';
    const prefix = `${KEY_PREFIX}${uid}:`;
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) out.push(k);
      }
    } catch {}
    return out;
  };

  const capture = (ctx, ym) => {
    const host = ctx?.tableHost;
    if (!host) return false;
    const key = ymKey(ctx, ym);
    const rows = Array.from(host.querySelectorAll('[data-date][data-row]'));

    const items = [];
    for (const row of rows) {
      if (String(row.dataset?.dirty || '') !== '1') continue;
      const date = String(row.getAttribute('data-date') || '').slice(0, 10);
      const rowNo = String(row.getAttribute('data-row') || '');
      if (!date || !rowNo) continue;
      const fields = Array.from(row.querySelectorAll('input[data-field], select[data-field], textarea[data-field]'));
      for (let i = 0; i < fields.length; i++) {
        const el = fields[i];
        const field = String(el.getAttribute('data-field') || '').trim();
        if (!field) continue;
        const tag = el.tagName.toLowerCase();
        const type = tag === 'input' ? String(el.getAttribute('type') || '').toLowerCase() : '';
        if (type === 'file' || type === 'password') continue;
        const id = String(el.id || '');
        const val = type === 'checkbox' ? !!el.checked : String(el.value == null ? '' : el.value);
        items.push({ date, row: rowNo, field, i, tag, type, id, val });
      }
    }

    const summaryWrap = document.querySelector('#summaryEditor');
    if (summaryWrap) {
      const els = Array.from(summaryWrap.querySelectorAll('input, select, textarea'));
      for (const el of els) {
        const tag = el.tagName.toLowerCase();
        const type = tag === 'input' ? String(el.getAttribute('type') || '').toLowerCase() : '';
        if (type === 'file' || type === 'password') continue;
        const id = String(el.id || '');
        if (!id) continue;
        const val = type === 'checkbox' ? !!el.checked : String(el.value == null ? '' : el.value);
        items.push({ id: `id:${id}`, val, tag, type });
      }
    }

    const payload = { version: 2, savedAt: Date.now(), ym: String(ym || '').slice(0, 7), items };
    return safeJSONSet(key, payload);
  };

  const applyOne = (ctx, entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.id && String(entry.id).startsWith('id:')) {
      const id = String(entry.id).slice(3);
      const el = document.getElementById(id);
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      const type = tag === 'input' ? String(el.getAttribute('type') || '').toLowerCase() : '';
      if (type === 'checkbox') el.checked = !!entry.val;
      else el.value = String(entry.val == null ? '' : entry.val);
      return true;
    }

    const host = ctx?.tableHost;
    if (!host) return false;
    const date = String(entry.date || '').slice(0, 10);
    const rowNo = String(entry.row || '');
    const field = String(entry.field || '').trim();
    if (!date || !rowNo || !field) return false;

    const row = host.querySelector(`[data-date="${cssEscape(date)}"][data-row="${cssEscape(rowNo)}"]`);
    if (!row) return false;
    const matches = Array.from(row.querySelectorAll(`input[data-field="${cssEscape(field)}"], select[data-field="${cssEscape(field)}"], textarea[data-field="${cssEscape(field)}"]`));
    const idx = Math.max(0, Number(entry.i || 0));
    const el = matches[idx] || matches[0] || null;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? String(el.getAttribute('type') || '').toLowerCase() : '';
    if (type === 'checkbox') el.checked = !!entry.val;
    else el.value = String(entry.val == null ? '' : entry.val);

    try {
      row.dataset.dirty = '1';
      row.dataset.kubunConfirmed = '1';
    } catch {}
    try { recomputeRow(row); } catch {}
    return true;
  };

  const restore = (ctx, ym) => {
    const key = ymKey(ctx, ym);
    const raw = (() => { try { return localStorage.getItem(key); } catch { return null; } })();
    const data = safeJSONParse(raw);
    if (Number(data?.version || 0) !== 2) return { ok: false, restored: 0 };
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) return { ok: false, restored: 0 };

    let restored = 0;
    for (const it of items) {
      if (applyOne(ctx, it)) restored++;
    }
    if (restored) {
      try { setDirty(); } catch { state.dirty = true; }
    }
    return { ok: restored > 0, restored };
  };

  const clear = (ctx, ym) => {
    const key = ymKey(ctx, ym);
    try { localStorage.removeItem(key); } catch {}
  };

  const clearAllForUser = (ctx) => {
    const keys = listKeysForUser(ctx);
    for (const k of keys) {
      try { localStorage.removeItem(k); } catch {}
    }
  };

  let saveTimer = 0;
  const schedule = (ctx, ym, delayMs = 700) => {
    try { clearTimeout(saveTimer); } catch {}
    saveTimer = setTimeout(() => { capture(ctx, ym); }, Math.max(150, Number(delayMs || 0)));
  };

  const flush = () => {
    try {
      const c = root.Controller?.ctx;
      const ym = c?.picker?.value || c?.initialYM || '';
      if (c) capture(c, ym);
    } catch {}
  };

  try {
    const g = globalThis;
    if (!Array.isArray(g.__draftFlushers)) g.__draftFlushers = [];
    g.__draftFlushers.push(flush);
  } catch {}

  const Draft = { capture, restore, clear, clearAllForUser, schedule, flush };
  root.Draft = Draft;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlyDraft = Draft;
})();
