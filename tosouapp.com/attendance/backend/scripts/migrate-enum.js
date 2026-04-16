const fs = require('fs');
const path = require('path');
const outFile = path.join(__dirname, 'enum-result.txt');

require('../src/config/loadEnv');
const db = require('../src/core/database/mysql');

async function main() {
  let output = '';
  try {
    const [cols] = await db.query(
      "SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'attendance_daily' AND COLUMN_NAME = 'status'"
    );
    const colType = cols && cols[0] ? String(cols[0].COLUMN_TYPE) : 'NOT FOUND';
    output += 'Current: ' + colType + '\n';

    if (!colType.includes('\u9045\u523b')) {
      // Run the ALTER
      await db.query(
        "ALTER TABLE attendance_daily MODIFY COLUMN status ENUM('\u672a\u5165\u529b','\u672a\u627f\u8a8d','\u9045\u523b','\u627f\u8a8d\u5f85\u3061','\u627f\u8a8d\u6e08\u307f') NULL DEFAULT '\u672a\u5165\u529b'"
      );
      output += 'ALTER succeeded\n';
      
      const [cols2] = await db.query(
        "SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'attendance_daily' AND COLUMN_NAME = 'status'"
      );
      output += 'Updated: ' + (cols2 && cols2[0] ? String(cols2[0].COLUMN_TYPE) : 'NOT FOUND') + '\n';
    } else {
      output += 'Already has chikoku - no change needed\n';
    }
  } catch (e) {
    output += 'ERROR: ' + e.message + '\n';
  }
  fs.writeFileSync(outFile, output, 'utf8');
  console.log(output);
  process.exit(0);
}

main();
