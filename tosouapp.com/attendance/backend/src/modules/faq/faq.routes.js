const express = require('express');
const router = express.Router();
const ctrl = require('./faq.controller');
const { authenticate } = require('../../core/middleware/authMiddleware');

// Public routes (no auth required)
router.get('/', ctrl.listFaqItems);
router.get('/categories', ctrl.getFaqCategories);

// Employee routes
router.post('/questions', authenticate, ctrl.validateCreateQuestion, ctrl.createQuestion);
router.get('/questions/my', authenticate, ctrl.getMyQuestions);

// Admin routes
router.get('/admin/questions', authenticate, ctrl.getAllQuestions);
router.post('/admin/questions/:questionId/answer', authenticate, ctrl.validateAdminAnswer, ctrl.answerQuestion);

// DEBUG: Check all questions (remove in production)
router.get('/debug/all-questions', async (req, res) => {
  try {
    const db = require('../../core/database/mysql');
    const [rows] = await db.query('SELECT id, user_id, question, status, created_at FROM faq_user_questions ORDER BY created_at DESC LIMIT 20');
    res.json({ count: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
