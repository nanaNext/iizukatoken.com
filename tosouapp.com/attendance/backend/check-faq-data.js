const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Connected to DB');
    
    // Check if table exists
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faq_user_questions'`
    );
    
    if (tables.length === 0) {
      console.log('❌ Table faq_user_questions does NOT exist!');
    } else {
      console.log('✅ Table faq_user_questions exists');
      
      // Check data
      const [data] = await conn.query('SELECT id, user_id, question, status, created_at FROM faq_user_questions LIMIT 10');
      console.log(`\n📦 Sample data (${data.length} rows):`);
      console.table(data);
    }
    
    await conn.end();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e);
    process.exit(1);
  }
})();
