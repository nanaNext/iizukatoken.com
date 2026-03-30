import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

export async function mount() {
  const p = normalizePath(window.location.pathname);
  if (p === '/admin/payroll/payslips') {
    try { window.location.href = '/admin/payroll/salary?tab=payroll_editor'; } catch {}
    return;
  }
  await bootLegacyTab({ tab: 'payroll_editor', hash: '' });
}
