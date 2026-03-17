import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

const p = normalizePath(window.location.pathname);
let tab = 'approvals';
let hash = '';

if (p === '/admin/leave/balance') tab = 'leave_balance';
if (p === '/admin/leave/grants') tab = 'leave_grant';
if (p === '/admin/leave/requests') tab = 'approvals';

bootLegacyTab({ tab, hash });
