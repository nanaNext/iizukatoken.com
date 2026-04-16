import { listMyRequests, createRequest, listMyRecentAppliedTypes } from '../api/requests.api.js';

const $ = (s) => document.querySelector(s);

const pinKey = 'se.req.pin';
const shouldAutoFocus = () => false;

function loadPin() {
  try { return localStorage.getItem(pinKey) === '1'; } catch { return false; }
}
function savePin(v) {
  try { localStorage.setItem(pinKey, v ? '1' : '0'); } catch {}
}

function renderRows(rows) {
  const body = $('#reqBody');
  const table = $('#reqTable');
  const empty = $('#reqEmpty');
  if (!body) return;
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) {
    body.innerHTML = '';
    if (table) table.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (table) table.hidden = false;
  if (empty) empty.hidden = true;
  body.innerHTML = list.map((r) => {
    const no = r.request_no || r.requestNo || '';
    const status = r.status || '';
    const type = r.record_type || r.recordType || '';
    const detail = r.detail || '';
    const office = r.office || '';
    const staff = (window.userName || $('#userName')?.textContent || '').trim();
    return `
      <tr>
        <td><a href="javascript:void(0)">${no}</a></td>
        <td>${status}</td>
        <td>${type}</td>
        <td>${detail ? detail.replace(/</g,'&lt;') : ''}</td>
        <td>${staff}</td>
        <td>${office}</td>
        <td></td>
      </tr>
    `;
  }).join('');
}

let requestSeq = 0;
let lastLoadedQuery = null;

async function load(q = '', options = {}) {
  const force = !!(options && options.force);
  const query = String(q || '').trim();
  if (!force && lastLoadedQuery === query) return;
  const seq = ++requestSeq;
  const res = await listMyRequests(q);
  if (seq !== requestSeq) return;
  const rows = res?.data || [];
  renderRows(rows);
  lastLoadedQuery = query;
  try {
    if (typeof window.__reqRecentHook === 'function') window.__reqRecentHook(rows);
  } catch {}
}

