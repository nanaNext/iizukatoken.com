export async function bootLegacyTab({ tab, hash }) {
  try {
    const url = new URL(window.location.href);
    if (tab) url.searchParams.set('tab', tab);
    else url.searchParams.delete('tab');
    url.hash = hash || '';
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch {}

  if (tab === 'payroll_editor') {
    let v = '';
    try {
      const meta = document.querySelector('meta[name="asset-v"]');
      v = meta ? (meta.getAttribute('content') || '') : '';
      if (!v) v = window.__assetV ? String(window.__assetV) : '';
    } catch {}
    const spec = v ? `../payroll/editor.page.js?v=${encodeURIComponent(v)}` : '../payroll/editor.page.js';
    const mod = await import(spec);
    await mod.mount();
    return;
  }

  let p = '../../pages/admin.page.js?v=navy-20260421-authfix1';
  try {
    let v = '';
    try {
      const meta = document.querySelector('meta[name="asset-v"]');
      v = meta ? (meta.getAttribute('content') || '') : '';
    } catch {}
    if (!v) {
      try { v = window.__assetV ? String(window.__assetV) : ''; } catch {}
    }
    if (v && p.indexOf('v=') < 0) p = p + '?v=' + encodeURIComponent(String(v));
  } catch {}
  await import(p);
  try {
    // Notify legacy page to refresh tab without forcing modern admin router loop.
    window.__legacyTabPopstate = '1';
    window.dispatchEvent(new Event('popstate'));
  } catch {}
}
