import { me, refresh } from '../api/auth.api.js';
import { fetchJSONAuth } from '../api/http.api.js';

const $ = (sel) => document.querySelector(sel);

let spinnerDelayTimer = null;
let simpleUserId = '';
const showSpinner = (v) => {
  const el = $('#pageSpinner');
  if (!el) return;
  if (spinnerDelayTimer) {
    clearTimeout(spinnerDelayTimer);
    spinnerDelayTimer = null;
  }
  if (v) {
    // Avoid flashing a full-page spinner for fast operations.
    spinnerDelayTimer = setTimeout(() => {
      try { el.removeAttribute('hidden'); } catch {}
      spinnerDelayTimer = null;
    }, 180);
  } else {
    el.setAttribute('hidden', '');
  }
};

const showErr = (msg) => {
  const el = $('#error');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
};

let toastTimer = null;
const showToast = (msg, kind = 'success') => {
  const el = $('#toast');
  if (!el) return;
  try {
    el.classList.remove('success', 'error');
    el.classList.add(kind === 'error' ? 'error' : 'success');
  } catch {}
  el.textContent = String(msg || '');
  el.removeAttribute('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    try { el.setAttribute('hidden', ''); } catch {}
  }, 2000);
};

const setupSimpleCombo = (sel) => {
  if (!sel) return;
  if (sel.dataset.comboInit === '1') return;
  const wrap = document.createElement('div');
  wrap.className = 'simple-combo';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'simple-combo-btn';
  const text = document.createElement('span');
  text.className = 'simple-combo-text';
  const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  caret.setAttribute('class', 'simple-combo-caret');
  caret.setAttribute('viewBox', '0 0 24 24');
  caret.setAttribute('aria-hidden', 'true');
  const caretPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  caretPath.setAttribute('d', 'M6 9h12l-6 6z');
  caretPath.setAttribute('fill', '#1d4ed8');
  caret.appendChild(caretPath);
  btn.appendChild(text);
  btn.appendChild(caret);
  const list = document.createElement('div');
  list.className = 'simple-combo-list';
  list.setAttribute('hidden', '');
  wrap.appendChild(btn);
  wrap.appendChild(list);
  sel.style.display = 'none';
  sel.parentNode.insertBefore(wrap, sel.nextSibling);
  const renderList = () => {
    list.innerHTML = '';
    const opts = Array.from(sel.querySelectorAll('option'));
    for (const o of opts) {
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'simple-combo-item';
      it.textContent = o.textContent || '';
      it.dataset.value = o.value || '';
      if (o.disabled) it.disabled = true;
      list.appendChild(it);
    }
  };
  const open = (v) => {
    if (v) {
      list.removeAttribute('hidden');
      wrap.classList.add('open');
    } else {
      list.setAttribute('hidden', '');
      wrap.classList.remove('open');
    }
  };
  btn.addEventListener('click', () => {
    open(list.hasAttribute('hidden'));
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) open(false);
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.simple-combo-item');
    if (!b || b.disabled) return;
    sel.value = b.dataset.value || '';
    text.textContent = b.textContent || '';
    wrap.classList.toggle('is-planned', sel.classList.contains('is-planned'));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    open(false);
  });
  const sync = () => {
    renderList();
    const opt = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0] : sel.querySelector('option:not([disabled])');
    text.textContent = opt ? (opt.textContent || '') : '';
    wrap.classList.toggle('is-planned', sel.classList.contains('is-planned'));
  };
  sync();
  sel.dataset.comboInit = '1';
  sel.addEventListener('change', sync);
};

const reportDraftKey = (date) => `attendanceSimple.workReport.${date}`;
const saveDraft = (date, site, work) => {
  try { localStorage.setItem(reportDraftKey(date), JSON.stringify({ site: site || '', work: work || '' })); } catch {}
};
const loadDraft = (date) => {
  try {
    const s = localStorage.getItem(reportDraftKey(date)) || '';
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};
const clearDraft = (date) => {
  try { localStorage.removeItem(reportDraftKey(date)); } catch {}
};

const simpleFastCacheKey = (uid, date) => `attendanceSimple.fast.${uid}.${date}`;
const simpleFastCachePersistKey = (uid, date) => `attendanceSimple.fast.persist.${uid}.${date}`;
const saveFastSnapshot = (date) => {
  try {
    if (!simpleUserId || !isISODate(date)) return;
    const st = window.state || {};
    const snap = {
      date,
      uid: String(simpleUserId),
      savedAt: Date.now(),
      isOff: !!st.isOff,
      currentMonthStatus: String(st.currentMonthStatus || ''),
      shiftStart: String(st.shiftStart || FIXED_START),
      shiftEnd: String(st.shiftEnd || FIXED_END),
      hasStartedToday: !!st.hasStartedToday,
      hasEndedToday: !!st.hasEndedToday,
      kubun: String($('#kubun')?.value || ''),
      kubunPlanned: !!$('#kubun')?.classList?.contains('is-planned'),
      workType: String($('#workType')?.value || ''),
      startTime: String($('#startTime')?.value || ''),
      endTime: String($('#endTime')?.value || ''),
      startAuto: String($('#startTime')?.dataset?.auto || '') === '1',
      endAuto: String($('#endTime')?.dataset?.auto || '') === '1',
      breakMin: String($('#breakMin')?.value || '1:00'),
      nightBreakMin: String($('#nightBreakMin')?.value || '0:00'),
      workSite: String($('#workSite')?.value || ''),
      workContent: String($('#workContent')?.value || '')
    };
    const raw = JSON.stringify(snap);
    sessionStorage.setItem(simpleFastCacheKey(simpleUserId, date), raw);
    // Persist a short-lived fallback across re-login/new tab to improve first paint.
    localStorage.setItem(simpleFastCachePersistKey(simpleUserId, date), raw);
  } catch {}
};

const restoreFastSnapshot = (date, stateRef) => {
  try {
    if (!simpleUserId || !isISODate(date)) return false;
    const sessionKey = simpleFastCacheKey(simpleUserId, date);
    const persistKey = simpleFastCachePersistKey(simpleUserId, date);
    let raw = sessionStorage.getItem(sessionKey) || '';
    if (!raw) raw = localStorage.getItem(persistKey) || '';
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap || String(snap.uid || '') !== String(simpleUserId) || String(snap.date || '') !== date) return false;
    const ageMs = Date.now() - Number(snap.savedAt || 0);
    if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) return false;
    try { sessionStorage.setItem(sessionKey, raw); } catch {}

    stateRef.isOff = !!snap.isOff;
    stateRef.currentMonthStatus = String(snap.currentMonthStatus || '');
    stateRef.shiftStart = String(snap.shiftStart || FIXED_START);
    stateRef.shiftEnd = String(snap.shiftEnd || FIXED_END);
    stateRef.hasStartedToday = !!snap.hasStartedToday;
    stateRef.hasEndedToday = !!snap.hasEndedToday;
    try { $('#topDate').textContent = fmtJP(date); } catch {}

    const kubunOptions = stateRef.isOff
      ? ['休日', '休日出勤', '代替出勤']
      : ['出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日'];
    const kubunGroupLabel = stateRef.isOff ? '【予定休日】' : '【予定出勤】';
    const selK = $('#kubun');
    if (selK) {
      selK.innerHTML = `<option value="" disabled>${kubunGroupLabel}</option>${kubunOptions.map(k => `<option value="${k}">${k}</option>`).join('')}`;
      selK.value = kubunOptions.includes(String(snap.kubun || '')) ? String(snap.kubun || '') : (stateRef.isOff ? '休日' : '出勤');
      selK.classList.toggle('is-planned', !!snap.kubunPlanned);
      setupSimpleCombo(selK);
    }

    const st = $('#startTime');
    const et = $('#endTime');
    if (st) {
      st.value = String(snap.startTime || '');
      if (snap.startAuto) applyAutoTime(st, String(snap.startTime || stateRef.shiftStart || FIXED_START));
      else clearAutoTime(st);
    }
    if (et) {
      et.value = String(snap.endTime || '');
      if (snap.endAuto) applyAutoTime(et, String(snap.endTime || stateRef.shiftEnd || FIXED_END));
      else clearAutoTime(et);
    }
    if ($('#workType')) $('#workType').value = String(snap.workType || '');
    if ($('#breakMin')) $('#breakMin').value = String(snap.breakMin || '1:00');
    if ($('#nightBreakMin')) $('#nightBreakMin').value = String(snap.nightBreakMin || '0:00');
    if ($('#workSite')) $('#workSite').value = String(snap.workSite || '');
    if ($('#workContent')) $('#workContent').value = String(snap.workContent || '');

    const shiftInfoBox = $('#shiftInfo');
    if (shiftInfoBox) {
      shiftInfoBox.innerHTML = `<span class="shift-tag">${stateRef.isOff ? '休日' : 'デフォルトシフト'}: ${stateRef.shiftStart} - ${stateRef.shiftEnd}</span>`;
      shiftInfoBox.removeAttribute('hidden');
    }

    renderWorkMinutes();
    renderStampButtons({
      date,
      inHm: snap.hasStartedToday ? String(snap.startTime || '') : '',
      outHm: snap.hasEndedToday ? String(snap.endTime || '') : '',
      hasOpen: !!snap.hasStartedToday && !snap.hasEndedToday
    });
    syncWorkTypeButtons();
    applyHolidayRestMode();
    applyWorkTypeGate();
    renderSimpleStatus();
    return true;
  } catch {
    return false;
  }
};

