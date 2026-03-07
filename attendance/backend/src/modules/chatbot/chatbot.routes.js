const express = require('express');
const router = express.Router();
const repo = require('./chatbot.repository');
const { authenticate, authorize } = require('../../core/middleware/authMiddleware');
const { body, query } = require('express-validator');

router.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});

router.get('/categories', async (req, res) => {
  try {
    await repo.init();
    await repo.ensureSeedCategories();
    await repo.ensureSeedFaqs();
    const rows = await repo.getCategories();
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const categoryId = parseInt(String(req.query.categoryId || ''), 10);
    if (!categoryId) return res.status(400).json({ message: 'Missing categoryId' });
    const rows = await repo.listQuestions(categoryId);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/answer/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const row = await repo.getAnswerById(id);
    if (!row) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/search', async (req, res) => {
  try {
    const text = String((req.body?.text ?? req.query?.text) || '').trim();
    if (!text) return res.status(400).json({ message: 'Missing text' });
    const rows = await repo.search(text);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/question', async (req, res) => {
  try {
    const categoryId = req.body?.categoryId ? parseInt(String(req.body.categoryId), 10) : null;
    const question = String((req.body?.question ?? req.query?.question) || '').trim();
    if (!question) return res.status(400).json({ message: 'Missing question' });
    const userId = req.user?.id || null;
    const r = await repo.submitQuestion(userId, categoryId, question);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/faq', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const categoryId = parseInt(String(req.body?.categoryId), 10);
    const question = String(req.body?.question || '').trim();
    const answer = String(req.body?.answer || '').trim();
    const popularity = req.body?.popularity ? parseInt(String(req.body.popularity), 10) : 0;
    const status = String(req.body?.status || 'active');
    if (!categoryId || !question || !answer) return res.status(400).json({ message: 'Missing categoryId/question/answer' });
    const r = await repo.adminCreateFaq(req.user.id, categoryId, question, answer, popularity, status);
    res.status(201).json(r);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/faq/:id', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    const data = {
      categoryId: req.body?.categoryId,
      question: req.body?.question,
      answer: req.body?.answer,
      popularity: req.body?.popularity,
      status: req.body?.status
    };
    await repo.adminUpdateFaq(req.user.id, id, data);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/faq/:id', authenticate, authorize('manager','admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    await repo.adminDeleteFaq(id);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
