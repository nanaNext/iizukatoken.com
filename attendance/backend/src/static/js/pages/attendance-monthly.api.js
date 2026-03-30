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
    const bust = `&_=${Date.now()}`;
    const detailP = fetchJSONAuth(`/api/attendance/month/detail?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}${bust}`);
    const sumP = fetchJSONAuth(`/api/attendance/month?year=${encodeURIComponent(y)}&month=${encodeURIComponent(m)}${uidQ}${bust}`).catch(() => null);
    const [detail, timesheet] = await Promise.all([detailP, sumP]);
    return { detail, timesheet };
  };

  const collectUpdates = (root, ym, userId) => {
    const [y, m] = String(ym).split('-').map(x => parseInt(x, 10));
    const rows = Array.from(root.querySelectorAll('[data-row="1"][data-date]'));
    const updates = [];
    const dailyUpdates = [];
    for (const tr of rows) {
      if (String(tr.dataset.dirty || '') !== '1') continue;
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
        if (changed) {
          dailyUpdates.push({
            date: String(dateStr).slice(0, 10),
            kubun: kubunVal,
            kubunConfirmed,
            workType: wtNorm || null,
            location: String(loc || '').trim(),
            reason: String(reason || '').trim(),
            memo: String(memo || '').trim(),
            breakMinutes,
            nightBreakMinutes
          });
        }
      }
      const inEl = tr.querySelector('input[data-field="checkIn"]');
      const outEl = tr.querySelector('input[data-field="checkOut"]');
      
      const baseOff = String(tr.dataset.baseOff || '0') === '1';
      const plannedKubun = baseOff ? '休日' : '出勤';
      const effectiveKubun = kubunVal || plannedKubun;
      
      const workKubunSet = new Set(['出勤', '半休', '休日出勤', '代替出勤']);
      const isWorkKubun = workKubunSet.has(kubunVal);
      const effTime = (el, acceptAuto) => {
        const v = String(el?.value || '');
        if (acceptAuto) return v;
        const isAuto = String(el?.dataset?.auto || '') === '1';
        const autoVal = String(el?.dataset?.autoVal || '');
        if (isAuto && autoVal && v === autoVal) return '';
        return v;
      };
      const inEff = effTime(inEl, isWorkKubun);
      const outEff = effTime(outEl, isWorkKubun);
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
        if (clearFlag) {
          updates.push({ id: parseInt(idRaw, 10), delete: true });
        } else {
          updates.push({ id: parseInt(idRaw, 10), checkIn, checkOut, workType });
        }
      } else if (checkIn || checkOut) {
        updates.push({ clientId, checkIn, checkOut, workType });
      }
    }
    return { year: y, month: m, userId: userId || undefined, updates, dailyUpdates };
  };

  const mod = { loadMonth, collectUpdates };
  root.Api = mod;
  globalThis.AttendanceMonthly = root;
  globalThis.MonthlyMonthlyApi = mod;
})();