const pad2 = (n) => String(n).padStart(2, '0');
const isISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const todayJST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const FIXED_START = '08:00';
const FIXED_END = '17:00';
const nowHmJST = () => {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const hh = pad2(d.getUTCHours());
  const mm = pad2(d.getUTCMinutes());
  return `${hh}:${mm}`;
};

const applyAutoTime = (el, val) => {
  if (!el) return;
  const v = String(val || '').trim();
  if (!/^\d{2}:\d{2}$/.test(v)) return;
  el.value = v;
  try { el.dataset.auto = '1'; el.dataset.autoVal = v; } catch {}
};

const clearAutoTime = (el) => {
  if (!el) return;
  try { delete el.dataset.auto; delete el.dataset.autoVal; } catch {}
};

const effectiveHm = (el) => {
  const v = String(el?.value || '').trim();
  const touched = String(el?.dataset?.touched || '') === '1';
  const isAuto = String(el?.dataset?.auto || '') === '1';
  const autoVal = String(el?.dataset?.autoVal || '');
  if (isAuto && !touched && autoVal && v === autoVal) return '';
  return v;
};

const fmtJP = (date) => {
  const [y, m, d] = String(date).split('-').map(x => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dow = ['日','月','火','水','木','金','土'][dt.getUTCDay()];
  return `${y}/${m}/${d}(${dow})`;
};
const fmtYmd = (dateTimeStr) => {
  try {
    const s = String(dateTimeStr || '');
    const d = s.slice(0, 10);
    if (isISODate(d)) {
      const [y,m,d2] = d.split('-');
      return `${y}/${m}/${d2}`;
    }
    const dt = new Date(s);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2,'0');
    const d2 = String(dt.getUTCDate()).padStart(2,'0');
    return `${y}/${m}/${d2}`;
  } catch { return '—'; }
};
const renderNotices = async (date) => {
  try {
    const box = $('#noticeBox');
    const title = $('#noticeTitle');
    if (!box) return;
    const r = await fetchJSONAuth(`/api/notices?date=${encodeURIComponent(date)}&limit=10`).catch(() => null);
    const items = Array.isArray(r?.notices) ? r.notices : [];
    if (title) {
      const latest = items.length ? items[0] : null;
      title.textContent = `お知らせ（最終更新日：${latest ? fmtYmd(latest.created_at) : '—'}）`;
    }
    if (!items.length) {
      box.innerHTML = `<div class="simple-notice-empty">お知らせはありません</div>`;
      return;
    }
    const html = [
      `<div class="simple-notice-list">`,
      ...items.map(n => `
        <details class="simple-notice-item ${n.read_at ? 'is-read' : 'is-unread'}">
          <summary class="simple-notice-summary">
            <div class="simple-notice-left">
              <span class="simple-notice-tag">お知らせ</span>
              <span class="simple-notice-preview">${esc(String(n.message || '').slice(0, 200))}</span>
            </div>
            <span class="simple-notice-time">${esc(fmtYmd(n.created_at))}</span>
          </summary>
          <div class="simple-notice-body">${esc(String(n.message || ''))}</div>
        </details>
      `),
      `</div>`
    ].join('');
    box.innerHTML = html;
    try {
      const ids = items.filter(it => !it.read_at).map(it => it.id);
      if (ids.length) {
        // Lazy mark as read
        fetchJSONAuth('/api/notices/read', { method: 'POST', body: JSON.stringify({ ids }) }).catch(() => {});
      }
    } catch {}
  } catch {
    try {
      const box = $('#noticeBox');
      if (box) box.innerHTML = `<div class="simple-notice-empty">個人カレンダー登録画面 へご確認ください。</div>`;
    } catch {}
  }
};

const parseHm = (hm) => {
  const s = String(hm || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm, total: hh * 60 + mm };
};

const toMySQLDateTime = (date, hm) => {
  const t = parseHm(hm);
  if (!t) return null;
  return `${date} ${pad2(t.hh)}:${pad2(t.mm)}:00`;
};

