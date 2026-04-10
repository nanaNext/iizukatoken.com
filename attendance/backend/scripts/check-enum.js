const db = require('../src/core/database/mysql');
db.query("SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'attendance_daily' AND COLUMN_NAME = 'status'")
  .then(([rows]) => { process.stdout.write('TYPE: ' + (rows[0] && rows[0].COLUMN_TYPE) + '\n'); process.exit(0); })
  .catch(e => { process.stdout.write('ERR: ' + e.message + '\n'); process.exit(1); });