function bindUI() {
  const openListByDefault = false;
  const keepNewListOpen = false;
  const modal = $('#reqModal');
  const btnNew = $('#btnNew');
  const btnCancel = $('#btnCancel');
  const btnCreate = $('#btnCreate');
  const searchInput = $('#searchInput');
  const pinBtn = $('#pinBtn');
  const listBtn = $('#listBtn');
  const listMenu = $('#listMenu');
  const listRecent = $('#listRecent');
  const listAll = $('#listAll');
  const listFilter = $('#listFilter');
  const listAllSection = $('#listAllSection');
  const newListMenu = $('#newListMenu');
  const newListAll = $('#newListAll');
  const newListFilter = $('#newListFilter');
  const quickType = $('#quickType');
  const quickDetail = $('#quickDetail');
  const quickOffice = $('#quickOffice');
  const quickCreateBtn = $('#quickCreateBtn');
  const toolRefresh = $('#toolRefresh');
  const toolEdit = $('#toolEdit');
  const toolSettings = $('#toolSettings');
  const toolView = $('#toolView');
  const settingsMenu = $('#settingsMenu');
  const settingsTip = $('#settingsTip');
  const setNew = $('#setNew');
  const setCopy = $('#setCopy');
  const setRename = $('#setRename');
  const setShare = $('#setShare');
  const setColumns = $('#setColumns');
  const setDelete = $('#setDelete');
  const setResetWidth = $('#setResetWidth');
  const closeNewList = () => {
    if (!newListMenu) return;
    newListMenu.hidden = true;
    btnNew?.setAttribute('aria-expanded', 'false');
  };
  if (listMenu) listMenu.hidden = !openListByDefault;
  if (listBtn) listBtn.setAttribute('aria-expanded', openListByDefault ? 'true' : 'false');
  // New button now opens the full-list picker
  if (btnNew) {
    const ensureNewListOpen = () => {
      if (!newListMenu) return;
      try {
        const renderNewList = (filterText = '') => {
          const q = String(filterText || '').toLowerCase();
          const sel = loadSel();
          const mk = (it) => `<div class="req-list-item" role="option" data-name="${it.name}" aria-selected="${sel===it.name?'true':'false'}"><span class="check">✓</span><span class="label">${it.display}</span></div>`;
          if (newListAll) newListAll.innerHTML = allItems.filter(it => (it.display.toLowerCase().includes(q) || it.label.toLowerCase().includes(q))).map(mk).join('');
        };
        if (newListFilter && !newListFilter.dataset.boundInput) {
          newListFilter.dataset.boundInput = '1';
          newListFilter.oninput = () => {
            renderNewList(newListFilter.value || '');
          };
        }
        renderNewList(newListFilter?.value || '');
      } catch {}
      newListMenu.hidden = false;
      btnNew.setAttribute('aria-expanded', 'true');
      if (!keepNewListOpen && shouldAutoFocus()) {
        try { newListFilter?.focus(); } catch {}
      }
    };

    if (keepNewListOpen) setTimeout(ensureNewListOpen, 0);

    btnNew.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!newListMenu) return;
      if (keepNewListOpen) {
        ensureNewListOpen();
        return;
      }
      const open = btnNew.getAttribute('aria-expanded') === 'true';
      if (open) {
        closeNewList();
      } else {
        if (newListFilter) newListFilter.value = '';
        ensureNewListOpen();
      }
    });
    document.addEventListener('click', (e) => {
      if (keepNewListOpen) return;
      if (!newListMenu || newListMenu.hidden) return;
      const inside = newListMenu.contains(e.target) || e.target === btnNew;
      if (!inside) {
        closeNewList();
      }
    });
  }
  if (btnCancel && modal) btnCancel.addEventListener('click', () => { modal.hidden = true; });
  if (btnCreate) {
    btnCreate.addEventListener('click', async () => {
      const recordType = $('#recordType').value;
      const detail = $('#detail').value.trim();
      const office = $('#office').value.trim();
      try {
        await createRequest({ recordType, detail, office });
        if (modal) modal.hidden = true;
        await load($('#searchInput')?.value || '', { force: true });
      } catch (e) {
        alert(e?.message || '保存に失敗しました');
      }
    });
  }
  if (pinBtn) {
    const pinned = loadPin();
    pinBtn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
    pinBtn.addEventListener('click', () => {
      const cur = pinBtn.getAttribute('aria-pressed') === 'true';
      const next = !cur;
      pinBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
      savePin(next);
    });
  }
  if (searchInput) {
    let searchTimer = null;
    const runSearch = async () => { await load(searchInput.value || ''); };
    const onInput = () => {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { runSearch(); }, 220);
    };
    searchInput.addEventListener('input', onInput);
    searchInput.addEventListener('change', runSearch);
  }
  const keySel = 'se.req.list.sel';
  const recentKey = (() => {
    const uname = String(window.userName || $('#userName')?.textContent || 'guest').trim() || 'guest';
    return `se.req.recent.${uname}`;
  })();
  let recentItems = [];
  let appliedItems = [];
  const allRaw = [
    '01_私の月次コミュニケーションシート',
    '02_私のファイル提出',
    '03_私の各種証明書発行依頼',
    '04_私の給与振込口座変更',
    '05_私のキャリア自己申告',
    '06_私の住所・連絡先・通勤手当等の申請',
    '07_私の氏名変更',
    '08_私の資格取得・通信教育／eラーニング・企業内表彰・特許申請 報告',
    '09～10_私の各種奨励金・補助金申請',
    '11_私のスキルアップ',
    '11_私の資格取得チャレンジキャンペーン申請',
    '13_私の目標設定シート',
    '14_私のWill-Can-Mustシート',
    '15_私の着任報告書',
    '16_私のキャリア自己申告',
    '17_私の待機計画書',
    '18_私の待機報告書',
    '1私9の着任報告書',
    '20_私の入社時申請'
  ];
  const normalizeLabel = (name) => {
    const p = String(name || '');
    const atUnderscore = p.indexOf('_');
    if (atUnderscore > -1) return p.slice(atUnderscore + 1).trim();
    return p.replace(/^\d+\s*[＿_－-]\s*/, '').trim();
  };
  const uniqueSortedItems = (arr) => {
    const map = new Map();
    for (const n of arr) {
      const key = normalizeLabel(n).toLowerCase();
      if (!map.has(key)) map.set(key, n);
    }
    const uniq = Array.from(map.values());
    const parseNum = (n) => {
      const m = String(n).match(/^(\d{1,2})/);
      return m ? parseInt(m[1], 10) : 999;
    };
    uniq.sort((a, b) => parseNum(a) - parseNum(b));
    return uniq.map((orig, i) => {
      const label = normalizeLabel(orig);
      const num = String(i + 1).padStart(2, '0');
      return { name: orig, label, display: `${num}_${label}` };
    });
  };
  const allItems = uniqueSortedItems(allRaw);
  const loadRecent = () => {
    try {
      const raw = localStorage.getItem(recentKey) || '[]';
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.map(v => String(v || '').trim()).filter(Boolean).slice(0, 8);
    } catch {
      return [];
    }
  };
  const saveRecent = (arr) => {
    try { localStorage.setItem(recentKey, JSON.stringify((arr || []).slice(0, 8))); } catch {}
  };
  const mergeRecent = (arr) => {
    const seen = new Set();
    const out = [];
    for (const v of arr || []) {
      const s = String(v || '').trim();
      if (!s) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
      if (out.length >= 8) break;
    }
    recentItems = out;
    saveRecent(out);
  };
  const updateRecentFromRows = (rows) => {
    const fromRows = (rows || []).map((r) => {
      const type = r?.record_type || r?.recordType || '';
      const no = r?.request_no || r?.requestNo || '';
      return String(type || no || '').trim();
    }).filter(Boolean);
    if (!fromRows.length) return;
    mergeRecent([...fromRows, ...recentItems]);
    const typed = (rows || []).map((r) => String(r?.record_type || r?.recordType || '').trim()).filter(Boolean);
    const seen = new Set();
    appliedItems = [];
    for (const t of typed) {
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      appliedItems.push(t);
      if (appliedItems.length >= 50) break;
    }
  };
  const loadRecentAppliedFromServer = async () => {
    try {
      const res = await listMyRecentAppliedTypes(20);
      const data = Array.isArray(res?.data) ? res.data : [];
      const types = data
        .map((r) => String(r?.record_type || '').trim())
        .filter(Boolean);
      if (!types.length) return;
      mergeRecent([...types, ...recentItems]);
      const seen = new Set();
      appliedItems = [];
      for (const t of types) {
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        appliedItems.push(t);
        if (appliedItems.length >= 50) break;
      }
      renderList(listFilter?.value || '');
    } catch {}
  };
  recentItems = loadRecent();
  const saveSel = (v) => { try { localStorage.setItem(keySel, v); } catch {} };
  const loadSel = () => { try { return localStorage.getItem(keySel) || ''; } catch { return '' } };
  const renderList = (filter = '') => {
    const q = String(filter || '').toLowerCase();
    const sel = loadSel();
    const mk = (it) => `<div class="req-list-item" role="option" data-name="${it.name}" aria-selected="${sel===it.name?'true':'false'}"><span class="check">✓</span><span class="label">${it.display}</span></div>`;
    if (listRecent) listRecent.innerHTML = recentItems.filter(n => n.toLowerCase().includes(q)).map(n => mk({ name: n, label: n, display: n })).join('');
    if (listAll) {
      listAll.innerHTML = appliedItems
        .filter(n => n.toLowerCase().includes(q))
        .map(n => mk({ name: n, label: n, display: n }))
        .join('');
    }
    if (listAllSection) listAllSection.style.display = appliedItems.length ? '' : 'none';
  };
  window.__reqRecentHook = (rows) => {
    updateRecentFromRows(rows);
    renderList(listFilter?.value || '');
  };
  renderList('');
  loadRecentAppliedFromServer();
  const openMenu = () => {
    if (!listMenu) return;
    listMenu.hidden = false;
    listBtn?.setAttribute('aria-expanded','true');
    renderList('');
    if (shouldAutoFocus()) {
      listFilter?.focus();
    }
  };
  const closeMenu = () => {
    if (!listMenu) return;
    listMenu.hidden = true;
    listBtn?.setAttribute('aria-expanded','false');
  };
  if (listBtn && listMenu) {
    listBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = listBtn.getAttribute('aria-expanded') === 'true';
      if (open) closeMenu(); else openMenu();
    });
    document.addEventListener('click', (e) => {
      if (!listMenu.hidden && !listMenu.contains(e.target) && e.target !== listBtn) closeMenu();
    });
  }
  if (listFilter) {
    listFilter.addEventListener('input', () => renderList(listFilter.value || ''));
  }
  const attachClick = (root) => {
    if (!root) return;
    root.addEventListener('click', async (e) => {
      const el = e.target.closest('.req-list-item');
      if (!el) return;
      const name = el.getAttribute('data-name');
      saveSel(name);
      mergeRecent([name, ...recentItems]);
      renderList(listFilter?.value || '');
      closeMenu();
      await load(name);
    });
  };
  attachClick(listRecent);
  attachClick(listAll);
  attachClick(newListAll);

  if (quickCreateBtn) {
    quickCreateBtn.addEventListener('click', async () => {
      const recordType = quickType?.value || '';
      const detail = (quickDetail?.value || '').trim();
      const office = (quickOffice?.value || '').trim();
      try {
        await createRequest({ recordType, detail, office });
        closeNewList();
        await load(searchInput?.value || '', { force: true });
        await loadRecentAppliedFromServer();
      } catch (e) {
        alert(e?.message || '保存に失敗しました');
      }
    });
  }

  if (toolRefresh) {
    toolRefresh.addEventListener('click', async () => {
      closeNewList();
      await load(searchInput?.value || '', { force: true });
    });
  }
  if (toolEdit && modal) {
    toolEdit.addEventListener('click', () => { closeNewList(); modal.hidden = false; });
  }
  if (toolSettings) {
    toolSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      if (settingsTip) settingsTip.hidden = true;
      if (!settingsMenu) return;
      const open = settingsMenu.hidden === false;
      settingsMenu.hidden = open;
      toolSettings.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    toolSettings.addEventListener('mouseenter', () => { if (settingsTip) settingsTip.hidden = false; });
    toolSettings.addEventListener('mouseleave', () => { if (settingsTip) settingsTip.hidden = true; });
    toolSettings.addEventListener('focus', () => { if (settingsTip) settingsTip.hidden = false; });
    toolSettings.addEventListener('blur', () => { if (settingsTip) settingsTip.hidden = true; });
    document.addEventListener('click', () => {
      if (!settingsMenu) return;
      if (!settingsMenu.hidden) {
        settingsMenu.hidden = true;
        toolSettings.setAttribute('aria-expanded', 'false');
      }
      if (settingsTip) settingsTip.hidden = true;
    });
  }
  if (toolView) {
    toolView.addEventListener('click', () => {
      closeNewList();
      const tbl = document.querySelector('.req-table');
      if (!tbl) return;
      tbl.classList.toggle('compact');
    });
  }

  if (setNew && btnNew) {
    setNew.addEventListener('click', () => {
      btnNew.click();
      if (settingsMenu && !settingsMenu.hidden) settingsMenu.hidden = true;
      toolSettings?.setAttribute('aria-expanded', 'false');
    });
  }
  if (setResetWidth) {
    setResetWidth.addEventListener('click', () => {
      document.querySelectorAll('.req-table th').forEach(th => {
        try { th.style.width = ''; } catch {}
        try { th.removeAttribute('style'); } catch {}
      });
      if (settingsMenu && !settingsMenu.hidden) settingsMenu.hidden = true;
      toolSettings?.setAttribute('aria-expanded', 'false');
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try { window.userName = $('#userName')?.textContent || ''; } catch {}
  bindUI();
  await load('', { force: true });
});