async function ensureAuthProfile() {
  let token = sessionStorage.getItem('accessToken');
  let profile = null;
  if (token) { try { profile = await me(token); } catch {} }
  if (!profile) {
    try {
      const r = await refresh();
      sessionStorage.setItem('accessToken', r.accessToken);
      profile = await me(r.accessToken);
    } catch {}
  }
  return profile || null;
}

const pickLatestSegment = (segments) => {
  const arr = Array.isArray(segments) ? segments : [];
  if (!arr.length) return null;
  let best = arr[0];
  for (const s of arr) {
    const a = String(s?.checkIn || '');
    const b = String(best?.checkIn || '');
    if (a && a > b) best = s;
  }
  return best;
};

const pickOpenSegment = (segments) => {
  const arr = Array.isArray(segments) ? segments : [];
  let best = null;
  for (const s of arr) {
    if (!s?.checkIn || s?.checkOut) continue;
    if (!best || String(s.checkIn) > String(best.checkIn)) best = s;
  }
  return best;
};

const isPlannedPlaceholderSegment = (seg, shiftStart, shiftEnd) => {
  try {
    if (!seg?.checkIn) return false;
    const inHm = String(seg.checkIn).slice(11, 16);
    const outHm = seg?.checkOut ? String(seg.checkOut).slice(11, 16) : '';
    const ss = String(shiftStart || '').trim();
    const se = String(shiftEnd || '').trim();
    const wt = String(seg?.work_type || seg?.workType || '').trim();
    const labels = String(seg?.labels || '').trim();
    const matchesPlan = !!(ss && inHm === ss && (!outHm || !se || outHm === se));
    // Ignore auto/planned row: shift-like time and no explicit workType/labels.
    return !!(matchesPlan && !wt && !labels);
  } catch {
    return false;
  }
};
const isTodayShiftGhostSegment = (seg, shiftStart, shiftEnd, date) => {
  try {
    if (String(date || '') !== todayJST()) return false;
    if (!seg?.checkIn) return false;
    const inHm = String(seg.checkIn).slice(11, 16);
    const outHm = seg?.checkOut ? String(seg.checkOut).slice(11, 16) : '';
    const ss = String(shiftStart || '').trim();
    const se = String(shiftEnd || '').trim();
    if (!ss || inHm !== ss) return false;
    // On today screen, a pure shift-shaped row is treated as ghost/planned
    // so employee can stamp actual click-time.
    return !outHm || !se || outHm === se;
  } catch {
    return false;
  }
};

const setUrlDate = (date) => {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('date', date);
    history.replaceState(null, '', u.pathname + u.search);
  } catch {}
};

const getUrlDate = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('date');
    if (isISODate(d)) return d;
  } catch {}
  return todayJST();
};
const shouldKeepDateOnBoot = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    return String(p.get('keepDate') || '') === '1';
  } catch {
    return false;
  }
};

const calcWorkMinutes = () => {
  // Use the visible time values for live UI calculation.
  const s = parseHm(String($('#startTime')?.value || '').trim());
  const e = parseHm(String($('#endTime')?.value || '').trim());
  const b = parseInt($('#breakMin')?.value || '0', 10) || 0;
  if (!s || !e) return null;
  const raw = e.total - s.total - b;
  // If break time is larger than worked span, show 0:00 instead of blank.
  return Math.max(0, raw);
};

const renderWorkMinutes = () => {
  const box = $('#workMinutes');
  if (!box) return;
  const stEl = $('#startTime');
  const etEl = $('#endTime');
  const stAuto = String(stEl?.dataset?.auto || '') === '1';
  const etAuto = String(etEl?.dataset?.auto || '') === '1';
  const stTouched = String(stEl?.dataset?.touched || '') === '1';
  const etTouched = String(etEl?.dataset?.touched || '') === '1';
  const shouldFade = (stAuto && !stTouched) || (etAuto && !etTouched);
  box.classList.toggle('is-auto', shouldFade);
  const m = calcWorkMinutes();
  if (m == null) { box.textContent = '—'; return; }
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  box.textContent = `${hh}:${pad2(mm)}`;
};

const getSimpleStatusMeta = () => {
  const roleStr = String(window.userRole || '').toLowerCase();
  const isAdminView = roleStr === 'admin' || roleStr === 'manager';
  const monthApproved = String(window.state?.currentMonthStatus || '').trim() === 'approved';
  const kubunEl = $('#kubun');
  const isPlanned = !!kubunEl?.classList?.contains('is-planned');
  const hasActualNow = !!(effectiveHm($('#startTime')) || effectiveHm($('#endTime')));
  if (isPlanned && !hasActualNow) return { text: '未申請', cls: 'warn' };
  if (monthApproved) return { text: '承認済み', cls: 'ok' };
  if (hasActualNow) return { text: isAdminView ? '承認待ち' : '未確認', cls: 'warn' };
  return { text: '未申請', cls: 'warn' };
};

const renderSimpleStatus = () => {
  const meta = getSimpleStatusMeta();
  ['#topStatus', '#panelStatus'].forEach((selector) => {
    const el = $(selector);
    if (!el) return;
    el.textContent = meta.text;
    el.classList.remove('ok', 'warn', 'danger');
    el.classList.add(meta.cls);
  });
};

const renderStampButtons = ({ date, inHm = '', outHm = '', hasOpen = false } = {}) => {
  try {
    const btnIn = $('#btnStartStamp');
    const btnOut = $('#btnEndStamp');
    const canStamp = String(date || '') === todayJST();
    const st = window.state || {};
    const hasGhostPlanned = !!st.plannedStampAttendanceId;
    const hasStarted = (!hasGhostPlanned) && (!!st.hasStartedToday || !!String(inHm || '').trim());
    const hasEnded = !!st.hasEndedToday || !!String(outHm || '').trim();
    // Keep compact labels in sync with mobile CSS breakpoints to avoid button text overflow.
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px)').matches;

    // For non-today dates, keep labels neutral to avoid confusing "started at 08:00"
    // from planned/legacy data while stamping is intentionally disabled.
    if (!canStamp) {
      if (btnIn) {
        btnIn.disabled = true;
        btnIn.textContent = '開始打刻';
      }
      if (btnOut) {
        btnOut.disabled = true;
        btnOut.textContent = '終了打刻';
      }
      return;
    }

    if (btnIn) {
      btnIn.disabled = !canStamp || hasOpen || hasStarted;
      btnIn.textContent = inHm
        ? (isMobile ? `開始済 (${inHm})` : `開始打刻済 (${inHm})`)
        : '開始打刻';
    }
    if (btnOut) {
      btnOut.disabled = !canStamp || !hasStarted || hasEnded;
      if (hasOpen || (hasStarted && !hasEnded)) btnOut.textContent = '終了打刻';
      else if (hasEnded && outHm) {
        btnOut.textContent = isMobile ? `終了済 (${outHm})` : `終了打刻済 (${outHm})`;
      } else btnOut.textContent = '終了打刻';
    }
  } catch {}
};

