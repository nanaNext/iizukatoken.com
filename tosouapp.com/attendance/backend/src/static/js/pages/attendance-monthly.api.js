(function () {
  const root = globalThis.AttendanceMonthly || {};
  const core = root.Core || globalThis.MonthlyMonthlyCore || {};
  const {
    fetchJSONAuth,
    makeClientId,
    toDateTime,
    addDaysISO,
    parseHm
  } = core;

  const loadMonth = async (ym, userId) => {
    const [y, m] = String(ym).split('-').map(x => parseInt(x, 10));
    if (!y || !m) throw new Error('Invalid month');
    const uidQ = userId ? `&userId=${encodeURIComponent(userId)}` : '';
    const detailP = fetchJSONAuth(`/api/attendance/month/detail?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}`);
    const sumP = fetchJSONAuth(`/api/attendance/month?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}`).catch(() => null);
    const [detail, timesheet] = await Promise.all([detailP, sumP]);
    return { detail, timesheet };
  };

  const collectUpdates = (root, ym, userId, options = {}) => {
    const [y, m] = String(ym).split('-').map(x => parseInt(x, 10));
    const includeAll = !!options?.includeAll;
    const rows = Array.from(root.querySelectorAll('[data-row="1"][data-date]'));
    const updates = [];
    const dailyUpdates = [];
    for (const tr of rows) {
      if (!includeAll && String(tr.dataset.dirty || '') !== '1') continue;
      const dateStr = tr.dataset.date;
      const idRaw = String(tr.dataset.id || '').trim();
      let clientId = String(tr.dataset.clientId || '').trim();
      if (!idRaw && !clientId) {
        clientId = makeClientId();
        tr.dataset.clientId = clientId;
      }
      const clearFlag = String(tr.dataset.clear || '') === '1';
      const wt = (tr.querySelector('input[data-field="ckOnsite"]')?.checked ? 'onsite'
        : tr.querySelector('input[data-field="ckRemote"]')?.checked ? 'remote'
        : tr.querySelector('input[data-field="ckSatellite"]')?.checked ? 'satellite'
        : String(tr.dataset.workType || '')).trim();
      const isPrimary = String(tr.dataset.primary || '') === '1';
      const kubunVal = String(tr.querySelector('select[data-field="classification"]')?.value || '').trim();
      if (isPrimary) {
        const kubunConfirmed = String(tr.dataset.kubunConfirmed || '') === '1' ? 1 : 0;
        const locEl = tr.querySelector('input[data-field="location"]');
        const reasonEl = tr.querySelector('select[data-field="reason"]');
        const memoEl = tr.querySelector('input[data-field="memo"]');
        const loc = locEl && locEl.value != null ? locEl.value : '';
        const reason = reasonEl && reasonEl.value != null ? reasonEl.value : '';
        const memo = memoEl && memoEl.value != null ? memoEl.value : '';
        const br = String(tr.querySelector('select[data-field="break"]')?.value || '1:00');
        const nb = String(tr.querySelector('select[data-field="nightBreak"]')?.value || '0:00');
        const breakMinutes = br === '0:45' ? 45 : br === '0:30' ? 30 : br === '0:00' ? 0 : 60;
        const nightBreakMinutes = nb === '1:00' ? 60 : nb === '0:30' ? 30 : 0;
        const base = {
          kubun: String(tr.dataset.kubunBase || '').trim(),
          workType: String(tr.dataset.workTypeBase || '').trim(),
          location: String(tr.dataset.locationBase || ''),
          reason: String(tr.dataset.reasonBase || ''),
          memo: String(tr.dataset.memoBase || ''),
          breakVal: String(tr.dataset.breakBase || '1:00'),
          nightBreakVal: String(tr.dataset.nightBreakBase || '0:00'),
          kubunConfirmed: String(tr.dataset.kubunConfirmed || '') === '1' ? 1 : 0
        };
        const wtNorm = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : '';
        const changed =
          kubunVal !== base.kubun ||
          (kubunConfirmed === 1 && base.kubunConfirmed !== 1) ||
          wtNorm !== base.workType ||
          String(loc || '') !== base.location ||
          String(reason || '') !== base.reason ||
          String(memo || '') !== base.memo ||
          br !== base.breakVal ||
          nb !== base.nightBreakVal;
        const hasMeaningfulDaily =
          !!kubunVal ||
          kubunConfirmed === 1 ||
          !!wtNorm ||
          !!String(loc || '').trim() ||
          !!String(reason || '').trim() ||
          !!String(memo || '').trim() ||
          !!base.kubun ||
          base.kubunConfirmed === 1 ||
          !!base.workType ||
          !!String(base.location || '').trim() ||
          !!String(base.reason || '').trim() ||
          !!String(base.memo || '').trim() ||
          br !== '1:00' ||
          nb !== '0:00' ||
          base.breakVal !== '1:00' ||
          base.nightBreakVal !== '0:00';
        if (changed || (includeAll && hasMeaningfulDaily)) {
          const shiftStart = String(tr.dataset.shiftStart || '08:00').trim();
          const checkInRaw = String(tr.querySelector('input[data-field="checkIn"]')?.value || '').trim();
          dailyUpdates.push({
            date: String(dateStr).slice(0, 10),
            kubun: kubunVal,
            kubunConfirmed,
            workType: wtNorm || null,
            location: String(loc || '').trim(),
            reason: String(reason || '').trim(),
            memo: String(memo || '').trim(),
            breakMinutes,
            nightBreakMinutes,
            shiftStart,
            checkInTime: checkInRaw || null
          });
        }
      }
      const inEl = tr.querySelector('input[data-field="checkIn"]');
      const outEl = tr.querySelector('input[data-field="checkOut"]');
      
      const baseOff = String(tr.dataset.baseOff || '0') === '1';
      const plannedKubun = baseOff ? '休日' : '出勤';
      const effectiveKubun = kubunVal || plannedKubun;
      
      const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      // IMPORTANT: classify by effective kubun (fallback to planned default),
      // otherwise planned workdays with empty kubun can be skipped from updates.
      const isWorkKubun = workKubunSet.has(effectiveKubun);
      const effTime = (el, acceptAuto) => {
        const v = String(el?.value || '');
        if (acceptAuto) return v;
        const isAuto = String(el?.dataset?.auto || '') === '1';
        const autoVal = String(el?.dataset?.autoVal || '');
        if (isAuto && autoVal && v === autoVal) return '';
        return v;
      };
      // Never persist planned auto-filled times as real attendance.
      // Only user-entered/manual values should become checkIn/checkOut.
      const inEff = effTime(inEl, false);
      const outEff = effTime(outEl, false);
      const hasManual = !!(inEff || outEff);
      const inT = (isWorkKubun || hasManual) ? inEff : '';
      const outT = (isWorkKubun || hasManual) ? outEff : '';
      const checkIn = toDateTime(dateStr, inT);
      const checkOut = (() => {
        const outDt = toDateTime(dateStr, outT);
        if (!outDt) return null;
        const a = parseHm(inT);
        const b = parseHm(outT);
        if (a != null && b != null && b < a) {
          return toDateTime(addDaysISO(dateStr, 1), outT);
        }
        return outDt;
      })();
      if (isPrimary) {
        const last = dailyUpdates[dailyUpdates.length - 1];
        if (last && String(last.date || '').slice(0, 10) === String(dateStr).slice(0, 10)) {
          if (!String(last.kubun || '').trim() && hasManual) {
            last.kubun = baseOff ? '休日出勤' : '出勤';
          }
        }
      }
      const workType = wt === 'onsite' || wt === 'remote' || wt === 'satellite' ? wt : null;
      if (idRaw) {
        if (clearFlag || (!checkIn && !checkOut)) {
          updates.push({ id: parseInt(idRaw, 10), delete: true });
        } else if (checkIn) {
          updates.push({ id: parseInt(idRaw, 10), checkIn, checkOut, workType });
        }
      } else if (checkIn) {
        updates.push({ clientId, checkIn, checkOut, workType });
      } else if (includeAll && clearFlag) {
        updates.push({ clientId, delete: true });
      }
    }
    return { year: y, month: m, userId: userId || undefined, updates, dailyUpdates };
  };

  const mod = { loadMonth, collectUpdates };
  root.Api = mod;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlyApi = mod;
})();
