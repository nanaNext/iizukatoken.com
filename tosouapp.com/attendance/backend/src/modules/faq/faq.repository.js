const db = require('../../core/database/mysql');

module.exports = {
  // Ensure tables exist and fix schema if needed
  async ensureTable() {
    // Table for FAQ items (public FAQs)
    await db.query(`
      CREATE TABLE IF NOT EXISTS faq_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(128) NOT NULL,
        question VARCHAR(500) NOT NULL,
        answer LONGTEXT NOT NULL,
        order_seq INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table for user questions - with schema fix
    try {
      // Try to create table first
      await db.query(`
        CREATE TABLE IF NOT EXISTS faq_user_questions (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          user_id BIGINT UNSIGNED NOT NULL,
          question VARCHAR(500) NOT NULL,
          detail LONGTEXT NULL,
          category VARCHAR(128) NULL,
          status VARCHAR(32) NOT NULL DEFAULT '未回答',
          admin_answer LONGTEXT NULL,
          admin_answer_by BIGINT UNSIGNED NULL,
          answered_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_status (status),
          INDEX idx_category (category),
          INDEX idx_created (created_at),
          CONSTRAINT fk_faq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (err) {
      // If creation fails, table might already exist with old schema
      console.log('ℹ️  faq_user_questions table check:', err.message.substring(0, 100));
      
      try {
        // Check if old columns exist
        const [cols] = await db.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faq_user_questions' 
          AND COLUMN_NAME IN ('uname', 'name')
        `);
        
        if (cols && cols.length > 0) {
          console.log('🔄 Found old schema columns, rebuilding table...');
          // Drop and recreate with new schema
          await db.query('SET FOREIGN_KEY_CHECKS=0');
          await db.query('DROP TABLE IF EXISTS faq_user_questions');
          await db.query('SET FOREIGN_KEY_CHECKS=1');
          
          await db.query(`
            CREATE TABLE faq_user_questions (
              id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
              user_id BIGINT UNSIGNED NOT NULL,
              question VARCHAR(500) NOT NULL,
              detail LONGTEXT NULL,
              category VARCHAR(128) NULL,
              status VARCHAR(32) NOT NULL DEFAULT '未回答',
              admin_answer LONGTEXT NULL,
              admin_answer_by BIGINT UNSIGNED NULL,
              answered_at TIMESTAMP NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_user (user_id),
              INDEX idx_status (status),
              INDEX idx_category (category),
              INDEX idx_created (created_at),
              CONSTRAINT fk_faq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);
          console.log('✅ FAQ table rebuilt with correct schema');
        }
      } catch (schemaErr) {
        console.warn('⚠️  Could not auto-fix schema:', schemaErr.message.substring(0, 100));
      }
    }
  },

  // FAQ Items (Public)
  async listFaqItems({ category = null, isActive = true } = {}) {
    const where = [];
    const params = [];
    
    if (isActive) {
      where.push('is_active = ?');
      params.push(true);
    }
    
    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    const wsql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const [rows] = await db.query(
      `SELECT id, category, question, answer, order_seq, created_at
       FROM faq_items ${wsql}
       ORDER BY order_seq ASC, created_at DESC`,
      params
    );
    return rows || [];
  },

  async getFaqCategories() {
    const [rows] = await db.query(
      `SELECT DISTINCT category FROM faq_items WHERE is_active = TRUE ORDER BY category`
    );
    return rows.map(r => r.category) || [];
  },
  // User Questions
  async createQuestion({ userId, question, detail, category }) {
    if (!userId) {
      throw new Error('userId is required');
    }
    
    const sql = `
      INSERT INTO faq_user_questions (user_id, question, detail, category, status)
      VALUES (?, ?, ?, ?, '未回答')
    `;
    console.log('💾 Inserting question:', { userId, question, detail, category });
    const [res] = await db.query(sql, [userId, question, detail || null, category || null]);
    console.log('✅ Insert result:', { insertId: res.insertId, affectedRows: res.affectedRows });
    return { id: res.insertId };
  },

  async getUserQuestions(userId, { limit = 50, offset = 0 } = {}) {
    if (!userId) {
      console.warn('⚠️ getUserQuestions called without userId');
      return [];
    }
    
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    
    console.log('📥 Querying questions for user:', { userId, limit: lim, offset: off });
      const [rows] = await db.query(
      `SELECT id, question, detail, category, status, admin_answer, answered_at, created_at
       FROM faq_user_questions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, lim, off]
    );
    
    console.log(`✅ Query result: ${rows.length} questions found for user ${userId}`);
    return rows || [];
  },  // Get all user questions (for admin)
  async getAllUserQuestions({ status = null, limit = 50, offset = 0 } = {}) {
    const where = [];
    const params = [];

    if (status) {
      where.push('q.status = ?');
      params.push(status);
    }
    const wsql = where.length ? ('WHERE ' + where.join(' AND ')) : '';
    const [rows] = await db.query(
      `SELECT 
        q.id, q.user_id, q.question, q.detail, q.category, q.status,
        q.admin_answer, q.answered_at, q.created_at
       FROM faq_user_questions q
       ${wsql}
       ORDER BY q.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    // Fetch user names separately to avoid JOIN issues
    const enrichedRows = await Promise.all(rows.map(async (q) => {
      try {
        const [users] = await db.query(
          'SELECT COALESCE(username, email, "Unknown") as name FROM users WHERE id = ?',
          [q.user_id]
        );
        q.name = users && users[0] ? users[0].name : 'Unknown';
        q.employee_id = q.user_id;
      } catch (err) {
        q.name = 'Unknown';
        q.employee_id = q.user_id;
      }
      return q;
    }));
    
    return enrichedRows || [];
  },

  async updateAnswer({ questionId, answer, adminId }) {
    const sql = `
      UPDATE faq_user_questions
      SET status = '回答済み', admin_answer = ?, admin_answer_by = ?, answered_at = NOW()
      WHERE id = ?
    `;
    await db.query(sql, [answer, adminId, questionId]);
  },

  // Seed initial FAQ data if table is empty
  async seedIfEmpty() {
    try {
      const [rows] = await db.query('SELECT COUNT(*) as cnt FROM faq_items');
      const count = rows[0].cnt;
      
      if (count > 0) {
        console.log(`✅ FAQ already seeded (${count} items)`);
        return;
      }

      console.log('🌱 Seeding FAQ items...');
      
      const sampleFaqs = [
        {
          category: 'ログイン',
          question: 'ログインIDを忘れてしまいました。どうすればいいですか？',
          answer: 'ログインIDはメールでお知らせしています。メールを確認してください。見つからない場合は、管理者に連絡してください。',
          order_seq: 1
        },
        {
          category: 'ログイン',
          question: 'パスワードをリセットしたいのですが？',
          answer: 'ログイン画面から「パスワードを忘れた場合」をクリックしてリセットできます。メール認証後に新しいパスワードを設定してください。',
          order_seq: 2
        },
        {
          category: '勤怠入力',
          question: '打刻時間を間違えてしまいました。修正できますか？',
          answer: 'はい、修正できます。月次勤怠入力画面から該当日の時間を修正してください。その後「保存」ボタンをクリックして変更を保存します。',
          order_seq: 3
        },
        {
          category: '勤怠入力',
          question: '打刻を忘れてしまいました。月次勤怠画面で直接入力できますか？',
          answer: 'はい、月次勤怠画面から直接勤務時間を入力できます。打刻がなくても、勤務区分と時間を入力して保存することで記録されます。',
          order_seq: 4
        },
        {
          category: '有休管理',
          question: '有給休暇の残日数はどこで確認できますか？',
          answer: '「有休管理」→「休暇欠勤台帳」から確認できます。画面上部に現在の有給休暇残日数が表示されます。',
          order_seq: 5
        },
        {
          category: '技術的な問題',
          question: '画面が表示されません。どうすればいいですか？',
          answer: '以下の対応をお試しください：1) Ctrl+F5で強制再読込、2) キャッシュをクリア、3) 別のブラウザで試す、4) Google Chromeを使用してください。',
          order_seq: 6
        }
      ];

      for (const faq of sampleFaqs) {
        await db.query(
          `INSERT INTO faq_items (category, question, answer, order_seq, is_active)
           VALUES (?, ?, ?, ?, TRUE)`,
          [faq.category, faq.question, faq.answer, faq.order_seq]
        );
      }

      console.log(`✅ Seeded ${sampleFaqs.length} FAQ items`);
    } catch (err) {
      console.error('⚠️ Error seeding FAQ:', err.message);
      // Don't throw, just log - app should continue even if seeding fails
    }
  }
};