const syncWorkTypeButtons = () => {
  const el = $('#workType');
  if (!el) return;
  const v = String(el.value || '');
  document.querySelectorAll('.simple-wt-btn[data-worktype]').forEach((btn) => {
    const on = String(btn.dataset.worktype || '') === v;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
};

const ensureDefaultWorkTypeForToday = (date) => {
  try {
    if (String(date || '') !== todayJST()) return;
    const kubun = String($('#kubun')?.value || '').trim();
    const nonWorking = ['欠勤', '有給休暇', '半休', '無給休暇', '休日'].includes(kubun);
    if (nonWorking) return;
    const el = $('#workType');
    if (!el) return;
    const cur = String(el.value || '').trim();
    if (cur) return;
    // Default to onsite so employees can check in/out immediately.
    el.value = 'onsite';
    saveWorkType(date, 'onsite');
    syncWorkTypeButtons();
  } catch {}
};

const applyWorkTypeGate = () => {
  const st = window.state || {};
  const kubun = String($('#kubun')?.value || '').trim();
  const workType = String($('#workType')?.value || '').trim();
  const nonWorking = !!st.restHoliday || ['欠勤', '有給休暇', '半休', '無給休暇'].includes(kubun);
  const locked = !nonWorking && !workType;
  const setDisabled = (selector, disabled) => {
    const el = $(selector);
    if (!el) return;
    el.disabled = !!disabled;
    if (disabled) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
  };
  [
    '#startTime',
    '#endTime',
    '#btnStartStamp',
    '#btnEndStamp',
    '#workSite',
    '#workContent',
    '#breakMin',
    '#nightBreakMin',
    '#btnSave',
    '#btnConfirm'
  ].forEach((selector) => setDisabled(selector, locked));
  document.querySelector('.simple-stamp-stack')?.classList.toggle('is-disabled', locked);
  document.querySelector('.simple-work-report')?.classList.toggle('is-disabled', locked);
};

const applyHolidayRestMode = () => {
  const st = window.state || {};
  const kubun = String($('#kubun')?.value || '').trim();
  const restHoliday = !!st.isOff && kubun === '休日';
  st.restHoliday = restHoliday;
  window.state = st;

  const toggle = (el, hidden) => {
    if (!el) return;
    el.style.display = hidden ? 'none' : '';
  };

  const nonWorking = restHoliday || ['欠勤', '有給休暇', '半休', '無給休暇'].includes(kubun);
  toggle(document.querySelector('.simple-stamp-stack'), nonWorking);
  toggle(document.querySelector('.simple-grid2'), nonWorking);
  toggle($('#workMinutes')?.closest('.simple-row'), nonWorking);
  toggle(document.querySelector('.simple-worktype-buttons'), nonWorking);
  toggle(document.querySelector('.simple-work-report'), restHoliday);

  if (nonWorking) {
    const st = $('#startTime');
    const et = $('#endTime');
    if (st) {
      st.value = '';
      clearAutoTime(st);
      try { delete st.dataset.touched; } catch {}
    }
    if (et) {
      et.value = '';
      clearAutoTime(et);
      try { delete et.dataset.touched; } catch {}
    }
    const wt = $('#workType');
    if (wt) wt.value = '';
    try { if (window.state?.date) saveWorkType(window.state.date, ''); } catch {}
    const btnIn = $('#btnStartStamp');
    const btnOut = $('#btnEndStamp');
    if (btnIn) btnIn.disabled = true;
    if (btnOut) btnOut.disabled = true;
    const siteEl = $('#workSite');
    const workEl = $('#workContent');
    // Không tự động xóa site/work nếu đã có dữ liệu (để user có thể lưu báo cáo ngày nghỉ nếu muốn)
    // if (siteEl) siteEl.value = '';
    // if (workEl) workEl.value = '';
    syncWorkTypeButtons();
    renderWorkMinutes();
  } else {
    const st = $('#startTime');
    const et = $('#endTime');
    if (st && !String(st.value || '').trim() && /^\d{2}:\d{2}$/.test(String((window.state || {}).shiftStart || ''))) {
      applyAutoTime(st, (window.state || {}).shiftStart);
    }
    if (et && !String(et.value || '').trim() && /^\d{2}:\d{2}$/.test(String((window.state || {}).shiftEnd || ''))) {
      applyAutoTime(et, (window.state || {}).shiftEnd);
    }
    renderWorkMinutes();
  }
  applyWorkTypeGate();
};

const wireWorkTypeButtons = () => {
  const el = $('#workType');
  if (!el) return;
  document.querySelectorAll('.simple-wt-btn[data-worktype]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = String(btn.dataset.worktype || '');
      if (!v) return;
      el.value = v;
      syncWorkTypeButtons();
      try { el.dispatchEvent(new Event('change')); } catch {}
    });
  });
  el.addEventListener('change', syncWorkTypeButtons);
  syncWorkTypeButtons();
};

const workTypeKey = (date) => `attendanceSimple.workType.${date}`;
const loadSavedWorkType = (date) => {
  try {
    const v = localStorage.getItem(workTypeKey(date)) || '';
    return v ? String(v) : null;
  } catch {
    return null;
  }
};
const saveWorkType = (date, v) => {
  try { localStorage.setItem(workTypeKey(date), String(v || '')); } catch {}
};

