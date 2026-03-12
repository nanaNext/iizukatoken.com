const db = require('../../core/database/mysql');

async function init() {
  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) UNIQUE,
    name_ja VARCHAR(255),
    name_en VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_faq (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    popularity INT DEFAULT 0,
    status VARCHAR(16) DEFAULT 'active',
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cat_pop (category_id, popularity),
    FOREIGN KEY (category_id) REFERENCES chatbot_categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS chatbot_user_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    category_id INT NULL,
    question TEXT NOT NULL,
    status VARCHAR(16) DEFAULT 'pending',
    assigned_to INT NULL,
    answer_text TEXT NULL,
    answered_by INT NULL,
    answered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensureSeedCategories() {
  const [rows] = await db.query('SELECT COUNT(1) AS c FROM chatbot_categories');
  const c = rows?.[0]?.c || 0;
  if (c > 0) return;
  const list = [
    { code: 'attendance', name_ja: '勤怠', name_en: 'Attendance' },
    { code: 'payroll_insurance_taxes', name_ja: '給与・保険・税金', name_en: 'Payroll, Insurance & Taxes' },
    { code: 'human_resources', name_ja: '人事', name_en: 'Human Resources' },
    { code: 'expense_settlement', name_ja: '経費計算', name_en: 'Expense Settlement' },
    { code: 'employment_conditions', name_ja: '就労', name_en: 'Employment/Work Conditions' },
    { code: 'year_end_tax_adjustment', name_ja: '年末調整', name_en: 'Year-End Tax Adjustment' }
  ];
  for (const it of list) {
    await db.query('INSERT INTO chatbot_categories (code, name_ja, name_en) VALUES (?,?,?)', [it.code, it.name_ja, it.name_en]);
  }
}

async function ensureSeedFaqs() {
  const [cntRows] = await db.query('SELECT COUNT(1) AS c FROM chatbot_faq');
  const c = cntRows?.[0]?.c || 0;
  if (c > 0) return;
  const [cats] = await db.query('SELECT id, code FROM chatbot_categories');
  const byCode = {};
  for (const cat of cats) byCode[cat.code] = cat.id;
  const items = [
    { code: 'attendance', q: '出退勤の打刻方法は？', a: 'アプリの勤怠ページで出勤/退勤ボタンを押してください。' },
    { code: 'attendance', q: '休暇申請の手順は？', a: '勤怠メニューの休暇申請から申請し、上長承認を待ってください。' },
    { code: 'expense_settlement', q: '交通費の申請方法は？', a: '経費計算メニューで「交通費」を選択し領収書を添付してください。' },
    { code: 'human_resources', q: '住所変更の届け出は？', a: '人事メニューの「個人情報更新」から申請してください。' },
    { code: 'employment_conditions', q: '就労時間の上限は？', a: '就労条件に基づき、法定労働時間内での勤務をお願いします。' },
    { code: 'payroll_insurance_taxes', q: '源泉徴収票を確認できますか？', a: '給与・保険・税金メニューでダウンロード可能です。' },
    { code: 'year_end_tax_adjustment', q: '年末調整の提出期限は？', a: '毎年11月末までに必要書類をアップロードしてください。' }
  ];
  for (const it of items) {
    const catId = byCode[it.code];
    if (!catId) continue;
    await db.query(
      'INSERT INTO chatbot_faq (category_id, question, answer, popularity, status) VALUES (?,?,?,?,?)',
      [catId, it.q, it.a, 10, 'active']
    );
  }
}

async function seedFaqsForce() {
  const [cats] = await db.query('SELECT id, code FROM chatbot_categories');
  const byCode = {};
  for (const cat of cats) byCode[cat.code] = cat.id;
  const items = [
    { code: 'attendance', q: '出退勤の打刻方法は？', a: 'アプリの勤怠ページで出勤/退勤ボタンを押してください。' },
    { code: 'attendance', q: '休暇申請の手順は？', a: '勤怠メニューの休暇申請から申請し、上長承認を待ってください。' },
    { code: 'expense_settlement', q: '交通費の申請方法は？', a: '経費計算メニューで「交通費」を選択し領収書を添付してください。' }
  ];
  for (const it of items) {
    const catId = byCode[it.code];
    if (!catId) continue;
    const [existsRows] = await db.query('SELECT COUNT(1) AS c FROM chatbot_faq WHERE category_id = ? AND question = ?', [catId, it.q]);
    const exists = existsRows?.[0]?.c || 0;
    if (exists === 0) {
      await db.query('INSERT INTO chatbot_faq (category_id, question, answer, popularity, status) VALUES (?,?,?,?,?)', [catId, it.q, it.a, 10, 'active']);
    }
  }
}
async function getCategories() {
  const [rows] = await db.query('SELECT id, code, name_ja, name_en FROM chatbot_categories ORDER BY id ASC');
  return rows;
}

async function listQuestions(categoryId) {
  const [rows] = await db.query('SELECT id, question, answer, popularity FROM chatbot_faq WHERE status = ? AND category_id = ? ORDER BY popularity DESC, updated_at DESC LIMIT 50', ['active', parseInt(categoryId, 10)]);
  return rows;
}

async function getAnswerById(id) {
  const [rows] = await db.query('SELECT id, category_id, question, answer FROM chatbot_faq WHERE id = ?', [parseInt(id, 10)]);
  return rows?.[0] || null;
}

async function search(text) {
  const q = `%${String(text || '').trim()}%`;
  const [rows] = await db.query('SELECT id, category_id, question, answer, popularity FROM chatbot_faq WHERE status = ? AND (question LIKE ? OR answer LIKE ?) ORDER BY popularity DESC, updated_at DESC LIMIT 50', ['active', q, q]);
  return rows;
}

async function submitQuestion(userId, categoryId, question) {
  const [r] = await db.query('INSERT INTO chatbot_user_questions (user_id, category_id, question) VALUES (?,?,?)', [userId || null, categoryId ? parseInt(categoryId, 10) : null, String(question || '').trim()]);
  return { id: r.insertId };
}

async function adminCreateFaq(userId, categoryId, question, answer, popularity, status) {
  const [r] = await db.query('INSERT INTO chatbot_faq (category_id, question, answer, popularity, status, created_by, updated_by) VALUES (?,?,?,?,?,?,?)', [parseInt(categoryId, 10), String(question || '').trim(), String(answer || '').trim(), parseInt(popularity || 0, 10), String(status || 'active'), userId || null, userId || null]);
  return { id: r.insertId };
}

async function adminUpdateFaq(userId, id, data) {
  const fields = [];
  const values = [];
  if (data.categoryId !== undefined) { fields.push('category_id = ?'); values.push(parseInt(data.categoryId, 10)); }
  if (data.question !== undefined) { fields.push('question = ?'); values.push(String(data.question)); }
  if (data.answer !== undefined) { fields.push('answer = ?'); values.push(String(data.answer)); }
  if (data.popularity !== undefined) { fields.push('popularity = ?'); values.push(parseInt(data.popularity, 10)); }
  if (data.status !== undefined) { fields.push('status = ?'); values.push(String(data.status)); }
  fields.push('updated_by = ?'); values.push(userId || null);
  if (fields.length === 0) return { ok: true };
  values.push(parseInt(id, 10));
  await db.query(`UPDATE chatbot_faq SET ${fields.join(', ')} WHERE id = ?`, values);
  return { ok: true };
}

async function adminDeleteFaq(id) {
  await db.query('DELETE FROM chatbot_faq WHERE id = ?', [parseInt(id, 10)]);
  return { ok: true };
}

module.exports = {
  init,
  ensureSeedCategories,
  ensureSeedFaqs,
  seedFaqsForce,
  getCategories,
  listQuestions,
  getAnswerById,
  search,
  submitQuestion,
  adminCreateFaq,
  adminUpdateFaq,
  adminDeleteFaq
};
