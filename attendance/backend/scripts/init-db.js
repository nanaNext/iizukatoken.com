#!/usr/bin/env node
require('../src/config/loadEnv');

async function main() {
  await require('../src/core/bootstrap').init();
  if (String(process.env.APP_ENV || '') === 'staging' && String(process.env.DB_NAME || '') === 'attendance_db') {
    console.warn('warning: staging is using attendance_db; check .env.staging and APP_ENV');
  }
  console.log('db_init_ok', {
    appEnv: process.env.APP_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    db: process.env.DB_NAME || null,
    host: process.env.DB_HOST || null,
    port: process.env.DB_PORT || null
  });
}

main().catch((e) => {
  console.error('db_init_failed', e && e.message ? e.message : e);
  process.exit(1);
});
