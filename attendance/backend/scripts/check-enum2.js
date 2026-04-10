const fs = require('fs');
const db = require('../src/core/database/mysql');
db.query("SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'attendance_daily' AND COLUMN_NAME = 'status'")
  .then(([rows]) => { 
    const result = 'TYPE: ' + (rows[0] && rows[0].COLUMN_TYPE);
    fs.writeFileSync('/tmp/enum-check.txt', result);
    console.log(result);
    process.exit(0); 
  })
  .catch(e => { 
    const result = 'ERR: ' + e.message;
    fs.writeFileSync('/tmp/enum-check.txt', result);
    console.log(result);
    process.exit(1); 
  });
