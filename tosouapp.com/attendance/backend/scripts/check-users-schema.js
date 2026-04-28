#!/usr/bin/env node

/**
 * Check Database Schema for Users Table
 * Kiểm tra xem bảng users có những columns nào
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

async function checkSchema() {
  try {
    console.log('🔍 Checking users table schema...\n');
    
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tosouapp_dev'
    });

    // Get columns
    const [columns] = await conn.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('📋 Users Table Columns:');
    console.log('========================\n');
    
    columns.forEach((col, idx) => {
      console.log(`${idx + 1}. ${col.COLUMN_NAME}`);
      console.log(`   Type: ${col.COLUMN_TYPE}`);
      console.log(`   Nullable: ${col.IS_NULLABLE}`);
      console.log();
    });

    // Check for name column
    const hasName = columns.some(c => c.COLUMN_NAME === 'name');
    const hasUsername = columns.some(c => c.COLUMN_NAME === 'username');
    const hasEmail = columns.some(c => c.COLUMN_NAME === 'email');

    console.log('✓ Analysis:');
    console.log(`  - Has 'name' column: ${hasName ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Has 'username' column: ${hasUsername ? '✅ YES' : '❌ NO'}`);
    console.log(`  - Has 'email' column: ${hasEmail ? '✅ YES' : '❌ NO'}`);

    if (!hasName && hasUsername) {
      console.log('\n✅ Fix is correct! Using COALESCE(u.username, u.email, "Unknown")');
    }

    await conn.end();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

checkSchema();
