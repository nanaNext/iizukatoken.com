const repo = require('./faq.repository');
const { body, validationResult } = require('express-validator');

// Validation middleware
exports.validateCreateQuestion = [
  body('question')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('質問は5文字以上500文字以下である必要があります'),
  body('detail')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('詳細は2000文字以下である必要があります'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 128 })
];

exports.validateAdminAnswer = [
  body('answer')
    .trim()
    .isLength({ min: 1 })
    .withMessage('回答内容が必要です')
];

// Public: Get FAQ items
exports.listFaqItems = async (req, res) => {
  try {
    const { category } = req.query;
    const items = await repo.listFaqItems({ 
      category: category || null,
      isActive: true 
    });
    
    res.status(200).json({ data: items });
  } catch (e) {
    console.error('Error listing FAQ items:', e);
    res.status(500).json({ message: e.message });
  }
};

// Public: Get FAQ categories
exports.getFaqCategories = async (req, res) => {
  try {
    const categories = await repo.getFaqCategories();
    res.status(200).json({ data: categories });
  } catch (e) {
    console.error('Error getting categories:', e);
    res.status(500).json({ message: e.message });
  }
};

// Employee: Create question
exports.createQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user?.id;
    console.log('🔍 createQuestion - req.user:', req.user);
    console.log('🔍 createQuestion - userId:', userId);
    
    if (!userId) {
      console.error('❌ No userId found in request');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { question, detail, category } = req.body;
    console.log('💾 Saving question:', { userId, question, detail, category });
    const result = await repo.createQuestion({ userId, question, detail, category });

    console.log('✅ Question saved with id:', result.id);
    res.status(201).json({ 
      message: '質問を送信しました。管理者からの回答をお待ちください。',
      id: result.id 
    });
  } catch (e) {
    console.error('Error creating question:', e);
    res.status(500).json({ message: e.message });
  }
};

// Employee: Get my questions
exports.getMyQuestions = async (req, res) => {
  try {
    const userId = req.user?.id;
    console.log('🔍 getMyQuestions - req.user:', req.user);
    console.log('🔍 getMyQuestions - userId:', userId);
    
    if (!userId) {
      console.error('❌ No userId found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { limit = 50, offset = 0 } = req.query;
    console.log('📥 Fetching questions for userId:', userId);
    const questions = await repo.getUserQuestions(userId, { limit, offset });

    console.log(`✅ Found ${questions.length} questions for user ${userId}`);
    res.status(200).json({ data: questions });
  } catch (e) {
    console.error('Error getting my questions:', e);
    res.status(500).json({ message: e.message });
  }
};

// Admin: Get all questions
exports.getAllQuestions = async (req, res) => {
  try {
    // Check if user is admin
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { status, limit = 50, offset = 0 } = req.query;
    const questions = await repo.getAllUserQuestions({ status, limit, offset });

    res.status(200).json({ data: questions });
  } catch (e) {
    console.error('Error getting all questions:', e);
    res.status(500).json({ message: e.message });
  }
};

// Admin: Answer question
exports.answerQuestion = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is admin
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'manager';
    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { questionId } = req.params;
    const { answer } = req.body;
    const adminId = req.user?.id;

    await repo.updateAnswer({ questionId, answer, adminId });

    res.status(200).json({ message: '回答を保存しました' });
  } catch (e) {
    console.error('Error answering question:', e);
    res.status(500).json({ message: e.message });
  }
};
