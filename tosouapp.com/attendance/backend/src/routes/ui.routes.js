const express = require('express');
const fs = require('fs');
const path = require('path');
const { makeHtmlSenderSync } = require('../core/middleware/htmlIncludes');
const { authenticateFromCookie } = require('../core/middleware/authMiddleware');
const refreshRepo = require('../modules/auth/refresh.repository');

const router = express.Router();
const htmlRoot = path.join(__dirname, '..', 'static', 'html');
const sendHtml = makeHtmlSenderSync({ htmlRoot });

const sendPage = (file) => (req, res) => sendHtml(req, res, file);
const sendAdminPageNoCache = (req, res, file = 'admin.html') => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  } catch {}
  return sendHtml(req, res, file);
};
const authorizePage = (...roles) => (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (!req.user) {
    return res.redirect(302, '/ui/login');
  }
  if (!roles.includes(role)) {
    // Avoid blank "Forbidden" screen on UI routes; send user back to a valid page.
    if (role === 'employee') return res.redirect(302, '/ui/portal');
    return res.redirect(302, '/ui/login');
  }
  next();
};

router.get('/ui/login', sendPage('login.html'));
router.get('/login', sendPage('login.html'));
router.get('/login.html', sendPage('login.html'));
router.get('/ui/forgot-password', sendPage('forgot-password.html'));
router.get('/forgot-password', sendPage('forgot-password.html'));
router.get('/ui/reset-password', sendPage('reset-password.html'));
router.get('/reset-password', sendPage('reset-password.html'));
// Public standalone login for Expenses
router.get('/ui/expenses-login', sendPage('expenses-login.html'));
router.get('/expenses-login', sendPage('expenses-login.html'));

// Make expenses page accessible and let FE handle auth redirect to /expenses-login
router.get('/ui/expenses', sendPage('expenses.html'));
router.get('/ui/expenses/', sendPage('expenses.html'));
// Serve simple attendance page immediately to improve first paint on mobile.
// Authentication is still enforced by API calls and client-side auth guard.
router.get('/ui/attendance/simple', sendPage('attendance-simple.html'));
router.get('/ui/attendance/simple/', sendPage('attendance-simple.html'));

router.get('/ui/logout', async (req, res) => {
  try {
    const cookieRt = req.cookies?.refreshToken;
    const refreshToken = cookieRt || null;
    if (refreshToken) {
      try { await refreshRepo.revokeToken(refreshToken); } catch {}
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.clearCookie('csrfToken', { path: '/' });
    res.clearCookie('session_token', { path: '/' });
  } catch {}
  const next = String(req.query?.next || '').trim();
  if (next) return res.redirect(302, next);
  return res.redirect(302, '/ui/login');
});

router.get('/ui-check', (req, res) => {
  const file = path.join(htmlRoot, 'login.html');
  res.status(200).json({ exists: fs.existsSync(file), file });
});

router.use('/ui/admin', authenticateFromCookie, authorizePage('admin', 'manager'));
router.use('/ui/employees', authenticateFromCookie, authorizePage('admin', 'manager'));
router.use('/admin', authenticateFromCookie, authorizePage('admin', 'manager'));
router.use('/ui', authenticateFromCookie);

router.get('/ui/dashboard', sendPage('dashboard.html'));
router.get('/ui/portal', sendPage('portal.html'));
router.get('/ui/portal/', sendPage('portal.html'));

router.get('/admin/embed/attendance/monthly', sendPage('attendance-monthly.html'));
router.get('/admin/embed/attendance/monthly/', sendPage('attendance-monthly.html'));

router.get('/ui/attendance', sendPage('attendance.html'));
router.get('/ui/attendance/monthly', sendPage('attendance-monthly.html'));
router.get('/ui/attendance/monthly/', sendPage('attendance-monthly.html'));

router.get('/ui/admin', (req, res) => {
  const tab = String(req.query?.tab || '').trim();
  if (!tab) return res.redirect(302, '/admin/dashboard');
  if (tab === 'employees') return res.redirect(302, '/admin/employees');
  if (tab === 'attendance') return res.redirect(302, '/admin/attendance');
  if (tab === 'shifts') return res.redirect(302, '/admin/attendance/shifts');
  if (tab === 'calendar') return res.redirect(302, '/admin/attendance/holidays');
  if (tab === 'leave_grant') return res.redirect(302, '/admin/leave/grants');
  if (tab === 'leave_balance') return res.redirect(302, '/admin/leave/balance');
  if (tab === 'approvals') return res.redirect(302, '/admin/leave/requests');
  if (tab === 'salary_list') return res.redirect(302, '/admin/payroll/salary');
  if (tab === 'salary_send') return res.redirect(302, '/admin/payroll/payslips');
  if (tab === 'departments') return res.redirect(302, '/admin/departments');
  if (tab === 'audit') return res.redirect(302, '/admin/system/audit-logs');
  if (tab === 'settings') return res.redirect(302, '/admin/system/settings');
  return res.redirect(302, '/admin/dashboard');
});
router.get('/ui/employees', (req, res) => sendAdminPageNoCache(req, res, 'admin.html'));
router.get('/ui/employees/', (req, res) => sendAdminPageNoCache(req, res, 'admin.html'));

router.get('/admin/attendance/monthly', (req, res) => sendAdminPageNoCache(req, res, 'admin-attendance-monthly.html'));
router.get('/admin/attendance/monthly/', (req, res) => sendAdminPageNoCache(req, res, 'admin-attendance-monthly.html'));
router.get('/admin/employees/monthly-summary', (req, res) => sendAdminPageNoCache(req, res, 'admin-employees-monthly-summary.html'));
router.get('/admin/employees/monthly-summary/', (req, res) => sendAdminPageNoCache(req, res, 'admin-employees-monthly-summary.html'));
router.get('/admin/attendance/adjust-requests', (req, res) => sendAdminPageNoCache(req, res, 'admin-attendance-adjust-requests.html'));
router.get('/admin/attendance/adjust-requests/', (req, res) => sendAdminPageNoCache(req, res, 'admin-attendance-adjust-requests.html'));
router.get(/^\/admin(?:\/.*)?$/, (req, res) => sendAdminPageNoCache(req, res, 'admin.html'));

router.get('/ui/overtime', sendPage('overtime.html'));
router.get('/ui/leave', (req, res) => {
  return res.redirect(302, '/ui/requests');
});
router.get('/ui/leave-ledger', sendPage('leave-ledger.html'));
router.get('/ui/requests', sendPage('requests.html'));
router.get('/ui/salary', sendPage('salary.html'));
router.get('/ui/chatbot', sendPage('chatbot.html'));
router.get('/ui/change-password', sendPage('change-password.html'));
// React SPA entry (built by Vite to /static/react-app)
router.get('/ui/app', (req, res) => {
  const p = path.join(__dirname, '..', 'static', 'react-app', 'index.html');
  return res.sendFile(p);
});

router.get('/ui/:page.html', (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  if (!page) return res.status(404).json({ message: 'Not Found', path: req.path });
  if (page === 'employees') return sendHtml(req, res, 'admin.html');
  return sendHtml(req, res, `${page}.html`);
});

router.get('/ui/:page', (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  if (page === 'employees') {
    return sendHtml(req, res, 'admin.html');
  }
  return sendHtml(req, res, `${page}.html`);
});

router.get('/:page.html', (req, res) => {
  const page = String(req.params.page || '').replace(/[^a-z0-9_-]/gi, '');
  if (!page) return res.status(404).json({ message: 'Not Found', path: req.path });
  return sendHtml(req, res, `${page}.html`);
});

module.exports = router;
