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

module.exports = function(app) {
  console.log('Mounting API routes...');
  app.get('/', (req, res) => {
    res.status(200).send('Attendance API đang chạy. Xem tài liệu tại /api-docs');
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
  console.log('Registering routers: auth, attendance, leave, adjust, manager, admin, me, users, salary, payslips');
  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leave', leaveRoutes);
  app.use('/api/adjust', adjustRoutes);
  app.use('/api/manager', managerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/salary', salaryRoutes);
  app.use('/api/payslips', payslipRoutes);
  app.use('/api/employee', employeeRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  app.get('/api/debug/routes', (req, res) => {
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
  app.post('/api/debug/routes', (req, res) => {
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
};
