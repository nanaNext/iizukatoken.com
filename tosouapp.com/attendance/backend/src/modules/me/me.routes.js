const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const salaryService = require('../salary/salary.service');
const { companyName } = require('../../config/env');

router.get('/salary', authenticate, authorize('employee','manager','admin'), async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) {
      return res.status(400).json({ message: 'Missing month' });
    }
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const issueDate = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    const { employees } = await salaryService.computePayslips([req.user.id], month);
    res.status(200).json({
      companyName,
      issueDate,
      month,
      employees
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
