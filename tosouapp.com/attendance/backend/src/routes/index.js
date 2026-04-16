const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const attendanceRoutes = require('../modules/attendance/attendance.routes');
const leaveRoutes = require('../modules/leave/leave.routes');
const adjustRoutes = require('../modules/adjust/adjust.routes');
const managerRoutes = require('../modules/manager/manager.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const meRoutes = require('../modules/me/me.routes');
const userRoutes = require('../modules/users/user.routes');
const salaryRoutes = require('../modules/salary/salary.routes');
const db = require('../core/database/mysql');
const payslipRoutes = require('../modules/payslip/payslip.routes');
const { authenticate, authorize } = require('../core/middleware/authMiddleware');
const employeeRoutes = require('../modules/employee/employee.routes');
const chatbotRoutes = require('../modules/chatbot/chatbot.routes');
const workReportsRoutes = require('../modules/workReports/workReports.routes');
const workReportsAdminRoutes = require('../modules/workReports/workReports.admin.routes');
const noticesRoutes = require('../modules/notices/notices.routes');
const expensesRoutes = require('../modules/expenses/expenses.routes');
const webauthnRoutes = require('../modules/webauthn/webauthn.routes');
const requestsRoutes = require('../modules/requests/requests.routes');

const BUILD_ID = process.env.BUILD_ID || 'navy-20260331-1';
const STARTED_AT = Date.now();
const allowDebugRoutes = process.env.NODE_ENV !== 'production' || String(process.env.ENABLE_DEBUG_ROUTES || '').toLowerCase() === 'true';

module.exports = function(app) {
  console.log('Mounting API routes...');
  app.get('/', (req, res) => {
    return res.redirect(302, '/ui/login');
  });
  app.get('/health', async (req, res) => {
    try {
      const conn = await db.getConnection();
      await conn.ping();
      conn.release();
      res.json({ status: 'ok' });
    } catch (e) {
      res.status(500).json({ status: 'error', message: e.message });
    }
  });
  app.get('/health/ready', async (req, res) => {
    try {
      const missing = [];
      const [cols] = await db.query(`
        SELECT table_name AS t, column_name AS c
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND (
            (table_name = 'users' AND column_name IN ('token_version'))
            OR (table_name = 'departments' AND column_name IN ('code'))
          )
      `);
      const set = new Set((cols || []).map(r => `${String(r.t)}.${String(r.c)}`));
      if (!set.has('users.token_version')) missing.push('users.token_version');
      if (!set.has('departments.code')) missing.push('departments.code');
      if (missing.length) {
        return res.status(500).json({ status: 'error', ready: false, missing });
      }
      res.status(200).json({ status: 'ok', ready: true });
    } catch (e) {
      res.status(500).json({ status: 'error', ready: false, message: e.message });
    }
  });
  console.log('Registering routers: auth, attendance, leave, adjust, manager, admin, me, users, salary, payslips');
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  try {
    const attendanceController = require('../modules/attendance/attendance.controller');
    app.get('/api/attendance/month/export.xlsx', authenticate, authorize('employee','manager','admin','payroll'), attendanceController.exportMonthXlsx);
  } catch {}
  app.use('/api/leave', leaveRoutes);
  console.log('🔧 About to mount /api/adjust routes');
  app.use('/api/adjust', adjustRoutes);
  console.log('✅ /api/adjust routes mounted successfully');
  app.use('/api/manager', managerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/salary', salaryRoutes);
  app.use('/api/payslips', payslipRoutes);
  app.use('/api/employee', employeeRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  app.use('/api/work-reports', workReportsRoutes);
  app.use('/api/admin/work-reports', workReportsAdminRoutes);
  app.use('/api/notices', noticesRoutes);
  app.use('/api/expenses', expensesRoutes);
  const stationsRoutes = require('../modules/stations/stations.routes');
  app.use('/api/stations', stationsRoutes);
  app.use('/api/webauthn', webauthnRoutes);
  app.use('/api/requests', requestsRoutes);
  if (allowDebugRoutes) {
    app.get('/api/debug/version', authenticate, authorize('employee','manager','admin','payroll'), (req, res) => {
      res.status(200).json({ buildId: BUILD_ID, startedAt: STARTED_AT, pid: process.pid });
    });
    app.get('/api/debug/routes', authenticate, authorize('admin'), (req, res) => {
      try {
        const stack = (app._router?.stack || []);
        const list = [];
        for (const layer of stack) {
          if (layer.route) {
            list.push({
              path: layer.route.path,
              methods: Object.keys(layer.route.methods || {})
            });
          } else if (layer?.name === 'router' && layer?.handle?.stack) {
            const base = layer?.regexp?.fast_star ? '' : (layer?.regexp?.source || '').replace('^\\', '').replace('\\/?(?=\\/|$)', '');
            for (const l2 of layer.handle.stack) {
              if (l2.route) {
                list.push({
                  path: (base || '') + l2.route.path,
                  methods: Object.keys(l2.route.methods || {})
                });
              }
            }
          }
        }
        res.status(200).json({ routes: list });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
    app.post('/api/debug/routes', authenticate, authorize('admin'), (req, res) => {
      try {
        const stack = (app._router?.stack || []);
        const list = [];
        for (const layer of stack) {
          if (layer.route) {
            list.push({
              path: layer.route.path,
              methods: Object.keys(layer.route.methods || {})
            });
          } else if (layer?.name === 'router' && layer?.handle?.stack) {
            const base = layer?.regexp?.fast_star ? '' : (layer?.regexp?.source || '').replace('^\\', '').replace('\\/?(?=\\/|$)', '');
            for (const l2 of layer.handle.stack) {
              if (l2.route) {
                list.push({
                  path: (base || '') + l2.route.path,
                  methods: Object.keys(l2.route.methods || {})
                });
              }
            }
          }
        }
        res.status(200).json({ routes: list });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });
  }
};
