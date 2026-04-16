const withAssetV = (path) => {
  try {
    const p = String(path || '');
    if (!p) return p;
    let v = '';
    try {
      const meta = document.querySelector('meta[name="asset-v"]');
      v = meta ? (meta.getAttribute('content') || '') : '';
      if (!v) v = window.__assetV ? String(window.__assetV) : '';
    } catch {}
    if (!v) return p;
    return p + (p.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v);
  } catch {
    return path;
  }
};

async function bootLegacyTab(opts) {
  const mod = await import(withAssetV('../legacy/legacy-tab.page.js'));
  return mod.bootLegacyTab(opts);
}

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

export async function mount() {
  const p = normalizePath(window.location.pathname);
  if (p === '/admin/payroll/payslips') {
    await bootLegacyTab({ tab: 'salary_send', hash: '' });
    return;
  }
  if (p === '/admin/payroll/salary') {
    await bootLegacyTab({ tab: 'payroll_editor', hash: '' });
    return;
  }
  await bootLegacyTab({ tab: 'payroll_editor', hash: '' });
}
