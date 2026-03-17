import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

const p = normalizePath(window.location.pathname);
let tab = 'salary_list';
let hash = '';

if (p === '/admin/payroll/payslips') tab = 'salary_send';
if (p === '/admin/payroll/salary') tab = 'salary_list';

bootLegacyTab({ tab, hash });
