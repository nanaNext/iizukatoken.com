import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

export async function mount() {
  const p = normalizePath(window.location.pathname);
  let tab = 'settings';
  let hash = '';
  if (p === '/admin/system/audit-logs') tab = 'audit';
  if (p === '/admin/system/settings') tab = 'settings';
  await bootLegacyTab({ tab, hash });
}