const loadPanelOpen = (key, def = true) => {
  try {
    const v = localStorage.getItem(String(key));
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {}
  return !!def;
};
const savePanelOpen = (key, open) => {
  try { localStorage.setItem(String(key), open ? '1' : '0'); } catch {}
};
const applyPanelOpen = (toggleId, bodyId, open) => {
  const btn = document.getElementById(toggleId);
  const body = document.getElementById(bodyId);
  if (!btn || !body) return;
  if (open) body.removeAttribute('hidden');
  else body.setAttribute('hidden', '');
  btn.checked = !!open;
};

const getCalendarOff = async (date) => {
  // Ưu tiên trạng thái nghỉ từ API vì đã áp dụng policy theo phòng ban (ví dụ: 工事部).
  const cal = await fetchJSONAuth(`/api/attendance/calendar/day/${encodeURIComponent(date)}`).catch(() => null);
  if (cal && Object.prototype.hasOwnProperty.call(cal, 'is_off')) {
    return Number(cal?.is_off || 0) === 1;
  }

  // Fallback an toàn khi API calendar tạm thời lỗi.
  const weekend = (() => {
    try {
      const [y, m, d] = date.split('-').map(x => parseInt(x, 10));
      if (!y || isNaN(m) || !d) return false;
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dow = dt.getUTCDay();
      return dow === 0 || dow === 6;
    } catch { return false; }
  })();
  return weekend;
};

const shiftCache = new Map();
const getShiftForDate = async (date) => {
  const d = String(date || '').slice(0, 10);
  if (!isISODate(d)) return null;
  if (shiftCache.has(d)) return shiftCache.get(d) || null;
  const r = await fetchJSONAuth(`/api/attendance/shifts/assignments?from=${encodeURIComponent(d)}&to=${encodeURIComponent(d)}`).catch(() => null);
  const items = Array.isArray(r?.items) ? r.items : [];
  let best = null;
  for (const it of items) {
    const sd = String(it?.start_date || '').slice(0, 10);
    const ed = it?.end_date ? String(it.end_date).slice(0, 10) : '';
    if (!sd || sd > d) continue;
    if (ed && ed < d) continue;
    if (it?.shift?.start_time && it?.shift?.end_time) best = it.shift;
  }
  shiftCache.set(d, best || null);
  return best || null;
};

const persistDaily = async (date) => {
  const kubun = String($('#kubun')?.value || '').trim();
  const workType = String($('#workType')?.value || '').trim();
  const breakMinutes = Number($('#breakMin')?.value || 60);
  const nightBreakMinutes = Number($('#nightBreakMin')?.value || 0);
  await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, {
    method: 'PUT',
    body: JSON.stringify({
      kubun,
      workType: workType || null,
      breakMinutes: Number.isFinite(breakMinutes) ? breakMinutes : 60,
      nightBreakMinutes: Number.isFinite(nightBreakMinutes) ? nightBreakMinutes : 0
    })
  });
};

const loadMonthStatus = async (date) => {
  try {
    const y = String(date || '').slice(0, 4);
    const m = String(date || '').slice(5, 7);
    if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m)) return 'draft';
    // Fast path: use dedicated lightweight status endpoint instead of full month payload.
    const r = await fetchJSONAuth(`/api/attendance/month/status?year=${encodeURIComponent(y)}&month=${encodeURIComponent(parseInt(m, 10))}`);
    const st = String(r?.status || '').trim();
    return st || 'draft';
  } catch {
    return 'draft';
  }
};

