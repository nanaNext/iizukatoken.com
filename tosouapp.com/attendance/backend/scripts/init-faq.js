// Initialize FAQ tables and seed sample data
const db = require('../src/core/database/mysql');

async function main() {
  try {
    console.log('Initializing FAQ tables...');
    
    // Create tables
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

    console.log('✅ Tables created successfully');

    // Seed sample FAQ data
    console.log('Seeding sample FAQ data...');
    
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

    console.log('✅ Sample FAQ data seeded successfully');
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
