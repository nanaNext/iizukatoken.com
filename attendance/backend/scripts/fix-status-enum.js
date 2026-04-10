// Script to add '遅刻' to the status ENUM in attendance_daily table
const db = require('../src/core/database/mysql');

async function main() {
  try {
    // First check current column definition
    const [cols] = await db.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
        AND table_name = 'attendance_daily' 
        AND COLUMN_NAME = 'status'
    `);
    console.log('Current column type:', cols?.[0]?.COLUMN_TYPE);

    // Check if 遅刻 is already in the ENUM
    const colType = String(cols?.[0]?.COLUMN_TYPE || '');
    if (colType.includes('遅刻')) {
      console.log('遅刻 is already in the ENUM. No changes needed.');
      process.exit(0);
    }

    // Alter the column to include 遅刻
    await db.query(`
      ALTER TABLE attendance_daily 
      MODIFY COLUMN status ENUM('未入力','未承認','遅刻','承認待ち','承認済み') NULL DEFAULT '未入力'
    `);
    console.log('SUCCESS: 遅刻 added to status ENUM');

    // Verify
    const [cols2] = await db.query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
        AND table_name = 'attendance_daily' 
        AND COLUMN_NAME = 'status'
    `);
    console.log('Updated column type:', cols2?.[0]?.COLUMN_TYPE);
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

main();