const load = async (date, opts = {}) => {
  showErr('');
  const useSpinner = opts?.spinner !== false;
  if (useSpinner) showSpinner(true);
  try {
    $('#topDate').textContent = fmtJP(date);
    if (date === todayJST()) {
      try {
        const wtEl = $('#workType');
        if (wtEl && !String(wtEl.value || '').trim()) {
          wtEl.value = 'onsite';
          saveWorkType(date, 'onsite');
          syncWorkTypeButtons();
          applyWorkTypeGate();
        }
      } catch {}
    }
    // Parallelize initial fetches to reduce mobile cold-start latency.
    const noticesTask = renderNotices(date).catch(() => null);
    const monthStatusTask = loadMonthStatus(date).catch(() => 'draft');
    const isOffTask = getCalendarOff(date).catch(() => false);
    const shiftTask = getShiftForDate(date).catch(() => null);
    const dailyTask = fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`).catch(() => null);
    const dayTask = fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}`).catch(() => ({ segments: [] }));
    const reportTask = fetchJSONAuth(`/api/work-reports/my?date=${encodeURIComponent(date)}`).catch(() => null);

    state.currentMonthStatus = await monthStatusTask;
    const [isOff, shift, daily0, day] = await Promise.all([isOffTask, shiftTask, dailyTask, dayTask]);
    const shiftStart = String(shift?.start_time || FIXED_START).trim();
    const shiftEnd = String(shift?.end_time || FIXED_END).trim();
    state.shiftStart = shiftStart;
    state.shiftEnd = shiftEnd;
    
    // Hiển thị thông tin ca làm việc cố định (Ưu tiên 2)
    const shiftInfoBox = $('#shiftInfo');
    if (shiftInfoBox) {
      shiftInfoBox.innerHTML = shift 
        ? `<span class="shift-tag">勤務シフト: ${shift.name} (${shiftStart} - ${shiftEnd})</span>`
        : `<span class="shift-tag">デフォルトシフト: ${shiftStart} - ${shiftEnd}</span>`;
      shiftInfoBox.removeAttribute('hidden');
    }

    const daily = daily0?.daily || null;
    const defaultKubun = isOff ? '休日' : '出勤';
    const kubunSaved = String(daily?.kubun || '').trim();
    const kubunInit = kubunSaved || defaultKubun;
    
    // Cập nhật state trước khi gọi applyHolidayRestMode
    state.isOff = !!isOff;
    
    const kubunOptions = isOff
      ? ['休日', '休日出勤', '代替出勤']
      : ['出勤', '半休', '欠勤', '有給休暇', '無給休暇', '代替休日'];
    const kubunGroupLabel = isOff ? '【予定休日】' : '【予定出勤】';
    try {
      const selK = $('#kubun');
      if (selK) {
        selK.innerHTML = `<option value="" disabled>${kubunGroupLabel}</option>${kubunOptions.map(k => `<option value="${k}">${k}</option>`).join('')}`;
        selK.value = kubunOptions.includes(kubunInit) ? kubunInit : defaultKubun;
        selK.classList.toggle('is-planned', !kubunSaved);
        setupSimpleCombo(selK);
      }
    } catch {}
    const segmentsRaw = Array.isArray(day?.segments) ? day.segments : [];
    // If monthly data was explicitly edited/saved, treat shift-like rows as actual
    // (do not auto-classify them as planned ghost rows).
    const hasExplicitDailyInput = !!(
      kubunSaved ||
      String(daily?.workType || '').trim() ||
      String(daily?.location || '').trim() ||
      String(daily?.memo || '').trim()
    );
    const plannedOpenSeg = (!hasExplicitDailyInput ? segmentsRaw.find((s) =>
      isPlannedPlaceholderSegment(s, shiftStart, shiftEnd) && s?.checkIn && !s?.checkOut
    ) : null) || null;
    const shiftLikeOpenSeg = segmentsRaw.find((s) => {
      try {
        if (!s?.id || !s?.checkIn || s?.checkOut) return false;
        const inHm = String(s.checkIn).slice(11, 16);
        return !!(shiftStart && inHm === shiftStart);
      } catch {
        return false;
      }
    }) || null;
    const ghostSeg = (!hasExplicitDailyInput ? segmentsRaw.find((s) =>
      isTodayShiftGhostSegment(s, shiftStart, shiftEnd, date)
    ) : null) || null;
    state.plannedOpenAttendanceId = plannedOpenSeg?.id || null;
    state.shiftLikeOpenAttendanceId = shiftLikeOpenSeg?.id || null;
    state.plannedStampAttendanceId = ghostSeg?.id || null;
    const segments = segmentsRaw.filter((s) => {
      if (hasExplicitDailyInput) return true;
      return !isPlannedPlaceholderSegment(s, shiftStart, shiftEnd) &&
        !isTodayShiftGhostSegment(s, shiftStart, shiftEnd, date);
    });
    let seg = pickLatestSegment(segments);
    const openSeg = pickOpenSegment(segments);
    if (date === todayJST() && seg?.checkIn && seg?.checkOut) {
      try {
        const outHmRaw = String(seg.checkOut).slice(11, 16);
        const nowHm = nowHmJST();
        if (/^\d{2}:\d{2}$/.test(outHmRaw) && outHmRaw > nowHm) {
          seg = { ...seg, checkOut: null };
        }
      } catch {}
    }
    if (!openSeg?.checkIn && !seg?.checkIn) {
      if (date === todayJST()) {
        try {
          const st = await fetchJSONAuth(`/api/attendance/status?date=${encodeURIComponent(date)}`).catch(() => null);
          if (st?.attendance?.checkIn) {
            const fromStatus = { checkIn: st.attendance.checkIn, checkOut: st.attendance.checkOut || null };
            if (hasExplicitDailyInput || !isTodayShiftGhostSegment(fromStatus, shiftStart, shiftEnd, date)) {
              seg = fromStatus;
            }
          }
        } catch {}
      }
    }
    const hasStartedOnce = segments.some(s => !!s?.checkIn);
    const hasEndedOnce = segments.some(s => !!s?.checkIn && !!s?.checkOut);
    state.hasStartedToday = hasStartedOnce || !!seg?.checkIn;
    state.hasEndedToday = hasEndedOnce || !!(seg?.checkIn && seg?.checkOut);
    renderSimpleStatus();
    try { $('#topDate').textContent = fmtJP(date); } catch {}

    const effectiveOpenSeg = openSeg || ((seg?.checkIn && !seg?.checkOut) ? seg : null);
    const stampSeg = effectiveOpenSeg || seg;
    const st = $('#startTime');
    const et = $('#endTime');
    if (st) {
      if (stampSeg?.checkIn) {
        st.value = String(stampSeg.checkIn).slice(11, 16);
        clearAutoTime(st);
      } else {
        applyAutoTime(st, shiftStart);
      }
      try { delete st.dataset.touched; } catch {}
    }
    if (et) {
      if (stampSeg?.checkOut) {
        et.value = String(stampSeg.checkOut).slice(11, 16);
        clearAutoTime(et);
      } else {
        if (stampSeg?.checkIn && !stampSeg?.checkOut) {
          // Started but not ended yet: keep planned end-time in faded style.
          applyAutoTime(et, shiftEnd);
        } else {
          applyAutoTime(et, shiftEnd);
        }
      }
      try { delete et.dataset.touched; } catch {}
    }
    renderStampButtons({
      date,
      inHm: (effectiveOpenSeg?.checkIn ? String(effectiveOpenSeg.checkIn).slice(11, 16) : '') || (seg?.checkIn ? String(seg.checkIn).slice(11, 16) : ''),
      outHm: seg?.checkOut ? String(seg.checkOut).slice(11, 16) : '',
      hasOpen: !!effectiveOpenSeg?.checkIn && !effectiveOpenSeg?.checkOut
    });

    const sel = $('#workType');
    const saved = loadSavedWorkType(date);
    if (sel) {
      if (daily?.workType) sel.value = String(daily.workType).trim();
      else if (saved) sel.value = saved;
      else if (!String(sel.value || '').trim()) sel.value = '';
    }
    ensureDefaultWorkTypeForToday(date);
    // Do not auto-create/update daily rows on load.

    // Non-critical data: keep loading in background so UI becomes interactive sooner.
    const applyReport = (rep) => {
      const siteEl = $('#workSite');
      const workEl = $('#workContent');
      if (rep && (rep.site || rep.work)) {
        if (siteEl) siteEl.value = rep.site || '';
        if (workEl) workEl.value = rep.work || '';
        clearDraft(date);
      } else if (daily && (daily.location || daily.memo)) {
        if (siteEl) siteEl.value = daily.location || '';
        if (workEl) workEl.value = daily.memo || '';
      } else {
        const draft = loadDraft(date);
        if (draft) {
          if (siteEl && !siteEl.value) siteEl.value = draft.site || '';
          if (workEl && !workEl.value) workEl.value = draft.work || '';
        }
      }
    };
    Promise.resolve(noticesTask).catch(() => null);
    Promise.resolve(reportTask).then((r) => applyReport(r?.report || null)).catch(() => applyReport(null));

    renderWorkMinutes();
    syncWorkTypeButtons();
    applyHolidayRestMode();
    applyWorkTypeGate();
    saveFastSnapshot(date);
  } catch (e) {
    showErr(e?.message || '読み込みに失敗しました');
  } finally {
    if (useSpinner) showSpinner(false);
  }
};

const saveWorkReportIfPossible = async (date) => {
  if (state.restHoliday) return { attempted: false, saved: false };
  const site0 = String($('#workSite')?.value || '').trim();
  const work = String($('#workContent')?.value || '').trim();
  if (!site0 && !work) return { attempted: false, saved: false };
  saveDraft(date, site0, work);
  if (!work) return { attempted: true, saved: false, message: '作業内容を入力してください' };
  const site = site0 || '飯塚塗研';
  try {
    const workType = String($('#workType')?.value || '').trim() || null;
    const r = await fetchJSONAuth('/api/work-reports', { method: 'POST', body: JSON.stringify({ date, site, work, workType }) });
    clearDraft(date);
    return { attempted: true, saved: true, report: r?.report || null };
  } catch (e) {
    const msg = String(e?.message || '');
    return { attempted: true, saved: false, message: `作業報告の保存に失敗しました: ${msg || 'unknown'}` };
  }
};

const tryCheckIn = async () => {
  try {
    const wt = String($('#workType')?.value || '').trim();
    await fetchJSONAuth('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ workType: wt || null }) });
    return { ok: true, already: false };
  } catch (e) {
    const m = String(e?.message || '');
    const ml = m.toLowerCase();
    if (
      ml.includes('already checked in') ||
      ml.includes('checked in') ||
      ml.includes('409') ||
      m.includes('既に') ||
      m.includes('出勤済み')
    ) {
      return { ok: true, already: true };
    }
    throw e;
  }
};

const tryReplaceShiftLikeSegmentWithNow = async (date) => {
  try {
    const d = String(date || '').slice(0, 10);
    if (!isISODate(d)) return false;
    const day = await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(d)}`).catch(() => null);
    const segments = Array.isArray(day?.segments) ? day.segments : [];
    if (!segments.length) return false;

    const shiftStart = String(window.state?.shiftStart || FIXED_START).trim();
    const shiftEnd = String(window.state?.shiftEnd || FIXED_END).trim();
    const isShiftLike = (seg) => {
      try {
        const inHm = String(seg?.checkIn || '').slice(11, 16);
        const outHm = seg?.checkOut ? String(seg.checkOut).slice(11, 16) : '';
        if (!inHm || !shiftStart || inHm !== shiftStart) return false;
        // Planned/fallback row shape: same start as shift and no end or shift end.
        return !outHm || !shiftEnd || outHm === shiftEnd;
      } catch {
        return false;
      }
    };

    let target = null;
    for (const s of segments) {
      if (!isShiftLike(s)) continue;
      if (!target || String(s?.checkIn || '') > String(target?.checkIn || '')) target = s;
    }
    if (!target?.id) return false;

    const cinNow = toMySQLDateTime(d, nowHmJST());
    if (!cinNow) return false;
    await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(d)}`, {
      method: 'PUT',
      body: JSON.stringify({ attendanceId: target.id, checkIn: cinNow, checkOut: null })
    });
    return true;
  } catch {
    return false;
  }
};

