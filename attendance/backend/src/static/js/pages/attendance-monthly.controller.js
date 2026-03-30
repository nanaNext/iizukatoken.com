(function () {
  const root = globalThis.AttendanceMonthly || {};
  const core = root.Core || globalThis.MonthlyMonthlyCore || {};
  const state = root.State || globalThis.MonthlyMonthlyState || {};
  const render = root.Render || globalThis.MonthlyMonthlyRender || {};
  const api = root.Api || globalThis.MonthlyMonthlyApi || {};
  const sectionsRender = root.SectionsRender || globalThis.MonthlyMonthlySectionsRender || {};
  const draft = root.Draft || globalThis.MonthlyMonthlyDraft || null;

  const { $, showSpinner, hideSpinner, fetchJSONAuth, downloadWithAuth, ensureAuthProfile, showErr, setDirty, clearDirty, monthJST, addMonths, cssEscape, fromDateTime, workTypeLabel } = core;
  const { renderTable, markRowSaved, recomputeRow } = render;
  const { loadMonth, collectUpdates } = api;
  const { renderContract, renderWorkDetail, renderSummary } = sectionsRender;

  const ctx = {
    profile: null,
    role: '',
    actingUserId: '',
    initialYM: '',
    picker1: null,
    picker2: null,
    picker: null,
    summaryHost: null,
    tableHost: null,
    contractHost: null,
    workDetailHost: null,
    wfWrap: null,
    pinMonthHeadMode: 'bottom',
    btnPin: null,
    autoSaveTimer: null,
    autoSaveInFlight: false,
    lastAutoSavePayload: '',
    userPicker: null,
    applyContractTab: null,
    applySummaryTab: null,
    summaryEditorWrap: null
  };

  const getDailyCollapsed = () => {
    try { return localStorage.getItem('monthly.dailyCollapsed') === '1'; } catch { return false; }
  };
  const setDailyCollapsed = (v) => {
    try { localStorage.setItem('monthly.dailyCollapsed', v ? '1' : '0'); } catch {}
  };
  const applyDailyCollapsed = (collapsed) => {
    const sec = $('#dailySection');
    const btn = $('#dailyToggle');
    if (sec) {
      try { sec.classList.toggle('collapsed', !!collapsed); } catch {}
    }
    if (btn) {
      try { btn.setAttribute('aria-pressed', collapsed ? 'true' : 'false'); } catch {}
      try { btn.setAttribute('aria-label', collapsed ? '日次実績を展開する' : '日次実績を折りたたむ'); } catch {}
    }
  };

  const getContractCollapsed = () => {
    try { return localStorage.getItem('monthly.contractCollapsed') === '1'; } catch { return false; }
  };
  const setContractCollapsed = (v) => {
    try { localStorage.setItem('monthly.contractCollapsed', v ? '1' : '0'); } catch {}
  };
  const applyContractCollapsed = (collapsed) => {
    const sec = $('#contractSection');
    const btn = $('#contractToggle');
    if (sec) {
      try { sec.classList.toggle('collapsed', !!collapsed); } catch {}
    }
    if (btn) {
      try { btn.setAttribute('aria-pressed', collapsed ? 'true' : 'false'); } catch {}
      try { btn.setAttribute('aria-label', collapsed ? '契約先一覧を展開する' : '契約先一覧を折りたたむ'); } catch {}
    }
  };

  const getSummaryCollapsed = () => {
    try { return localStorage.getItem('monthly.summaryCollapsed') === '1'; } catch { return false; }
  };
  const setSummaryCollapsed = (v) => {
    try { localStorage.setItem('monthly.summaryCollapsed', v ? '1' : '0'); } catch {}
  };
  const applySummaryCollapsed = (collapsed) => {
    const sec = $('#summarySection');
    const btn = $('#summaryToggle');
    if (sec) {
      try { sec.classList.toggle('collapsed', !!collapsed); } catch {}
    }
    if (btn) {
      try { btn.setAttribute('aria-pressed', collapsed ? 'true' : 'false'); } catch {}
      try { btn.setAttribute('aria-label', collapsed ? '当月サマリを展開する' : '当月サマリを折りたたむ'); } catch {}
    }
  };

  const getAnnualCollapsed = () => {
    try { return localStorage.getItem('monthly.annualCollapsed') === '1'; } catch { return false; }
  };
  const setAnnualCollapsed = (v) => {
    try { localStorage.setItem('monthly.annualCollapsed', v ? '1' : '0'); } catch {}
  };
  const applyAnnualCollapsed = (collapsed) => {
    const sec = $('#annualSection');
    const btn = $('#annualToggle');
    if (sec) {
      try { sec.classList.toggle('collapsed', !!collapsed); } catch {}
    }
    if (btn) {
      try { btn.setAttribute('aria-pressed', collapsed ? 'true' : 'false'); } catch {}
      try { btn.setAttribute('aria-label', collapsed ? '年間サマリを展開する' : '年間サマリを折りたたむ'); } catch {}
    }
  };

  const syncFooterVars = () => {
    try {
      const main = document.querySelector('.kintai-main');
      const bb = document.querySelector('.se-bottombar');
      const page = document.querySelector('.layout-contents') || document.querySelector('.layout-main') || document.querySelector('.se-month');
      const hs = document.querySelector('#monthHScroll');
      if (!bb) return;
      const h = bb.offsetHeight || 0;
      const bottom = parseFloat(getComputedStyle(bb).bottom || '0') || 0;
      const hsVisible = (() => {
        try {
          if (!hs) return false;
          if (hs.hasAttribute('hidden')) return false;
          const cs = getComputedStyle(hs);
          if (cs.display === 'none') return false;
          return true;
        } catch {
          return !!hs && !hs.hasAttribute('hidden');
        }
      })();
      const hsH = hsVisible ? (hs.offsetHeight || 16) : 0;
      const gap = 8;
      const reserved = Math.max(0, h + hsH + gap);
      const pad = Math.max(0, reserved + bottom);
      if (page) page.style.paddingBottom = `${pad}px`;
      if (main) {
        main.style.setProperty('--se-bottom-bar-h', `${reserved}px`);
        main.style.setProperty('--se-bottom-bar-bottom', `${bottom}px`);
        main.style.setProperty('--se-bb-h', `${h}px`);
        main.style.setProperty('--se-hs-h', `${hsH}px`);
      }
    } catch {}
  };

  const syncStickyTop = () => {
    try {
      const top = document.querySelector('.kintai-top');
      const h = top ? Math.max(0, Math.round(top.getBoundingClientRect().height || 0)) : 0;
      document.documentElement.style.setProperty('--se-sticky-top', `${h}px`);
    } catch {}
  };

  const syncTheadRowHeights = () => {
    try {
      const host = document.querySelector('#monthTable');
      const t = host?.querySelector('table');
      const r1 = t?.querySelector('thead tr');
      const h = r1 ? Math.max(0, Math.round(r1.getBoundingClientRect().height || 0)) : 0;
      host?.style.setProperty('--se-thead-row1', `${h}px`);
    } catch {}
  };

  const buildTargetDateSelect = (initialYM) => {
    const sel = document.querySelector('#targetDateSelect');
    if (!sel) return;
    const ym = String(initialYM || monthJST()).slice(0, 7);
    const [y, m] = ym.split('-').map(n => parseInt(n, 10));
    const opts = [];
    for (let i = -18; i <= 6; i++) {
      const dt = new Date(Date.UTC(y, (m - 1) + i, 1));
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const label = `${yy}年${mm}月`;
      const value = `${yy}${mm}`;
      opts.push({ value, label, ym: `${yy}-${mm}` });
    }
    sel.innerHTML = opts.map(o => `<option value="${o.value}" ${o.ym === ym ? 'selected' : ''}>${o.label}</option>`).join('');
  };

  const canEditForMonth = (ym, profile) => {
    const role = String(profile?.role || '').toLowerCase();
    if (state.currentMonthStatus === 'approved' && role === 'payroll') return false;
    if (state.currentMonthStatus === 'submitted' && role === 'payroll') return false;
    
    // Normalize ym to YYYY-MM
    let tgt = String(ym || '').trim();
    if (/^\d{6}$/.test(tgt)) tgt = tgt.slice(0, 4) + '-' + tgt.slice(4, 6);
    if (!/^\d{4}-\d{2}$/.test(tgt)) return false;

    if (role === 'employee') {
      const cur = String(monthJST() || '').slice(0, 7);
      // Cho phép nhân viên sửa "tháng hiện tại" và "tháng kế tiếp" (để nhập kế hoạch)
      const y = parseInt(tgt.slice(0, 4), 10);
      const m = parseInt(tgt.slice(5, 7), 10);
      const cy = parseInt(cur.slice(0, 4), 10);
      const cm = parseInt(cur.slice(5, 7), 10);
      const idx = y * 12 + m;
      const cidx = cy * 12 + cm;
      return idx === cidx || idx === cidx + 1;
    }
    const meId = String(profile?.id || '');
    const monthIndexLocal = (s) => {
      let v = String(s || '').slice(0, 7);
      if (/^\d{6}$/.test(v)) v = v.slice(0, 4) + '-' + v.slice(4, 6);
      const parts = v.split('-');
      if (parts.length !== 2) return NaN;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return NaN;
      return y * 12 + (m - 1);
    };
    const isEditableWindow = (targetYM, aheadMonths) => {
      const base = monthJST();
      const baseIdx = monthIndexLocal(base);
      const targetIdx = monthIndexLocal(targetYM);
      if (!Number.isFinite(baseIdx) || !Number.isFinite(targetIdx)) return false;
      // Allow editing past months (up to 2 months ago) and future months.
      return targetIdx >= (baseIdx - 2) && targetIdx <= (baseIdx + Math.max(0, Number(aheadMonths || 0)));
    };
    if (role === 'admin') return true;
    if (role === 'manager') {
      if (state.currentViewingUserId && meId && String(state.currentViewingUserId) !== meId) return false;
      return isEditableWindow(tgt, 6);
    }
    return isEditableWindow(tgt, 6);
  };

  const applyEditability = (ym) => {
    state.editableMonth = canEditForMonth(ym, ctx.profile);

    const host = document.querySelector('#monthTable');
    if (host) {
      const ctrls = Array.from(host.querySelectorAll('input, select, textarea, button'));
      for (const el of ctrls) {
        const isHistoryBtn = el.matches('button[data-action="history"]');
        if (isHistoryBtn) continue;
        if (state.editableMonth) {
          if (!el.hasAttribute('data-fixed-disabled') && !el.hasAttribute('data-row-disabled')) el.removeAttribute('disabled');
        } else {
          el.setAttribute('disabled', '');
        }
      }
    }

    for (const el of document.querySelectorAll('.saveBtn, #btnSave, #btnSaveBottom')) {
      el.toggleAttribute('disabled', !state.editableMonth);
    }
    for (const el of document.querySelectorAll('.importBtn, #importFile')) {
      el.toggleAttribute('disabled', !state.editableMonth);
    }
    for (const el of document.querySelectorAll('.exportBtn')) {
      el.removeAttribute('disabled');
    }

    if (!state.editableMonth) clearDirty();
  };

  const refreshAddButtons = (host) => {
    if (!host) return;
    const rows = Array.from(host.querySelectorAll('[data-row="1"][data-date]'));
    const counts = new Map();
    for (const r of rows) {
      const d = String(r.dataset.date || '');
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    for (const r of rows) {
      const d = String(r.dataset.date || '');
      const cnt = counts.get(d) || 0;
      const btn = r.querySelector('button[data-action="add"]');
      if (!btn) continue;
      btn.toggleAttribute('disabled', !state.editableMonth || cnt >= 3);
    }
  };

  const syncMonthHScroll = () => {
    const getRoot = () => document.querySelector('#monthTable');
    const getHost = () => {
      const r = getRoot();
      return r?.querySelector?.('.se-month-scroll') || r;
    };
    const bar = document.querySelector('#monthHScroll');
    if (!getHost() || !bar) return;
    const inner = bar.querySelector('.se-hscroll-inner');
    if (!inner) return;
    const main = document.querySelector('.kintai-main');

    const refresh = (attempt = 0) => {
      const host = getHost();
      const rootEl = getRoot();
      const headTables = Array.from(rootEl?.querySelectorAll?.('.se-sticky-month-head table') || []);
      const cw = host?.clientWidth || 0;
      const sw = host?.scrollWidth || 0;
      if ((cw === 0 || sw === 0) && attempt < 20) {
        requestAnimationFrame(() => refresh(attempt + 1));
        return;
      }
      try { inner.style.width = `${Math.max(sw, cw)}px`; } catch {}
      try { if (host) bar.scrollLeft = host.scrollLeft; } catch {}
      for (const ht of headTables) {
        try { ht.style.transform = `translateX(${- (host?.scrollLeft || 0)}px)`; } catch {}
      }
      try {
        const need = ((host?.scrollWidth || 0) > (host?.clientWidth || 0) + 1);
        const inView = (() => {
          try {
            const rr = host?.getBoundingClientRect();
            if (main) {
              const mr = main.getBoundingClientRect();
              return rr && rr.bottom > (mr.top + 48) && rr.top < (mr.bottom - 48);
            }
            return rr && rr.bottom > 0 && rr.top < window.innerHeight;
          } catch {
            return true;
          }
        })();
        bar.classList.toggle('inactive', !need);
        bar.style.display = (need && inView) ? '' : 'none';
        if (rootEl) {
          if (need) rootEl.classList.add('hide-xscroll');
          else rootEl.classList.remove('hide-xscroll');
        }
      } catch {}
      try { syncFooterVars(); } catch {}
    };

    if (bar.dataset.wired !== '1') {
      let syncing = false;
      bar.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        const host = getHost();
        const rootEl = getRoot();
        const headTables = Array.from(rootEl?.querySelectorAll?.('.se-sticky-month-head table') || []);
        try { if (host) host.scrollLeft = bar.scrollLeft; } catch {}
        for (const ht of headTables) {
          try { ht.style.transform = `translateX(${- (host?.scrollLeft || 0)}px)`; } catch {}
        }
        syncing = false;
      }, { passive: true });
      // Bind to current host; will be replaced on next syncMonthHScroll() after re-render
      const hostNow = getHost();
      hostNow?.addEventListener('scroll', () => {
        if (syncing) return;
        syncing = true;
        const host = getHost();
        const rootEl = getRoot();
        const headTables = Array.from(rootEl?.querySelectorAll?.('.se-sticky-month-head table') || []);
        try { if (host) bar.scrollLeft = host.scrollLeft; } catch {}
        for (const ht of headTables) {
          try { ht.style.transform = `translateX(${- (host?.scrollLeft || 0)}px)`; } catch {}
        }
        syncing = false;
      }, { passive: true });
      window.addEventListener('resize', () => { refresh(); }, { passive: true });
      bar.dataset.wired = '1';
    }

    refresh();
  };

  const wireMonthHScrollVisibility = () => {
    const rootEl = document.querySelector('#monthTable');
    const host = rootEl?.querySelector?.('.se-month-scroll') || rootEl;
    const bar = document.querySelector('#monthHScroll');
    if (!host || !bar) return;
    const main = document.querySelector('.kintai-main');
    let raf = 0;
    const apply = () => {
      raf = 0;
      try {
        const need = (host.scrollWidth || 0) > (host.clientWidth || 0) + 1;
        const inView = (() => {
          try {
            const rr = host.getBoundingClientRect();
            if (main) {
              const mr = main.getBoundingClientRect();
              return rr.bottom > (mr.top + 48) && rr.top < (mr.bottom - 48);
            }
            return rr.bottom > 0 && rr.top < window.innerHeight;
          } catch {
            return true;
          }
        })();
        bar.style.display = (need && inView) ? '' : 'none';
        if (rootEl) {
          if (need) rootEl.classList.add('hide-xscroll');
          else rootEl.classList.remove('hide-xscroll');
        }
      } catch {}
      try { syncFooterVars(); } catch {}
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    (main || window).addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
  };

  const wireFooterResize = () => {
    try {
      if (typeof ResizeObserver === 'undefined') return;
      const bb = document.querySelector('.se-bottombar');
      const hs = document.querySelector('#monthHScroll');
      if (!bb && !hs) return;
      const ro = new ResizeObserver(() => {
        try { syncFooterVars(); } catch {}
      });
      if (bb) ro.observe(bb);
      if (hs) ro.observe(hs);
    } catch {}
  };

  const ensureWorkflowUI = () => {
    const role = String(ctx.profile?.role || '').toLowerCase();
    if (role === 'employee') {
      try { document.querySelector('#monthWorkflow')?.remove(); } catch {}
      ctx.wfWrap = null;
      ctx.btnPin = null;
      return;
    }
    const wfHost = document.querySelector('.se-page-head') || document.querySelector('.se-month') || document.body;
    let wfWrap = document.querySelector('#monthWorkflow');
    if (!wfWrap) {
      wfWrap = document.createElement('div');
      wfWrap.id = 'monthWorkflow';
      wfWrap.style.display = 'flex';
      wfWrap.style.alignItems = 'center';
      wfWrap.style.gap = '8px';
      wfWrap.style.flexWrap = 'wrap';
      wfWrap.style.justifyContent = 'flex-end';
      wfWrap.style.marginTop = '6px';
      const btnApprove = document.createElement('button');
      btnApprove.type = 'button';
      btnApprove.id = 'btnApproveMonth';
      btnApprove.className = 'se-mini-btn';
      btnApprove.textContent = '承認';
      const btnUnlock = document.createElement('button');
      btnUnlock.type = 'button';
      btnUnlock.id = 'btnUnlockMonth';
      btnUnlock.className = 'se-mini-btn';
      btnUnlock.textContent = '解除';
      wfWrap.appendChild(btnApprove);
      wfWrap.appendChild(btnUnlock);
      wfHost.appendChild(wfWrap);
    }
    ctx.wfWrap = wfWrap;
    if (!ctx.btnPin) {
      const b = document.querySelector('#btnPinMonthHead') || document.createElement('button');
      b.type = 'button';
      b.id = 'btnPinMonthHead';
      b.className = 'se-mini-btn';
      b.textContent = 'ヘッダー: 下固定';
      b.style.display = 'none';
      b.setAttribute('aria-pressed', 'true');
      wfWrap?.appendChild(b);
      ctx.btnPin = b;
    }
  };

  const applyPinMonthHead = () => {
    const mode = String(ctx.pinMonthHeadMode || 'bottom');
    void mode;
    try {
      const host = document.querySelector('#monthTable');
      if (host) {
        host.classList.remove('pin-month-head-top', 'pin-month-head-bottom');
        host.classList.add('pin-month-head-bottom');
      }
    } catch {}
    try {
      if (!ctx.btnPin) return;
      ctx.btnPin.style.display = 'none';
      ctx.btnPin.setAttribute('aria-pressed', 'true');
    } catch {}
  };

  const updateMonthWorkflowUI = () => {
    const btnApprove = document.querySelector('#btnApproveMonth');
    const btnUnlock = document.querySelector('#btnUnlockMonth');
    const role = String(ctx.profile?.role || '').toLowerCase();
    const status = String(state.currentMonthStatus || 'draft');
    const isAdmin = role === 'admin';
    const isManager = role === 'manager';
    const isSelf = !ctx.actingUserId || String(ctx.actingUserId) === String(ctx.profile?.id || '');
    if (btnApprove) btnApprove.style.display = ((isManager || isAdmin) && !isSelf && status === 'submitted') ? '' : 'none';
    if (btnUnlock) btnUnlock.style.display = (isAdmin && (status === 'submitted' || status === 'approved')) ? '' : 'none';
    applyPinMonthHead();
  };

  const scheduleAutoSave = () => {
    if (!state.editableMonth) return;
    if (!ctx.tableHost) return;
    const ym = ctx.picker?.value || '';
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    try { clearTimeout(ctx.autoSaveTimer); } catch {}
    ctx.autoSaveTimer = setTimeout(async () => {
      if (!state.editableMonth) return;
      if (!ctx.tableHost) return;
      if (ctx.autoSaveInFlight) return;
      if (ctx.tableHost.querySelector('.invalid')) return;
      const payload = collectUpdates(ctx.tableHost, ym, ctx.actingUserId || null);
      const body = JSON.stringify(payload);
      if (!body || body === ctx.lastAutoSavePayload) return;
      ctx.autoSaveInFlight = true;
      try {
        const r = await fetchJSONAuth('/api/attendance/month/bulk', { method: 'PUT', body });
        try {
          const created = Array.isArray(r?.created) ? r.created : [];
          for (const c of created) {
            const cid = String(c?.clientId || '').trim();
            const id = c?.id;
            if (!cid || !id) continue;
            const tr = ctx.tableHost.querySelector(`[data-row="1"][data-client-id="${cssEscape(cid)}"]`);
            if (tr) tr.dataset.id = String(id);
          }
          if (created.length) ctx.lastAutoSavePayload = '';
        } catch {}
        try {
          const dates = new Set();
          for (const d of Array.isArray(payload?.dailyUpdates) ? payload.dailyUpdates : []) {
            const ds = String(d?.date || '').slice(0, 10);
            if (ds) dates.add(ds);
          }
          for (const u of Array.isArray(payload?.updates) ? payload.updates : []) {
            const id = u?.id != null ? String(u.id) : '';
            const cid = String(u?.clientId || '').trim();
            const tr = id ? ctx.tableHost.querySelector(`[data-row="1"][data-id="${cssEscape(id)}"]`)
              : cid ? ctx.tableHost.querySelector(`[data-row="1"][data-client-id="${cssEscape(cid)}"]`)
              : null;
            const ds = tr ? String(tr.dataset.date || '').slice(0, 10) : '';
            if (ds) dates.add(ds);
          }
          for (const ds of dates) {
            const tr = ctx.tableHost.querySelector(`[data-row="1"][data-date="${cssEscape(ds)}"]`);
            if (tr) markRowSaved(tr);
          }
        } catch {}
        ctx.lastAutoSavePayload = body;
        clearDirty();
        try { draft?.clear?.(ctx, ym); } catch {}
      } catch (e) {
        showErr(e?.message || '保存に失敗しました');
      } finally {
        ctx.autoSaveInFlight = false;
      }
    }, 900);
  };

  const setMonth = async (ym, replace = false) => {
    state.currentYM = String(ym || '').slice(0, 7);
    const url = new URL(window.location.href);
    url.searchParams.set('month', ym);
    try {
      if (replace) history.replaceState(null, '', url.pathname + url.search + url.hash);
      else history.pushState(null, '', url.pathname + url.search + url.hash);
    } catch {}
    if (ctx.picker1) ctx.picker1.value = ym;
    if (ctx.picker2) ctx.picker2.value = ym;
    showErr('');
    showSpinner();
    try {
      const { detail, timesheet } = await loadMonth(ym, ctx.actingUserId || null);
      state.currentMonthDetail = detail;
      state.currentMonthTimesheet = timesheet;
      try {
        const st = String(detail?.monthStatus?.status || '').trim();
        state.currentMonthStatus = st || 'draft';
      } catch {
        state.currentMonthStatus = 'draft';
      }
      try {
        const u2 = detail?.user || null;
        if (u2) {
          const code = u2.employee_code || u2.employeeCode || (u2.id ? ('EMP' + String(u2.id).padStart(3, '0')) : '');
          $('#empCode').textContent = code || '—';
          $('#staffName').textContent = u2.username || u2.email || '—';
          const officeCode = u2.office_code || u2.officeCode || '00084';
          $('#officeCode').textContent = String(officeCode || '').trim() || '—';
          $('#empDept').textContent = u2.departmentName || '—';
        }
      } catch {}
      renderContract(ctx.contractHost, detail);
      renderWorkDetail(ctx.workDetailHost, detail, ctx.profile);
      renderSummary(ctx.summaryHost, detail, timesheet);
      
      // Update editability BEFORE rendering table to ensure correct lock state
      state.editableMonth = canEditForMonth(ym, ctx.profile);
      
      renderTable(ctx.tableHost, detail, ctx.profile);
      applyPinMonthHead();
      applyEditability(ym);
      updateMonthWorkflowUI();
      try { draft?.restore?.(ctx, ym); } catch {}
      try {
        if (state.currentMonthStatus === 'submitted') showErr('この月は提出済のため編集できません。');
        else if (state.currentMonthStatus === 'approved') showErr('この月は締め済のため編集できません。');
      } catch {}
      syncFooterVars();
      syncTheadRowHeights();
      syncMonthHScroll();
      wireMonthHScrollVisibility();
      ctx.lastAutoSavePayload = '';
      if (typeof ctx.applyContractTab === 'function') ctx.applyContractTab();
      if (typeof ctx.applySummaryTab === 'function') ctx.applySummaryTab();
    } catch (e) {
      showErr(e?.message || '読み込みに失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const saveManual = async () => {
    if (!state.editableMonth) {
      alert('この月は入力できません。');
      return;
    }
    const ym = ctx.picker?.value || ctx.initialYM;
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    showErr('');
    showSpinner();
    try {
      try {
        const ae = document.activeElement;
        const row = ae?.closest?.('[data-row="1"][data-date]');
        try { ae?.blur?.(); } catch {}
        if (row) {
          row.dataset.dirty = '1';
          try {
            const sel = row.querySelector('select[data-field="classification"]');
            const v = String(sel?.value || '').trim();
            if (v) row.dataset.kubunConfirmed = '1';
          } catch {}
          try { root.Render?.recomputeRow?.(row); } catch {}
        }
      } catch {}
      try {
        const rows = Array.from(ctx.tableHost?.querySelectorAll?.('[data-row="1"][data-date]') || []);
        for (const tr of rows) {
          if (String(tr.dataset.dirty || '') === '1') continue;
          const sel = tr.querySelector('select[data-field="classification"]');
          const v = String(sel?.value || '').trim();
          const inEl = tr.querySelector('input.se-time[data-field="checkIn"]');
          const outEl = tr.querySelector('input.se-time[data-field="checkOut"]');
          const inV = String(inEl?.value || '').trim();
          const outV = String(outEl?.value || '').trim();
          const inAuto = String(inEl?.dataset?.auto || '') === '1';
          const outAuto = String(outEl?.dataset?.auto || '') === '1';
          const clearFlag = String(tr.dataset.clear || '') === '1';
          const meaningful = clearFlag || !!v || (!!inV && !inAuto) || (!!outV && !outAuto);
          if (!meaningful) continue;
          tr.dataset.dirty = '1';
          if (v) tr.dataset.kubunConfirmed = '1';
        }
      } catch {}
      try {
        const todayStr = (() => {
          try { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); } catch { return null; }
        })();
        const workNeedTimes = new Set(['出勤', '休日出勤', '代替出勤']);
        const rows = Array.from(ctx.tableHost?.querySelectorAll?.('[data-row="1"][data-date]') || []);
        for (const tr of rows) {
          const dateStr = String(tr.dataset.date || '').slice(0, 10);
          if (todayStr && dateStr > todayStr) continue;
          const idRaw = String(tr.dataset.id || '').trim();
          if (idRaw) continue;
          const sel = tr.querySelector('select[data-field="classification"]');
          const v = String(sel?.value || '').trim();
          if (!workNeedTimes.has(v)) continue;
          const inEl = tr.querySelector('input.se-time[data-field="checkIn"]');
          const outEl = tr.querySelector('input.se-time[data-field="checkOut"]');
          const inV = String(inEl?.value || '').trim();
          const outV = String(outEl?.value || '').trim();
          const inAuto = String(inEl?.dataset?.auto || '') === '1';
          const outAuto = String(outEl?.dataset?.auto || '') === '1';
          const inAutoVal = String(inEl?.dataset?.autoVal || '').trim();
          const outAutoVal = String(outEl?.dataset?.autoVal || '').trim();
          const hasAutoHint = (inAuto && inAutoVal && inV === inAutoVal) || (outAuto && outAutoVal && outV === outAutoVal);
          if (!hasAutoHint) continue;
          if (inEl) {
            inEl.dataset.auto = '';
            inEl.dataset.autoVal = '';
            try { inEl.classList.remove('is-auto'); } catch {}
          }
          if (outEl) {
            outEl.dataset.auto = '';
            outEl.dataset.autoVal = '';
            try { outEl.classList.remove('is-auto'); } catch {}
          }
          try { tr.dataset.dirty = '1'; } catch {}
          try { tr.dataset.kubunConfirmed = v ? '1' : ''; } catch {}
        }
      } catch {}
      if (ctx.tableHost && ctx.tableHost.querySelector('.invalid')) {
        showErr('入力内容を確認してください（赤枠の項目）');
        alert('入力内容を確認してください（赤枠の項目）');
        return;
      }
      const payload = collectUpdates(ctx.tableHost, ym, ctx.actingUserId || null);
      const body = JSON.stringify(payload);
      const savedDates = new Set();
      try {
        for (const d of Array.isArray(payload?.dailyUpdates) ? payload.dailyUpdates : []) {
          const ds = String(d?.date || '').slice(0, 10);
          if (ds) savedDates.add(ds);
        }
        for (const u of Array.isArray(payload?.updates) ? payload.updates : []) {
          const id = u?.id != null ? String(u.id) : '';
          const cid = String(u?.clientId || '').trim();
          const tr = id ? ctx.tableHost.querySelector(`[data-row="1"][data-id="${cssEscape(id)}"]`)
            : cid ? ctx.tableHost.querySelector(`[data-row="1"][data-client-id="${cssEscape(cid)}"]`)
            : null;
          const ds = tr ? String(tr.dataset.date || '').slice(0, 10) : '';
          if (ds) savedDates.add(ds);
        }
      } catch {}
      const r = await fetchJSONAuth('/api/attendance/month/bulk', { method: 'PUT', body });
      if (r && r.ok === false) {
        const msg = String(r?.message || '保存に失敗しました');
        throw new Error(msg);
      }
      try {
        const created = Array.isArray(r?.created) ? r.created : [];
        for (const c of created) {
          const cid = String(c?.clientId || '').trim();
          const id = c?.id;
          if (!cid || !id) continue;
          const tr = ctx.tableHost.querySelector(`[data-row="1"][data-client-id="${cssEscape(cid)}"]`);
          if (tr) tr.dataset.id = String(id);
        }
      } catch {}
      try {
        const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
        const updates0 = Array.isArray(payload?.updates) ? payload.updates : [];
        const created0 = Array.isArray(r?.created) ? r.created : [];
        const createdByCid = new Map(created0.map(c => [String(c?.clientId || '').trim(), c]));
        const getDay = (ds) => days.find(d => String(d?.date || '').slice(0, 10) === String(ds || '').slice(0, 10));
        const ensureSegList = (day) => {
          if (!day) return null;
          if (!Array.isArray(day.segments)) day.segments = [];
          return day.segments;
        };
        const updateRowVisual = (tr) => {
          if (!tr) return;
          const inEl = tr.querySelector('input.se-time[data-field="checkIn"]');
          const outEl = tr.querySelector('input.se-time[data-field="checkOut"]');
          if (inEl) {
            inEl.dataset.auto = '';
            inEl.dataset.autoVal = '';
            inEl.classList.remove('is-auto');
          }
          if (outEl) {
            outEl.dataset.auto = '';
            outEl.dataset.autoVal = '';
            outEl.classList.remove('is-auto');
          }
        };
        for (const u of updates0) {
          const id = u?.id != null ? String(u.id) : '';
          const cid = String(u?.clientId || '').trim();
          const tr = id
            ? ctx.tableHost.querySelector(`[data-row="1"][data-id="${cssEscape(id)}"]`)
            : cid
              ? ctx.tableHost.querySelector(`[data-row="1"][data-client-id="${cssEscape(cid)}"]`)
              : null;
          const ds = tr ? String(tr.dataset.date || '').slice(0, 10) : String(u?.checkIn || u?.checkOut || '').slice(0, 10);
          const day = getDay(ds);
          const segs = ensureSegList(day);
          if (!segs) continue;
          if (id) {
            const seg = segs.find(s => String(s?.id || '') === id);
            if (seg) {
              if (u.checkIn != null) seg.checkIn = u.checkIn;
              if (Object.prototype.hasOwnProperty.call(u, 'checkOut')) seg.checkOut = u.checkOut;
              if (Object.prototype.hasOwnProperty.call(u, 'workType')) seg.workType = u.workType;
            } else {
              segs.push({ id: u.id, checkIn: u.checkIn || null, checkOut: u.checkOut || null, workType: u.workType || null });
            }
            updateRowVisual(tr);
          } else if (cid) {
            const c = createdByCid.get(cid);
            const newId = c?.id != null ? String(c.id) : '';
            if (tr && newId) tr.dataset.id = newId;
            if (newId) {
              const exists = segs.some(s => String(s?.id || '') === newId);
              if (!exists) {
                segs.push({
                  id: c.id,
                  checkIn: c.checkIn || u.checkIn || null,
                  checkOut: c.checkOut || u.checkOut || null,
                  workType: c.workType || u.workType || null
                });
              }
              updateRowVisual(tr);
            }
          }
        }
      } catch {}
      try {
        for (const ds of savedDates) {
          const tr = ctx.tableHost.querySelector(`[data-row="1"][data-date="${cssEscape(ds)}"]`);
          if (tr) {
            markRowSaved(tr);
            try { tr.dataset.clear = ''; } catch {}
            try {
              const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
              const day = days.find(d => String(d?.date || '').slice(0,10) === ds);
              if (day) {
                const sel = tr.querySelector('select[data-field="classification"]');
                const v = String(sel?.value || '').trim();
                day.daily = day.daily || {};
                day.daily.kubun = v || null;
                day.daily.kubunConfirmed = v ? 1 : 0;
                const wt = (tr.querySelector('input[data-field="ckOnsite"]')?.checked ? 'onsite'
                  : tr.querySelector('input[data-field="ckRemote"]')?.checked ? 'remote'
                  : tr.querySelector('input[data-field="ckSatellite"]')?.checked ? 'satellite'
                  : String(tr.dataset.workType || '')).trim() || null;
                day.daily.workType = wt;
                const loc = tr.querySelector('input[data-field="location"]')?.value ?? '';
                const memo = tr.querySelector('input[data-field="memo"]')?.value ?? '';
                const reason = tr.querySelector('select[data-field="reason"]')?.value ?? '';
                day.daily.location = String(loc || '').trim();
                day.daily.memo = String(memo || '').trim();
                day.daily.reason = String(reason || '').trim();
                const br = String(tr.querySelector('select[data-field="break"]')?.value || '1:00');
                const nb = String(tr.querySelector('select[data-field="nightBreak"]')?.value || '0:00');
                day.daily.breakMinutes = br === '0:45' ? 45 : br === '0:30' ? 30 : br === '0:00' ? 0 : 60;
                day.daily.nightBreakMinutes = nb === '1:00' ? 60 : nb === '0:30' ? 30 : 0;
                try {
                  tr.dataset.kubunBase = v || '';
                  tr.dataset.workTypeBase = wt || '';
                  tr.dataset.locationBase = String(loc || '');
                  tr.dataset.memoBase = String(memo || '');
                  tr.dataset.reasonBase = String(reason || '');
                  tr.dataset.breakBase = br;
                  tr.dataset.nightBreakBase = nb;
                } catch {}
              }
            } catch {}
            try { root.Render?.recomputeRow?.(tr); } catch {}
          }
        }
      } catch {}
      try { ctx.lastAutoSavePayload = body; } catch {}
      clearDirty();
      try { draft?.clear?.(ctx, ym); } catch {}
      const s = r?.saved || {};
      const daily = Number(s?.daily || 0);
      const created = Number(s?.segmentsCreated || 0);
      const updated = Number(s?.segmentsUpdated || 0);
      const n = daily + created + updated;
      const intent = (() => {
        try {
          const p = JSON.parse(body || '{}');
          const du = Array.isArray(p?.dailyUpdates) ? p.dailyUpdates : [];
          const up = Array.isArray(p?.updates) ? p.updates : [];
          const dHas = du.some(d => {
            if (!d) return false;
            return (typeof d.kubun === 'string' && d.kubun !== '') ||
                   Object.prototype.hasOwnProperty.call(d, 'kubunConfirmed') ||
                   (typeof d.workType === 'string' && d.workType !== '') ||
                   (d.location && d.location !== '') || (d.memo && d.memo !== '') || (d.reason && d.reason !== '') ||
                   d.breakMinutes != null || d.nightBreakMinutes != null;
          });
          return dHas || up.length > 0;
        } catch { return false; }
      })();
      if (n <= 0 && intent) throw new Error('保存対象がありません。入力内容を確認してください。');
      // Đã gỡ bỏ alert theo yêu cầu người dùng
      if (n > 0 && root.Core?.showToast) {
        root.Core.showToast(`保存しました（daily:${daily}, seg+${created}, seg更新:${updated}）`, 'success');
      }
    } catch (e) {
      showErr(e?.message || '保存に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const saveRowNow = async (tr) => {
    const ym = ctx.picker?.value || ctx.initialYM;
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (!tr) return;
    if (ctx.autoSaveInFlight) return;
    showErr('');
    try {
      ctx.autoSaveInFlight = true;
      const [y, m] = String(ym).split('-').map(x => parseInt(x, 10));
      const dateStr = String(tr.dataset.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      const kubunVal = String(tr.querySelector('select[data-field="classification"]')?.value || '').trim();
      const kubunConfirmed = String(tr.dataset.kubunConfirmed || '') === '1' ? 1 : 0;
      const wt = (tr.querySelector('input[data-field="ckOnsite"]')?.checked ? 'onsite'
        : tr.querySelector('input[data-field="ckRemote"]')?.checked ? 'remote'
        : tr.querySelector('input[data-field="ckSatellite"]')?.checked ? 'satellite'
        : String(tr.dataset.workType || '')).trim();
      const loc = String(tr.querySelector('input[data-field="location"]')?.value || '').trim();
      const reason = String(tr.querySelector('select[data-field="reason"]')?.value || '').trim();
      const memo = String(tr.querySelector('input[data-field="memo"]')?.value || '').trim();
      const br = String(tr.querySelector('select[data-field="break"]')?.value || '1:00');
      const nb = String(tr.querySelector('select[data-field="nightBreak"]')?.value || '0:00');
      const breakMinutes = br === '0:45' ? 45 : br === '0:30' ? 30 : br === '0:00' ? 0 : 60;
      const nightBreakMinutes = nb === '1:00' ? 60 : nb === '0:30' ? 30 : 0;
      const payload = {
        year: y, month: m, userId: ctx.actingUserId || undefined,
        updates: [],
        dailyUpdates: [{
          date: dateStr,
          kubun: kubunVal,
          kubunConfirmed,
          workType: (wt === 'onsite' || wt === 'remote' || wt === 'satellite') ? wt : null,
          location: loc,
          reason,
          memo,
          breakMinutes,
          nightBreakMinutes
        }]
      };
      const r = await fetchJSONAuth('/api/attendance/month/bulk', { method: 'PUT', body: JSON.stringify(payload) });
      if (r && r.ok === false) {
        const msg = String(r?.message || '保存に失敗しました');
        throw new Error(msg);
      }
      markRowSaved(tr);
      try {
        const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
        const day = days.find(d => String(d?.date || '').slice(0,10) === dateStr);
        if (day) {
          day.daily = day.daily || {};
          day.daily.kubun = kubunVal || null;
          day.daily.kubunConfirmed = kubunVal ? 1 : 0;
          day.daily.workType = (wt === 'onsite' || wt === 'remote' || wt === 'satellite') ? wt : null;
          day.daily.location = loc;
          day.daily.reason = reason;
          day.daily.memo = memo;
          day.daily.breakMinutes = breakMinutes;
          day.daily.nightBreakMinutes = nightBreakMinutes;
        }
        try {
          tr.dataset.kubunBase = kubunVal || '';
          tr.dataset.workTypeBase = (wt === 'onsite' || wt === 'remote' || wt === 'satellite') ? wt : '';
          tr.dataset.locationBase = loc || '';
          tr.dataset.reasonBase = reason || '';
          tr.dataset.memoBase = memo || '';
          tr.dataset.breakBase = (br === '0:45' || br === '0:30' || br === '0:00') ? br : '1:00';
          tr.dataset.nightBreakBase = (nb === '1:00' || nb === '0:30') ? nb : '0:00';
        } catch {}
      } catch {}
      try { root.Render?.recomputeRow?.(tr); } catch {}
    } catch (e) {
      showErr(e?.message || '保存に失敗しました');
    } finally {
      ctx.autoSaveInFlight = false;
    }
  };

  const saveRowTimesNow = async (tr) => {
    const ym = ctx.picker?.value || ctx.initialYM;
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (!tr) return;
    
    // Thay vì return ngay, chúng ta đợi một chút nếu đang có save khác (Ưu tiên 1 - Chống Race Condition)
    if (ctx.autoSaveInFlight) {
      setTimeout(() => saveRowTimesNow(tr), 200);
      return;
    }
    
    showErr('');
    try {
      ctx.autoSaveInFlight = true;
      const core = root.Core || {};
      const toDateTime = core.toDateTime;
      const addDaysISO = core.addDaysISO;
      const parseHm = core.parseHm;
      const [y, m] = String(ym).split('-').map(x => parseInt(x, 10));
      const dateStr = String(tr.dataset.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      const inEl = tr.querySelector('input.se-time[data-field="checkIn"]');
      const outEl = tr.querySelector('input.se-time[data-field="checkOut"]');
      
      // Đảm bảo lấy giá trị mới nhất từ DOM ngay lúc này
      const rawIn = String(inEl?.value || '').trim();
      const rawOut = String(outEl?.value || '').trim();
      
      const inDt = rawIn && toDateTime ? toDateTime(dateStr, rawIn) : null;
      let outDt = rawOut && toDateTime ? toDateTime(dateStr, rawOut) : null;
      
      if (outDt && parseHm) {
        const a = parseHm(rawIn);
        const b = parseHm(rawOut);
        if (a != null && b != null && b < a && addDaysISO && toDateTime) {
          outDt = toDateTime(addDaysISO(dateStr, 1), rawOut);
        }
      }
      const wt = (tr.querySelector('input[data-field="ckOnsite"]')?.checked ? 'onsite'
        : tr.querySelector('input[data-field="ckRemote"]')?.checked ? 'remote'
        : tr.querySelector('input[data-field="ckSatellite"]')?.checked ? 'satellite'
        : String(tr.dataset.workType || '')).trim();
      const reason = String(tr.querySelector('select[data-field="reason"]')?.value || '').trim();
      const notes = String(tr.querySelector('input[data-field="notes"]')?.value || '').trim();
      
      const idRaw = String(tr.dataset.id || '').trim();
      let clientId = String(tr.dataset.clientId || '').trim();
      if (!idRaw && !clientId) {
        clientId = (core.makeClientId ? core.makeClientId() : String(Date.now()));
        tr.dataset.clientId = clientId;
      }
      
      const updates = [];
      if (idRaw) {
        // Nếu đã có ID, chúng ta gửi update. CheckInFinal phải lấy từ DOM hoặc giữ nguyên cái cũ.
        const checkInFinal = inDt || null; 
        updates.push({ id: parseInt(idRaw, 10), checkIn: checkInFinal, checkOut: outDt, workType: wt || null });
      } else if (inDt) {
        updates.push({ clientId, checkIn: inDt, checkOut: outDt, workType: wt || null });
      }
      
      if (!updates.length) return;
      
      const sel = tr.querySelector('select[data-field="classification"]');
      const v = String(sel?.value || '').trim();
      const payload = { 
        year: y, 
        month: m, 
        userId: ctx.actingUserId || undefined, 
        updates, 
        dailyUpdates: [
          { 
            date: dateStr, 
            kubun: v || null,
            kubunConfirmed: v ? 1 : 0,
            reason: reason || null, 
            notes: notes || null 
          }
        ] 
      };
      const r = await fetchJSONAuth('/api/attendance/month/bulk', { method: 'PUT', body: JSON.stringify(payload) });
      
      console.log('API Response:', r);

      if (!r || r.message === 'Unauthorized') {
         throw new Error('セッションが切れました。再ログインしてください。');
      }

      if (r.error || (r.status && r.status >= 400)) {
         throw new Error(String(r.message || r.error || '保存に失敗しました'));
      }

      // Thông báo thành công (Ưu tiên 2)
      if (root.Core?.showToast) {
        root.Core.showToast('保存しました', 'success');
      }
      // ĐÃ XÓA alert('保存しました') gây phiền nhiễu theo yêu cầu người dùng

      // Cập nhật ID nếu là bản ghi mới
      const created = Array.isArray(r?.created) ? r.created : (Array.isArray(r?.createdIds) ? r.createdIds : []);
      for (const c of created) {
        const cid = String(c?.clientId || '').trim();
        if (cid && cid === clientId && c.id) {
          tr.dataset.id = String(c.id);
          // Quan trọng: xóa clientId sau khi đã có id thật
          tr.dataset.clientId = '';
        }
      }

      // Cập nhật LOCAL STATE để đồng bộ hoàn toàn (Chặn rủi ro Blind Spot)
      try {
        const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
        const day = days.find(d => String(d?.date || '').slice(0, 10) === dateStr);
        if (day) {
          day.segments = Array.isArray(day.segments) ? day.segments : [];
          for (const u of updates) {
            const id = u.id ? String(u.id) : null;
            if (id) {
              const seg = day.segments.find(s => String(s?.id || '') === id);
              if (seg) {
                seg.checkIn = u.checkIn;
                seg.checkOut = u.checkOut;
                seg.workType = u.workType;
              }
            } else {
              // Thêm segment mới vào state
              const c = created.find(x => x.clientId === clientId);
              if (c) day.segments.push({ id: c.id, checkIn: c.checkIn, checkOut: c.checkOut, workType: wt });
            }
          }
        }
      } catch (err) {
        console.warn('Local state sync failed:', err);
      }

      markRowSaved(tr);
      if (root.Render?.recomputeRow) root.Render.recomputeRow(tr);
      
    } catch (e) {
      console.error('Save failed:', e);
      showErr(e?.message || '保存に失敗しました');
    } finally {
      ctx.autoSaveInFlight = false;
    }
  };

  const ensureTimesForWorkKubun = async (tr, kubunVal) => {
    try {
      if (!state.editableMonth) return;
      if (!tr) return;
      const dateStr = String(tr.dataset.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      const k = String(kubunVal || '').trim();
      const workNeedTimes = new Set(['出勤', '休日出勤', '代替出勤']);
      if (!workNeedTimes.has(k)) return;
      const todayStr = (() => {
        try { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); } catch { return null; }
      })();
      if (todayStr && dateStr > todayStr) return;
      const inEl = tr.querySelector('input.se-time[data-field="checkIn"]');
      const outEl = tr.querySelector('input.se-time[data-field="checkOut"]');
      const inNow = String(inEl?.value || '').trim();
      const outNow = String(outEl?.value || '').trim();
      const effTime = (el) => {
        const v = String(el?.value || '').trim();
        const isAuto = String(el?.dataset?.auto || '') === '1';
        const autoVal = String(el?.dataset?.autoVal || '').trim();
        if (isAuto && autoVal && v === autoVal) return '';
        return v;
      };
      const inEff = effTime(inEl);
      const outEff = effTime(outEl);
      if (inEff || outEff) return;

      const dayShift = (() => {
        try {
          const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
          return days.find(d => String(d?.date || '').slice(0, 10) === dateStr)?.shift || null;
        } catch {
          return null;
        }
      })();
      const shiftStart = String(dayShift?.start_time || '').trim();
      const shiftEnd = String(dayShift?.end_time || '').trim();
      let inCand = /^\d{2}:\d{2}$/.test(inNow) ? inNow : shiftStart;
      let outCand = /^\d{2}:\d{2}$/.test(outNow) ? outNow : shiftEnd;
      if (!/^\d{2}:\d{2}$/.test(inCand)) inCand = '08:00';
      if (!/^\d{2}:\d{2}$/.test(outCand)) outCand = '17:00';

      if (inEl) {
        inEl.value = inCand;
        inEl.dataset.auto = '';
        inEl.dataset.autoVal = '';
        try { inEl.classList.remove('is-auto'); } catch {}
      }
      if (outEl) {
        outEl.value = outCand;
        outEl.dataset.auto = '';
        outEl.dataset.autoVal = '';
        try { outEl.classList.remove('is-auto'); } catch {}
      }
      try { tr.dataset.dirty = '1'; } catch {}
      await saveRowTimesNow(tr);
    } catch {}
  };

  const exportXlsx = async () => {
    clearDirty();
    const ym = ctx.picker?.value || ctx.initialYM;
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const [y, m] = ym.split('-').map(x => parseInt(x, 10));
    if (!y || !m) return;
    showErr('');
    showSpinner();
    const uidQ = ctx.actingUserId ? `&userId=${encodeURIComponent(ctx.actingUserId)}` : '';
    const bust = `&_=${Date.now()}`;
    const url = `/api/attendance/month/export.xlsx?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}${bust}`;
    const fileName = `attendance_month_${ym}.xlsx`;
    try {
      await downloadWithAuth(url, fileName);
    } catch (err) {
      showErr(err?.message || '出力に失敗しました');
      alert(String(err?.message || '出力に失敗しました'));
    } finally {
      hideSpinner();
    }
  };

  const submitMonth = async () => {
    const ym = ctx.picker?.value || '';
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (!confirm('この月を提出します。よろしいですか？')) return;
    showErr('');
    showSpinner();
    try {
      const y = parseInt(ym.slice(0, 4), 10);
      const m = parseInt(ym.slice(5, 7), 10);
      await fetchJSONAuth('/api/attendance/month/submit', { method: 'POST', body: JSON.stringify({ year: y, month: m, userId: ctx.actingUserId || undefined }) });
      await setMonth(ym, true);
    } catch (err) {
      showErr(err?.message || '提出に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const approveMonth = async () => {
    const ym = ctx.picker?.value || '';
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (!ctx.actingUserId) return;
    if (!confirm('この月を承認して締め処理します。よろしいですか？')) return;
    showErr('');
    showSpinner();
    try {
      const y = parseInt(ym.slice(0, 4), 10);
      const m = parseInt(ym.slice(5, 7), 10);
      await fetchJSONAuth('/api/attendance/month/approve', { method: 'POST', body: JSON.stringify({ year: y, month: m, userId: ctx.actingUserId }) });
      await setMonth(ym, true);
    } catch (err) {
      showErr(err?.message || '承認に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const unlockMonth = async () => {
    const ym = ctx.picker?.value || '';
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (!ctx.actingUserId) return;
    if (!confirm('締め状態を解除して編集可能に戻します。よろしいですか？')) return;
    showErr('');
    showSpinner();
    try {
      const y = parseInt(ym.slice(0, 4), 10);
      const m = parseInt(ym.slice(5, 7), 10);
      await fetchJSONAuth('/api/attendance/month/unlock', { method: 'POST', body: JSON.stringify({ year: y, month: m, userId: ctx.actingUserId }) });
      await setMonth(ym, true);
    } catch (err) {
      showErr(err?.message || '解除に失敗しました');
    } finally {
      hideSpinner();
    }
  };

  const initUserPicker = async () => {
    if (ctx.role !== 'admin' && ctx.role !== 'manager') return;
    try {
      const head = document.querySelector('.se-page-head');
      if (!head) return;
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '8px';
      wrap.style.flexWrap = 'wrap';
      wrap.style.justifyContent = 'flex-end';

      const lbl = document.createElement('div');
      lbl.textContent = '対象社員';
      lbl.style.fontWeight = '900';
      lbl.style.color = '#0b2c66';
      lbl.style.fontSize = '12px';

      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = '社員番号 / 氏名';
      input.autocomplete = 'off';
      input.style.height = '32px';
      input.style.border = '1px solid #cbd5e1';
      input.style.borderRadius = '8px';
      input.style.padding = '0 10px';
      input.style.minWidth = '180px';

      const sel = document.createElement('select');
      sel.style.height = '32px';
      sel.style.border = '1px solid #cbd5e1';
      sel.style.borderRadius = '8px';
      sel.style.padding = '0 10px';
      sel.style.minWidth = '240px';
      sel.style.fontWeight = '800';
      sel.style.color = '#0b2c66';

      wrap.appendChild(lbl);
      wrap.appendChild(input);
      wrap.appendChild(sel);
      head.appendChild(wrap);

      const fetchUsers = async () => {
        if (ctx.role === 'admin') return fetchJSONAuth('/api/admin/users');
        return fetchJSONAuth('/api/manager/users');
      };

      const allUsers = await fetchUsers().catch(() => []);
      const usersAll = Array.isArray(allUsers) ? allUsers : (allUsers?.rows || []);
      const meId = String(ctx.profile?.id || '');

      const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const codeOf = (u) => String(u.employee_code || u.employeeCode || (u.id ? ('EMP' + String(u.id).padStart(3, '0')) : '')).trim();
      const nameOf = (u) => String(u.username || u.email || '').trim();
      const roleOf = (u) => String(u.role || '').toLowerCase();
      const statusOf = (u) => String(u.employment_status || u.employmentStatus || 'active').toLowerCase();
      const users = usersAll
        .filter(u => String(u?.id || '') && String(u.id) !== meId && roleOf(u) !== 'admin' && roleOf(u) !== 'manager')
        .filter(u => statusOf(u) !== 'inactive' && statusOf(u) !== 'retired')
        .sort((a, b) => {
          const ac = codeOf(a);
          const bc = codeOf(b);
          const c = ac.localeCompare(bc);
          if (c) return c;
          const an = nameOf(a);
          const bn = nameOf(b);
          return an.localeCompare(bn);
        });

      const rebuild = () => {
        const q = normalize(input.value);
        const list = users.filter(u => {
          if (!q) return true;
          const hay = normalize([codeOf(u), nameOf(u), u.email || '', u.id || ''].join(' '));
          return hay.includes(q);
        }).slice(0, 2000);
        sel.innerHTML = '';
        const optPick = document.createElement('option');
        optPick.value = '';
        optPick.textContent = '（社員を選択）';
        sel.appendChild(optPick);
        for (const u of list) {
          const opt = document.createElement('option');
          opt.value = String(u.id || '');
          opt.textContent = `${codeOf(u)} ${nameOf(u)}`.trim();
          sel.appendChild(opt);
        }
        const cur = ctx.actingUserId || '';
        sel.value = cur || '';
      };

      rebuild();
      if (!ctx.actingUserId && users.length) {
        ctx.actingUserId = String(users[0].id || '').trim();
        try { state.currentViewingUserId = ctx.actingUserId || String(ctx.profile?.id || ''); } catch {}
        try {
          const url = new URL(window.location.href);
          if (ctx.actingUserId) url.searchParams.set('userId', ctx.actingUserId);
          else url.searchParams.delete('userId');
          history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch {}
        try { sel.value = ctx.actingUserId; } catch {}
      }

      ctx.userPicker = { input, select: sel, rebuild };
    } catch {}
  };

  const initContractTabs = () => {
    const sec = $('#contractSection');
    if (!sec) return;
    const tabs = Array.from(sec.querySelectorAll('.se-tab[data-tab]'));
    ctx.applyContractTab = () => {
      const active = tabs.find(t => t.classList.contains('active')) || tabs[0] || null;
      const key = String(active?.dataset?.tab || '');
      for (const t of tabs) t.classList.toggle('active', String(t.dataset.tab || '') === String(key || ''));
      if (ctx.contractHost) ctx.contractHost.toggleAttribute('hidden', String(key) === 'workDetail');
      if (ctx.workDetailHost) ctx.workDetailHost.toggleAttribute('hidden', String(key) !== 'workDetail');
    };
    try { ctx.applyContractTab(); } catch {}
  };

  const initSummaryTabs = () => {
    const sec = $('#summarySection');
    if (!sec) return;
    const tabs = Array.from(sec.querySelectorAll('.se-tab[data-tab]'));
    ctx.applySummaryTab = () => {
      const active = tabs.find(t => t.classList.contains('active')) || tabs[0] || null;
      const key = String(active?.dataset?.tab || '');
      for (const t of tabs) t.classList.toggle('active', String(t.dataset.tab || '') === String(key || ''));
      renderSummary(ctx.summaryHost, state.currentMonthDetail, state.currentMonthTimesheet);
    };
    try { ctx.applySummaryTab(); } catch {}
  };

  const initSummaryEditor = () => {
    const sec = $('#summarySection');
    if (!sec || sec.dataset.summaryEditorReady === '1') return;
    sec.dataset.summaryEditorReady = '1';
    if (ctx.role !== 'admin' && ctx.role !== 'manager') return;
    const head = sec.querySelector('.se-section-head');
    const body = sec.querySelector('.se-section-body');
    if (!head || !body) return;
  };

  const wireAutoRefreshSide = () => {
    const sec = $('#summarySection');
    if (!sec || sec.dataset.sideAutoRefreshWired === '1') return;
    sec.dataset.sideAutoRefreshWired = '1';
    let lastKey = '';
    const buildKey = (d) => {
      try {
        const a = Array.isArray(d?.shiftAssignments) ? d.shiftAssignments : [];
        const w = Array.isArray(d?.workDetails) ? d.workDetails : [];
        const s = d?.monthSummary || null;
        return JSON.stringify({ a, w, s });
      } catch {
        return '';
      }
    };
    const refresh = async () => {
      if (document.hidden) return;
      const ym = String(ctx.picker?.value || '').trim();
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      if (!state.currentMonthDetail) return;
      const [y, m] = ym.split('-').map(x => parseInt(x, 10));
      if (!y || !m) return;
      const uid = ctx.actingUserId || null;
      const uidQ = uid ? `&userId=${encodeURIComponent(String(uid))}` : '';
      const bust = `&_=${Date.now()}`;
      const next = await fetchJSONAuth(`/api/attendance/month/detail?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}${bust}`).catch(() => null);
      if (!next) return;
      const key = buildKey(next);
      if (!key || key === lastKey) return;
      lastKey = key;
      try {
        state.currentMonthDetail.shiftAssignments = next.shiftAssignments;
        state.currentMonthDetail.workDetails = next.workDetails;
        state.currentMonthDetail.monthSummary = next.monthSummary;
      } catch {}
      try { renderContract(ctx.contractHost, state.currentMonthDetail); } catch {}
      try { renderWorkDetail(ctx.workDetailHost, state.currentMonthDetail, ctx.profile); } catch {}
      try { renderSummary(ctx.summaryHost, state.currentMonthDetail, state.currentMonthTimesheet); } catch {}
    };
    setInterval(() => { refresh().catch(() => {}); }, 5000);
    try { lastKey = buildKey(state.currentMonthDetail); } catch {}
  };

  const init = async () => {
    state.editableMonth = state.editableMonth == null ? true : state.editableMonth;
    state.currentMonthStatus = state.currentMonthStatus || 'draft';
    state.currentViewingUserId = state.currentViewingUserId || '';
    state.currentYM = state.currentYM || monthJST();

    showErr('');
    showSpinner();
    const profile = await ensureAuthProfile();
    if (!profile) {
      try { window.location.replace('/ui/login'); } catch { window.location.href = '/ui/login'; }
      return false;
    }
    ctx.profile = profile;
    state.profile = profile;
    ctx.role = String(profile.role || '').toLowerCase();
    try {
      const u = new URL(window.location.href);
      const embed = String(u.searchParams.get('embed') || '').toLowerCase();
      if (embed === '1' || embed === 'true') {
        const top = document.querySelector('.kintai-top');
        if (top) top.style.display = 'none';
      }
    } catch {}
    try { $('#userName').textContent = profile.username || profile.email || 'ユーザー'; } catch {}
    try {
      const code = profile.employee_code || profile.employeeCode || (profile.id ? ('EMP' + String(profile.id).padStart(3, '0')) : '');
      $('#empCode').textContent = (ctx.role === 'employee') ? (code || '—') : '—';
    } catch {}
    try { $('#staffName').textContent = (ctx.role === 'employee') ? (profile.username || profile.email || '—') : '—'; } catch {}
    try {
      const officeCode = profile.office_code || profile.officeCode || '00084';
      $('#officeCode').textContent = (ctx.role === 'employee') ? (String(officeCode || '').trim() || '—') : '—';
    } catch {}
    try { $('#officeName').textContent = '飯塚塗研'; } catch {}
    try { $('#empDept').textContent = (ctx.role === 'employee') ? (profile.departmentName || profile.department || '—') : '—'; } catch {}

    ctx.actingUserId = '';
    try {
      const u = new URL(window.location.href);
      const v = String(u.searchParams.get('userId') || '').trim();
      if (/^\d+$/.test(v) && ctx.role !== 'employee') ctx.actingUserId = v;
    } catch {}
    try {
      const meId = String(profile.id || '');
      if (ctx.actingUserId && meId && ctx.actingUserId === meId) ctx.actingUserId = '';
    } catch {}
    try { state.currentViewingUserId = ctx.actingUserId ? String(ctx.actingUserId) : String(profile.id || ''); } catch {}

    ctx.picker1 = $('#monthPicker');
    ctx.picker2 = $('#monthPicker2');
    ctx.picker = ctx.picker2 || ctx.picker1;
    ctx.summaryHost = $('#monthSummaryTable') || $('#monthSummary');
    ctx.tableHost = $('#monthTable');
    ctx.contractHost = $('#contractTable');
    ctx.workDetailHost = $('#workDetailTable');

    ensureWorkflowUI();
    ctx.pinMonthHeadMode = 'bottom';
    applyPinMonthHead();
    syncFooterVars();
    syncStickyTop();
    syncTheadRowHeights();
    wireMonthHScrollVisibility();
    wireFooterResize();

    applyDailyCollapsed(getDailyCollapsed());
    applyContractCollapsed(getContractCollapsed());
    applySummaryCollapsed(getSummaryCollapsed());
    applyAnnualCollapsed(getAnnualCollapsed());

    initContractTabs();
    initSummaryTabs();
    initSummaryEditor();
    wireAutoRefreshSide();
    await initUserPicker();

    ctx.initialYM = (() => {
      try {
        const u = new URL(window.location.href);
        const m = String(u.searchParams.get('month') || '').slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) return m;
      } catch {}
      return monthJST();
    })();
    if (ctx.picker1) ctx.picker1.value = ctx.initialYM;
    if (ctx.picker2) ctx.picker2.value = ctx.initialYM;
    buildTargetDateSelect(ctx.initialYM);

    return true;
  };

  const tableHistory = (dateStr) => {
    const days = Array.isArray(state.currentMonthDetail?.days) ? state.currentMonthDetail.days : [];
    const day = days.find(d => String(d?.date || '') === dateStr);
    const segs = Array.isArray(day?.segments) ? day.segments : [];
    const lines = segs.map(s => {
      const inHm = fromDateTime(s?.checkIn);
      const outHm = fromDateTime(s?.checkOut);
      const wt = workTypeLabel(s?.workType);
      return `#${s?.id || 'new'} ${inHm || '--:--'}-${outHm || '--:--'} ${wt || ''}`.trim();
    });
    alert(lines.length ? lines.join('\n') : '履歴がありません');
  };

  const clearRow = (tr) => {
    try { tr.dataset.dirty = '1'; } catch {}
    try { tr.dataset.clear = '1'; } catch {}
    const ckOn = tr.querySelector('input[data-field="ckOnsite"]');
    const ckRe = tr.querySelector('input[data-field="ckRemote"]');
    const ckSa = tr.querySelector('input[data-field="ckSatellite"]');
    if (ckOn) ckOn.checked = false;
    if (ckRe) ckRe.checked = false;
    if (ckSa) ckSa.checked = false;
    tr.dataset.workType = '';
    const inEl = tr.querySelector('input[data-field="checkIn"]');
    const outEl = tr.querySelector('input[data-field="checkOut"]');
    if (inEl) inEl.value = '';
    if (outEl) outEl.value = '';
    const bSel = tr.querySelector('select[data-field="break"]');
    if (bSel) bSel.value = '1:00';
    const nbSel = tr.querySelector('select[data-field="nightBreak"]');
    if (nbSel) nbSel.value = '0:00';
    const rSel = tr.querySelector('select[data-field="reason"]');
    if (rSel) rSel.value = '';
    const ihSel = tr.querySelector('select[data-field="inhouse"]');
    if (ihSel) ihSel.value = '';
    const memo = tr.querySelector('input[data-field="memo"]');
    if (memo) memo.value = '';
    try { root.Render?.recomputeRow?.(tr); } catch {}
  };

  const checkImportFile = () => {
    const fileEl = document.querySelector('#importFile');
    const file = fileEl && 'files' in fileEl ? fileEl.files?.[0] : null;
    if (!file) { showErr('取込対象がありません。'); return false; }
    const name = String(file.name || '');
    const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
    if (ext !== 'xlsx') { showErr('選択されたファイルが正しくありません。'); return false; }
    if (file.size <= 0) { showErr('取込対象がありません。'); return false; }
    if (file.size > 10 * 1024 * 1024) { showErr('入力用Excelのファイルサイズが10MBを超過しているため取り込めません。'); return false; }
    return true;
  };

  const setActingUserId = async (nextUserId) => {
    ctx.actingUserId = String(nextUserId || '').trim();
    try { state.currentViewingUserId = ctx.actingUserId || String(ctx.profile?.id || ''); } catch {}
    try {
      const url = new URL(window.location.href);
      if (ctx.actingUserId) url.searchParams.set('userId', ctx.actingUserId);
      else url.searchParams.delete('userId');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {}
    const ym = ctx.picker?.value || monthJST();
    if (!ctx.actingUserId) return;
    await setMonth(ym, true);
  };

  const nextMonth = async (delta) => {
    const cur = ctx.picker?.value || ctx.initialYM;
    await setMonth(addMonths(cur, delta));
  };

  const reloadMonth = async () => {
    const cur = ctx.picker?.value || ctx.initialYM;
    await setMonth(cur, true);
  };

  const Controller = {
    ctx,
    init,
    setMonth,
    nextMonth,
    reloadMonth,
    scheduleAutoSave,
    saveManual,
    saveRowNow,
    saveRowTimesNow,
    ensureTimesForWorkKubun,
    exportXlsx,
    submitMonth,
    approveMonth,
    unlockMonth,
    applyDailyCollapsed,
    setDailyCollapsed,
    getDailyCollapsed,
    applyContractCollapsed,
    setContractCollapsed,
    getContractCollapsed,
    applySummaryCollapsed,
    setSummaryCollapsed,
    getSummaryCollapsed,
    applyAnnualCollapsed,
    setAnnualCollapsed,
    getAnnualCollapsed,
    buildTargetDateSelect,
    syncFooterVars,
    syncStickyTop,
    syncTheadRowHeights,
    syncMonthHScroll,
    wireMonthHScrollVisibility,
    wireFooterResize,
    updateMonthWorkflowUI,
    applyPinMonthHead,
    applyEditability,
    refreshAddButtons,
    tableHistory,
    clearRow,
    checkImportFile,
    setActingUserId
  };

  root.Controller = Controller;
  globalThis.AttendanceMonthly = root;
})();
