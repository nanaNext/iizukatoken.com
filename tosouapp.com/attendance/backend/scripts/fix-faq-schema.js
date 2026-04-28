#!/usr/bin/env node
/**
 * Fix FAQ database schema
 * Drops and recreates faq_user_questions table with correct structure
 */
require('../src/config/loadEnv');

const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    charset: 'utf8mb4'
  });

  try {
    const conn = await pool.getConnection();
    
    console.log('🔍 Checking current faq_user_questions structure...');
    const [rows] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'faq_user_questions'
      ORDER BY COLUMN_NAME
    `, [process.env.DB_NAME]);

    console.log('Current columns:', rows.map(r => `${r.COLUMN_NAME}:${r.DATA_TYPE}`).join(', '));

    // Check if table has wrong structure
    const hasUname = rows.some(r => r.COLUMN_NAME === 'uname');
    const hasName = rows.some(r => r.COLUMN_NAME === 'name');
    
    if (hasUname || hasName) {
      console.log('⚠️  Found old columns (uname or name)');
      console.log('🔄 Dropping and recreating table...');
      
      // Drop old table
      await conn.query('DROP TABLE IF EXISTS faq_user_questions CASCADE');
      console.log('✅ Old table dropped');
      
      // Create new table with correct structure
      await conn.query(`
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
      console.log('✅ New table created');
    } else {
      console.log('✅ Table structure is correct');
    }
    
    // Verify new structure
    const [newRows] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'faq_user_questions'
      ORDER BY COLUMN_NAME
    `, [process.env.DB_NAME]);

    console.log('\n✅ Final columns:', newRows.map(r => `${r.COLUMN_NAME}:${r.DATA_TYPE}`).join(', '));
    
    conn.release();
    await pool.end();
    
    console.log('\n✅ FAQ database schema fixed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
