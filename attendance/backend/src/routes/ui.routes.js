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
const authorizePage = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(String(req.user.role || '').toLowerCase())) {
    return res.status(403).send('Forbidden');
  }
  next();
};

router.get('/ui/login', sendPage('login.html'));
router.get('/login', sendPage('login.html'));
router.get('/login.html', sendPage('login.html'));

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

router.get('/ui/attendance', sendPage('attendance.html'));
router.get('/ui/attendance/monthly', sendPage('attendance-monthly.html'));
router.get('/ui/attendance/monthly/', sendPage('attendance-monthly.html'));
router.get('/ui/attendance/simple', sendPage('attendance-simple.html'));
router.get('/ui/attendance/simple/', sendPage('attendance-simple.html'));

router.get('/ui/admin', sendPage('admin.html'));
router.get('/ui/employees', sendPage('admin.html'));
router.get('/ui/employees/', sendPage('admin.html'));

router.get('/admin/attendance/monthly', sendPage('admin-attendance-monthly.html'));
router.get('/admin/attendance/monthly/', sendPage('admin-attendance-monthly.html'));
router.get(/^\/admin(?:\/.*)?$/, sendPage('admin.html'));

router.get('/ui/overtime', sendPage('overtime.html'));
router.get('/ui/leave', sendPage('leave.html'));
router.get('/ui/salary', sendPage('salary.html'));
router.get('/ui/chatbot', sendPage('chatbot.html'));

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
