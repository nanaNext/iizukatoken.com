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

  await import('../../pages/admin.page.js');
  try {
    if (document.readyState !== 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }
  } catch {}
}
