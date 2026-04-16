import { requireAdmin } from '../_shared/require-admin.js';

export async function bootLegacyTab({ tab, hash }) {
  const profile = await requireAdmin();
  if (!profile) return;

  try {
    const userName = document.querySelector('#userName');
    if (userName) userName.textContent = profile.username || profile.email || '管理者';
  } catch {}
  try {
    const status = document.querySelector('#status');
    if (status) status.textContent = '';
  } catch {}

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

  let p = '../../pages/admin.page.js';
  try {
    let v = '';
    try {
      const meta = document.querySelector('meta[name="asset-v"]');
      v = meta ? (meta.getAttribute('content') || '') : '';
    } catch {}
    if (!v) {
      try { v = window.__assetV ? String(window.__assetV) : ''; } catch {}
    }
    if (v) p = p + '?v=' + encodeURIComponent(String(v));
  } catch {}
  await import(p);
  try {
    if (document.readyState !== 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  } catch {}
}
