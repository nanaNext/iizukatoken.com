import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

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
