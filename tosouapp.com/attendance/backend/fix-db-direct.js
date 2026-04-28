#!/usr/bin/env node
/**
 * Direct database fix script
 * Drops and recreates faq_user_questions table
 */
require('./src/config/loadEnv');

const mysql = require('mysql2/promise');

async function fixDatabase() {
  console.log('🔧 FAQ Database Schema Fix Tool');
  console.log('================================\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '1234567',
    database: process.env.DB_NAME || 'attendance_db',
    port: parseInt(process.env.DB_PORT || '3306', 10)
  };

  console.log('📍 Database Config:');
  console.log(`   Host: ${config.host}:${config.port}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}\n`);

  try {
    console.log('🔌 Connecting to database...');
    const pool = mysql.createPool(config);
    const conn = await pool.getConnection();
    console.log('✅ Connected!\n');

    // Check current structure
    console.log('🔍 Checking current table structure...');
    const [cols] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'faq_user_questions'
      ORDER BY ORDINAL_POSITION
    `);

    if (cols.length > 0) {
      console.log('Current columns:');
      cols.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.COLUMN_KEY ? `(${col.COLUMN_KEY})` : ''}`);
      });

      // Check for problematic columns
      const problematicCols = cols.filter(c => ['uname', 'name'].includes(c.COLUMN_NAME));
      if (problematicCols.length > 0) {
        console.log('\n⚠️  Found problematic columns:', problematicCols.map(c => c.COLUMN_NAME).join(', '));
      }
    }

    console.log('\n🔄 Fixing database schema...\n');

    // Step 1: Disable foreign key checks
    console.log('1️⃣  Disabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS=0');
    console.log('   ✅ Done\n');

    // Step 2: Drop old table
    console.log('2️⃣  Dropping old faq_user_questions table...');
    await conn.query('DROP TABLE IF EXISTS `faq_user_questions`');
    console.log('   ✅ Done\n');

    // Step 3: Re-enable foreign key checks
    console.log('3️⃣  Re-enabling foreign key checks...');
    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('   ✅ Done\n');

    // Step 4: Create new table
    console.log('4️⃣  Creating new faq_user_questions table...');
    await conn.query(`
      CREATE TABLE \`faq_user_questions\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`question\` VARCHAR(500) NOT NULL,
        \`detail\` LONGTEXT NULL,
        \`category\` VARCHAR(128) NULL,
        \`status\` VARCHAR(32) NOT NULL DEFAULT '未回答',
        \`admin_answer\` LONGTEXT NULL,
        \`admin_answer_by\` BIGINT UNSIGNED NULL,
        \`answered_at\` TIMESTAMP NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_user\` (\`user_id\`),
        INDEX \`idx_status\` (\`status\`),
        INDEX \`idx_category\` (\`category\`),
        INDEX \`idx_created\` (\`created_at\`),
        CONSTRAINT \`fk_faq_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('   ✅ Done\n');

    // Step 5: Verify
    console.log('5️⃣  Verifying new table structure...');
    const [newCols] = await conn.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'faq_user_questions'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('   New columns:');
    newCols.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.COLUMN_KEY ? `(${col.COLUMN_KEY})` : ''}`);
    });

    // Check if fix was successful
    const hasProblematicCols = newCols.some(c => ['uname', 'name'].includes(c.COLUMN_NAME));
    const hasCorrectCols = newCols.some(c => c.COLUMN_NAME === 'user_id');

    if (hasCorrectCols && !hasProblematicCols) {
      console.log('\n✅ ✅ ✅ DATABASE FIXED SUCCESSFULLY! ✅ ✅ ✅');
      console.log('\n🎉 You can now:');
      console.log('   1. Restart the server (npm start)');
      console.log('   2. Visit http://localhost:3000/admin/faq');
      console.log('   3. FAQ will work without "Unknown column" errors!');
    } else {
      console.log('\n⚠️  Something might not be right. Check the columns above.');
    }

    conn.release();
    await pool.end();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if MySQL is running');
    console.error('2. Check database credentials in .env');
    console.error('3. Check if database exists:', process.env.DB_NAME || 'attendance_db');
    process.exit(1);
  }
}

fixDatabase();
