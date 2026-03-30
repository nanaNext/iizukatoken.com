function stableStringify(v) {
  const seen = new Set();
  const norm = (x) => {
    if (x == null) return null;
    if (typeof x !== 'object') return x;
    if (seen.has(x)) return null;
    seen.add(x);
    if (Array.isArray(x)) return x.map(norm);
    const keys = Object.keys(x).sort();
    const o = {};
    for (const k of keys) o[k] = norm(x[k]);
    return o;
  };
  return JSON.stringify(norm(v));
}

export function createRealtimeController({ getKey, buildPayload, computeEmp, setKpi, updatePreview, clearPdfStateIfKeyChanged }) {
  let _deb = null;
  let _lastPayloadKey = null;
  let _lastRealtimeAt = 0;
  let _lastKey = '';
  let _reqId = 0;

  const scheduleRealtime = () => {
    const k = getKey();
    if (!k.userId || !/^\d{4}-\d{2}$/.test(k.month)) return;
    const key = `${k.userId}|${k.month}`;
    if (_lastKey !== key) {
      _lastKey = key;
      _lastPayloadKey = null;
      _lastRealtimeAt = 0;
    }
    clearPdfStateIfKeyChanged();
    if (_deb) clearTimeout(_deb);
    _deb = setTimeout(async () => {
      const rid = ++_reqId;
      try {
        const k2 = getKey();
        if (`${k2.userId}|${k2.month}` !== key) return;
        const payload = await buildPayload();
        const now = Date.now();
        const payloadKey = stableStringify(payload);
        if (_lastPayloadKey === payloadKey && (now - _lastRealtimeAt) < 1200) return;
        _lastPayloadKey = payloadKey;
        _lastRealtimeAt = now;
        const emp = await computeEmp({ userId: k2.userId, month: k2.month, payload });
        if (rid !== _reqId) return;
        const totals = (emp && emp['合計'] && typeof emp['合計'] === 'object') ? emp['合計'] : {};
        const pay = (emp && emp['支払'] && typeof emp['支払'] === 'object') ? emp['支払'] : {};
        const net = Number(totals['差引支給額'] || 0);
        const sum = Number(pay['振込支給額'] || 0) + Number(pay['現金支給額'] || 0) + Number(pay['現物支給額'] || 0);
        const hint = Math.round(sum) !== Math.round(net) ? `支払内訳が一致しません（${Math.round(sum)} != ${Math.round(net)}）` : '';
        setKpi({ gross: totals['総支給額'], deduct: totals['総控除額'], net, paySum: sum, hint });
        updatePreview(emp);
      } catch {}
    }, 350);
  };

  return { scheduleRealtime };
}
