#!/usr/bin/env node
/**
 * Direct database fix for FAQ table
 * Drops and recreates the faq_user_questions table with correct schema
 */

const mysql = require('mysql2/promise');

async function main() {
  let pool, conn;
  try {
    console.log('🔧 Initializing database connection...');
    
    pool = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '1234567',
      database: 'attendance_db',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelayMs: 0
    });

    conn = await pool.getConnection();
    console.log('✅ Connected to database\n');

    // Step 1: Check current table structure
    console.log('📋 Step 1: Checking current table structure...');
    try {
      const [cols] = await conn.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'attendance_db' 
        AND TABLE_NAME = 'faq_user_questions'
        ORDER BY ORDINAL_POSITION
      `);
      console.log('Current columns:', cols.map(c => c.COLUMN_NAME).join(', '));
      console.log('');
    } catch (e) {
      console.log('Table does not exist yet\n');
    }

    // Step 2: Disable foreign key checks
    console.log('🔒 Step 2: Disabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    console.log('✅ Foreign key checks disabled\n');

    // Step 3: Drop old table
    console.log('🗑️  Step 3: Dropping old table if exists...');
    await conn.query('DROP TABLE IF EXISTS faq_user_questions');
    console.log('✅ Old table dropped\n');

    // Step 4: Create new table
    console.log('🏗️  Step 4: Creating new table with correct schema...');
    await conn.query(`
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
    console.log('✅ New table created with correct schema\n');

    // Step 5: Re-enable foreign key checks
    console.log('🔓 Step 5: Re-enabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('✅ Foreign key checks re-enabled\n');

    // Step 6: Verify new structure
    console.log('✅ Step 6: Verifying new structure...');
    const [newCols] = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'attendance_db' 
      AND TABLE_NAME = 'faq_user_questions'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('New columns:', newCols.map(c => c.COLUMN_NAME).join(', '));
    console.log('');

    console.log('═══════════════════════════════════════════');
    console.log('✅ DATABASE FIX COMPLETE!');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart the server: npm start');
    console.log('2. Visit: http://localhost:3000/admin/faq');
    console.log('3. The FAQ page should now load without errors');
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌ ERROR:', err.message);
    console.error('');
    if (err.code) console.error('Code:', err.code);
    if (err.errno) console.error('Errno:', err.errno);
    process.exit(1);
  } finally {
    if (conn) await conn.release();
    if (pool) await pool.end();
  }
}

main();
