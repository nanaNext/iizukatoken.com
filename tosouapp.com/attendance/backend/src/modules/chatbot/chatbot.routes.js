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
    // Add 5-second timeout to prevent hanging on DB initialization
    const initPromise = (async () => {
      await repo.init();
      await repo.ensureSeedCategories();
      await repo.ensureSeedFaqs();
    })();
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB initialization timeout')), 5000)
    );
    
    await Promise.race([initPromise, timeoutPromise]);
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
    
    // Add 3-second timeout for question loading
    const questionsPromise = repo.listQuestions(categoryId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Questions loading timeout')), 3000)
    );
    
    const rows = await Promise.race([questionsPromise, timeoutPromise]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/answer/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ message: 'Missing id' });
    
    // Add 2-second timeout for answer loading
    const answerPromise = repo.getAnswerById(id);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Answer loading timeout')), 2000)
    );
    
    const row = await Promise.race([answerPromise, timeoutPromise]);
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
    
    // Add 3-second timeout for search
    const searchPromise = repo.search(text);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout')), 3000)
    );
    
    const rows = await Promise.race([searchPromise, timeoutPromise]);
    res.status(200).json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/debug/faqs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await require('../../core/database/mysql').query('SELECT id, category_id, question, popularity, status FROM chatbot_faq ORDER BY id ASC LIMIT 50');
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
    
    // Add 2-second timeout for question submission
    const submitPromise = repo.submitQuestion(userId, categoryId, question);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Question submission timeout')), 2000)
    );
    
    const r = await Promise.race([submitPromise, timeoutPromise]);
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
