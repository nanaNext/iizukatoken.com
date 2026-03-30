(function () {
  const root = globalThis.AttendanceMonthly || {};
  const events = root.Events || null;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      if (events && typeof events.boot === 'function') await events.boot();
    } catch (e) {
      try { root.Core?.showErr?.(String(e?.message || '')); } catch {}
    }
  });
})();
