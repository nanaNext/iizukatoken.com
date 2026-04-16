const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const salaryService = require('./salary.service');
const payslipRepo = require('../payslip/payslip.repository');
const salaryInputRepo = require('./salaryInput.repository');
const payslipDeliveryRepo = require('./payslipDelivery.repository');
const { companyName } = require('../../config/env');

router.get('/my', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ message: 'Missing month' });
    
    // Check if published
    const input = await salaryInputRepo.getByUserMonth(req.user.id, month);
    if (!input || !input.is_published) {
      // Return 200 with a specific format so the frontend can display a friendly message
      // without triggering global HTTP error handlers
      return res.status(200).json({ notPublished: true, message: '給与明細はまだ公開されていません' });
    }

    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const issueDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    const { employees } = await salaryService.computePayslips([req.user.id], month);
    res.status(200).json({ companyName, issueDate, month, employees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my/published', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const deliveries = await payslipDeliveryRepo.list({ userId: req.user.id, month: null, limit: 500 });
    const latestByMonth = new Map();
    for (const row of deliveries) {
      const m = String(row?.month || '');
      if (!m) continue;
      if (!latestByMonth.has(m)) latestByMonth.set(m, row);
    }
    const months = Array.from(latestByMonth.keys()).sort().reverse();
    const items = months.map(m => {
      const r = latestByMonth.get(m);
      return {
        month: m,
        publishedAt: r?.sent_at || null,
        publishedBy: r?.sent_by || null,
        hasPdf: true,
        fileName: r?.original_name || null
      };
    });
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my/:year/:month', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const y = req.params.year;
    const m = req.params.month;
    const month = `${y}-${String(m).padStart(2,'0')}`;

    // Check if published
    const input = await salaryInputRepo.getByUserMonth(req.user.id, month);
    if (!input || !input.is_published) {
      return res.status(200).json({ notPublished: true, message: '給与明細はまだ公開されていません' });
    }

    const { employees } = await salaryService.computePayslips([req.user.id], month);
    res.status(200).json(employees[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/me/:year/:month/download', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const y = req.params.year;
    const m = req.params.month;
    const month = `${y}-${String(m).padStart(2,'0')}`;

    // Check if published
    const input = await salaryInputRepo.getByUserMonth(req.user.id, month);
    if (!input || !input.is_published) {
      return res.status(200).json({ notPublished: true, message: '給与明細はまだ公開されていません' });
    }

    const row = await payslipRepo.findLatestByUserMonth(req.user.id, month);
    if (!row) return res.status(404).json({ message: 'PDFが見つかりません' });
    res.status(200).json({ secureUrl: `/api/payslips/me/file/${row.id}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
