const fs = require('fs');
const path = require('path');
require('../src/config/loadEnv');
const mysqldump = require('mysqldump');
(async () => {
  const outDir = path.join(__dirname, '..', 'backups');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `backup-${ts}.sql`);
  await mysqldump({
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS || process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306', 10)
    },
    dumpToFile: file
  });
  console.log(file);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