const tryCheckOut = async () => {
  try {
    await fetchJSONAuth('/api/attendance/checkout', { method: 'POST', body: JSON.stringify({}) });
    return { ok: true, noOpen: false };
  } catch (e) {
    const m = String(e?.message || '');
    if (m.includes('No open attendance') || m.includes('404')) return { ok: true, noOpen: true };
    throw e;
  }
};

const save = async (date) => {
  showErr('');
  const stEl = $('#startTime');
  const etEl = $('#endTime');
  const s = effectiveHm(stEl);
  const e = effectiveHm(etEl);

  // Allow full-day time entry (00:00-23:59), including night-shift scenarios.

  const cin = state.restHoliday ? null : toMySQLDateTime(date, s);
  const cout0 = state.restHoliday ? null : toMySQLDateTime(date, e);

  showSpinner(true);
  try {
    try { await persistDaily(date); } catch {}
    const wt = state.restHoliday ? '' : String($('#workType')?.value || '');
    if (wt) saveWorkType(date, wt);
    
    const rEl = $('#workContent');
    const sEl = $('#workSite');
    if (!state.restHoliday && (rEl || sEl)) {
      const workStr = String(rEl?.value || '').trim();
      const siteStr = String(sEl?.value || '').trim();
      
      if (workStr || siteStr) {
        // Must update daily table directly because attendance-monthly.render reads daily.location and daily.memo
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/daily`, {
          method: 'PUT',
          body: JSON.stringify({
            location: siteStr || '飯塚塗研',
            memo: workStr || ' ',
            kubun: String($('#kubun')?.value || '').trim(),
            workType: wt || null,
            breakMinutes: Number($('#breakMin')?.value || 60),
            nightBreakMinutes: Number($('#nightBreakMin')?.value || 0)
          })
        });
        clearDraft(date);
      }
    }

    const day = await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}`);
    const seg = pickLatestSegment(day?.segments);
    const startTouched = String(stEl?.dataset?.touched || '') === '1';
    const endTouched = String(etEl?.dataset?.touched || '') === '1';
    
    if (seg?.id) {
      const endVal = String(etEl?.value || '').trim();
      const hasOut = !!seg?.checkOut;
      
      const body = { attendanceId: seg.id };
      let shouldUpdate = false;
      
      if (startTouched && cin) {
        body.checkIn = cin;
        shouldUpdate = true;
      }
      
      if (endTouched && cout0) {
        body.checkOut = cout0;
        shouldUpdate = true;
      } else if (hasOut && !endVal && endTouched) {
        // They cleared the end time
        body.checkOut = null;
        shouldUpdate = true;
      }
      
      if (shouldUpdate) {
        if (!body.checkIn && !seg.checkIn) {
           showErr('開始時間を入力してください');
           return false;
        }
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}`, { method: 'PUT', body: JSON.stringify(body) });
      }
    } else {
      if (startTouched || endTouched) {
         if (!cin && startTouched) {
            showErr('開始時間を入力してください');
            return false;
         }
         if (cin) {
           const body = { checkIn: cin };
           if (endTouched && cout0) body.checkOut = cout0;
           await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(date)}/segments`, { method: 'POST', body: JSON.stringify(body) });
         }
      }
    }
    
    await load(date);
    return true;
  } catch (e) {
    showErr(e?.message || '登録に失敗しました');
    return false;
  } finally {
    showSpinner(false);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  showErr('');
  const profile = await ensureAuthProfile();
  if (!profile) {
    window.location.replace('/ui/login');
    return;
  }
  simpleUserId = String(profile?.id || '');
  try {
    const panels = [
      { key: 'attendanceSimple.notice.open', toggleId: 'toggleNotice', bodyId: 'noticeBox', def: true },
      { key: 'attendanceSimple.actuals.open', toggleId: 'toggleActuals', bodyId: 'actualsBody', def: true },
      { key: 'attendanceSimple.details.open', toggleId: 'toggleDetails', bodyId: 'detailPanelBody', def: true }
    ];
    for (const p of panels) {
      const open0 = loadPanelOpen(p.key, p.def);
      applyPanelOpen(p.toggleId, p.bodyId, open0);
      document.getElementById(p.toggleId)?.addEventListener('change', (e) => {
        const next = !!e.currentTarget?.checked;
        applyPanelOpen(p.toggleId, p.bodyId, next);
        savePanelOpen(p.key, next);
      });
    }
  } catch {}
  const role = String(profile?.role || '').toLowerCase();
  if (role === 'admin') {
    try { document.body.dataset.roleAdmin = '1'; } catch {}
  }
  try { window.userRole = role; } catch {}

  const bootDate = (() => {
    const d = getUrlDate();
    if (shouldKeepDateOnBoot()) return d;
    // In simple stamping screen, default to today to avoid accidental lock
    // when a stale ?date=YYYY-MM-DD URL is restored on production devices.
    return d === todayJST() ? d : todayJST();
  })();
  const state = { date: bootDate, isOff: false, restHoliday: false, shiftStart: FIXED_START, shiftEnd: FIXED_END, hasStartedToday: false, hasEndedToday: false };
  window.state = state; // Gán vào window để các hàm bên ngoài scope DOMContentLoaded (như applyHolidayRestMode) có thể truy cập
  let startStampInFlight = false;
  setUrlDate(state.date);
  const persistWorkType = async () => {
    // Keep work type as local draft only on simple screen.
    // Do not auto-write daily data before actual stamp/save.
    try {
      const wt = String($('#workType')?.value || '').trim();
      saveWorkType(state.date, wt || '');
    } catch {}
  };

  const doStartStamp = async () => {
    if (startStampInFlight) return;
    showErr('');
    // Strict lock: once started, do not allow re-stamping from simple screen.
    if (state.hasStartedToday && !state.plannedStampAttendanceId) {
      showErr('開始打刻は1日1回までです。修正は月次勤怠入力で行ってください。');
      return;
    }
    if (!String($('#workType')?.value || '').trim()) {
      showErr('先に勤務区分を選択してください');
      return;
    }
    if (state.date !== todayJST()) {
      showErr('本日のみ打刻できます');
      return;
    }
    try {
      startStampInFlight = true;
      showSpinner(true);
      let r = null;
      const hmNow = nowHmJST();
      const overrideAttendanceId = state.plannedStampAttendanceId || null;
      if (overrideAttendanceId) {
        const cinNow = toMySQLDateTime(state.date, hmNow);
        await fetchJSONAuth(`/api/attendance/date/${encodeURIComponent(state.date)}`, {
          method: 'PUT',
          body: JSON.stringify({ attendanceId: overrideAttendanceId, checkIn: cinNow, checkOut: null })
        });
        r = { ok: true, already: false, replacedPlannedOpen: true };
      } else {
        r = await tryCheckIn();
        if (r?.already) {
          const replaced = await tryReplaceShiftLikeSegmentWithNow(state.date);
          if (replaced) r = { ok: true, already: false, replacedShiftLike: true };
        }
      }
      if (!r?.already) {
        try {
          const hm = hmNow;
          const st = $('#startTime');
          if (st && String(st.dataset?.touched || '') !== '1') st.value = hm;
          clearAutoTime(st);
          try { if (st) st.dataset.touched = '1'; } catch {}
          const btnIn = $('#btnStartStamp');
          const btnOut = $('#btnEndStamp');
          if (btnIn) {
            btnIn.disabled = true;
            const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
            btnIn.textContent = isMobile ? `開始済 (${hm})` : `開始打刻済 (${hm})`;
          }
          if (btnOut) { btnOut.disabled = false; }
        } catch {}
      }
      await load(state.date);
      if (r?.already) showToast('既に出勤済みです', 'error');
      else if (r?.replacedShiftLike) showToast('開始打刻を反映しました');
    } catch (e) {
      showErr(e?.message || '開始打刻に失敗しました');
    } finally {
      showSpinner(false);
      startStampInFlight = false;
    }
  };
  const doEndStamp = async () => {
    showErr('');
    if (state.hasEndedToday) {
      showErr('終了打刻は1日1回までです。修正は月次勤怠入力で行ってください。');
      return;
    }
    if (!String($('#workType')?.value || '').trim()) {
      showErr('先に勤務区分を選択してください');
      return;
    }
    if (state.date !== todayJST()) {
      showErr('本日のみ打刻できます');
      return;
    }
    try {
      showSpinner(true);
      const r = await tryCheckOut();
      await load(state.date);
      if (r?.noOpen) showToast('まだ出勤していません', 'error');
    } catch (e) {
      showErr(e?.message || '終了打刻に失敗しました');
    } finally {
      showSpinner(false);
    }
  };
  $('#btnStartStamp')?.addEventListener('click', doStartStamp);
  $('#btnEndStamp')?.addEventListener('click', doEndStamp);

  $('#btnPrev')?.addEventListener('click', async () => {
    const dt = new Date(state.date + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() - 1);
    state.date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    setUrlDate(state.date);
    await load(state.date);
  });
  $('#btnNext')?.addEventListener('click', async () => {
    const dt = new Date(state.date + 'T00:00:00Z');
    dt.setUTCDate(dt.getUTCDate() + 1);
    state.date = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    setUrlDate(state.date);
    await load(state.date);
  });

  $('#startTime')?.addEventListener('change', (e) => { try { e.currentTarget.dataset.touched = '1'; } catch {} clearAutoTime(e.currentTarget); renderWorkMinutes(); renderSimpleStatus(); });
  $('#endTime')?.addEventListener('change', (e) => { try { e.currentTarget.dataset.touched = '1'; } catch {} clearAutoTime(e.currentTarget); renderWorkMinutes(); renderSimpleStatus(); });
  $('#breakMin')?.addEventListener('change', renderWorkMinutes);
  wireWorkTypeButtons();
  $('#workType')?.addEventListener('change', () => { persistWorkType(); });
  $('#workType')?.addEventListener('change', () => { applyWorkTypeGate(); renderSimpleStatus(); });
  $('#kubun')?.addEventListener('change', async () => {
    $('#kubun')?.classList.toggle('is-planned', !String($('#kubun')?.value || '').trim());
    applyHolidayRestMode();
    renderSimpleStatus();
    try { await persistDaily(state.date); } catch {}
  });
  setupSimpleCombo(document.getElementById('breakMin'));
  setupSimpleCombo(document.getElementById('nightBreakMin'));
  $('#workSite')?.addEventListener('input', () => {
    saveDraft(state.date, String($('#workSite')?.value || ''), String($('#workContent')?.value || ''));
    renderSimpleStatus();
  });
  $('#workContent')?.addEventListener('input', () => {
    saveDraft(state.date, String($('#workSite')?.value || ''), String($('#workContent')?.value || ''));
    renderSimpleStatus();
  });
  try {
    const company = $('#company');
    if (company && !company.value) company.value = 'iizuka';
    setupSimpleCombo(company);
  } catch {}

  $('#btnReload')?.addEventListener('click', async () => { await load(state.date); });
  const persistSimpleEntry = async () => {
    const saved = await save(state.date);
    const rep = await saveWorkReportIfPossible(state.date);
    if (saved) {
      showToast('保存しました');
      if (rep?.saved && rep?.report?.id) showToast(`作業報告も保存しました (id=${rep.report.id})`, 'success');
      else if (rep?.attempted && !rep?.saved && rep?.message) showErr(rep.message);
    } else {
      showToast('保存に失敗しました', 'error');
    }
  };
  $('#btnSave')?.addEventListener('click', async (e) => {
    e.preventDefault(); // Chặn hành vi submit mặc định của form (tránh trắng trang)
    showErr('');
    if (!String($('#workType')?.value || '').trim() && !state.restHoliday) {
      showErr('先に勤務区分を選択してください');
      return;
    }
    await persistSimpleEntry();
  });
  $('#btnConfirm')?.addEventListener('click', async (e) => {
    e.preventDefault(); // Chặn hành vi submit mặc định của form (tránh trắng trang)
    showErr('');
    if (!String($('#workType')?.value || '').trim() && !state.restHoliday) {
      showErr('先に勤務区分を選択してください');
      return;
    }
    const ok = window.confirm('保存しますか？');
    if (!ok) return;
    await persistSimpleEntry();
  });
  $('#btnAdd')?.addEventListener('click', () => { showErr('この画面では勤務区分追加は未対応です'); });

  // Instant paint from recent snapshot, then sync with server in background.
  try { restoreFastSnapshot(state.date, state); } catch {}
  await load(state.date, { spinner: false });
  showSpinner(false);
});
