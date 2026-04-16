(function () {
  const root = globalThis.AttendanceMonthly || {};
  const events = root.Events || null;

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      try {
        const top = document.querySelector('.kintai-top');
        const h = top ? Math.max(0, top.offsetHeight) : 48;
        document.body.style.setProperty('--kintai-top-height', `${h}px`);
        const tb = document.querySelector('.se-toolbar');
        const th = tb ? Math.max(0, tb.offsetHeight) : 56;
        document.body.style.setProperty('--se-toolbar-height', `${th}px`);
        window.addEventListener('resize', () => {
          const t = document.querySelector('.kintai-top');
          const hh = t ? Math.max(0, t.offsetHeight) : 48;
          document.body.style.setProperty('--kintai-top-height', `${hh}px`);
          const tb2 = document.querySelector('.se-toolbar');
          const th2 = tb2 ? Math.max(0, tb2.offsetHeight) : 56;
          document.body.style.setProperty('--se-toolbar-height', `${th2}px`);
        }, { passive: true });
      } catch {}
      if (events && typeof events.boot === 'function') await events.boot();
    } catch (e) {
      try { root.Core?.showErr?.(String(e?.message || '')); } catch {}
    }
  });
})();
