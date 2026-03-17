import { bootLegacyTab } from '../legacy/legacy-tab.page.js';

const normalizePath = (p) => {
  const s = String(p || '');
  return s.length > 1 ? s.replace(/\/+$/, '') : s;
};

const p = normalizePath(window.location.pathname);
let tab = 'attendance';
let hash = '';

if (p === '/admin/attendance/shifts' || p === '/admin/attendance/shift-assignment') tab = 'shifts';
if (p === '/admin/attendance/adjust-requests') tab = 'approvals';
if (p === '/admin/attendance/holidays') tab = 'calendar';

bootLegacyTab({ tab, hash });
