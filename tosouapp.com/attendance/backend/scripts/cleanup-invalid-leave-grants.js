#!/usr/bin/env node
/* eslint-disable no-console */
const db = require('../src/core/database/mysql');
const { resolveEmploymentStartDate } = require('../src/utils/employmentDate');

function parseArgs(argv) {
  const out = { apply: false, userId: null };
  for (const a of argv) {
    if (a === '--apply') out.apply = true;
    else if (a.startsWith('--userId=')) out.userId = String(a.split('=')[1] || '').trim();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function addMonths(isoDate, months) {
  const dt = new Date(isoDate + 'T00:00:00Z');
  const day = dt.getUTCDate();
  dt.setUTCMonth(dt.getUTCMonth() + months);
  if (dt.getUTCDate() < day) dt.setUTCDate(0);
  return fmt(dt);
}

async function detectGrantsTable() {
  const [[row]] = await db.query(`
    SELECT table_name AS name
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name IN ('paid_leave_grants','leave_grants')
    ORDER BY CASE table_name WHEN 'paid_leave_grants' THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return row ? String(row.name) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/cleanup-invalid-leave-grants.js [--apply] [--userId=<id>]');
    console.log('Default is dry-run. Use --apply to actually delete invalid paid leave grants.');
    return;
  }

  const table = await detectGrantsTable();
  if (!table) {
    console.log('No leave grants table found. Nothing to do.');
    return;
  }

  const whereUser = args.userId ? 'WHERE id = ?' : '';
  const params = args.userId ? [args.userId] : [];
  const [users] = await db.query(
    `SELECT id, employee_code, username, hire_date, join_date FROM users ${whereUser} ORDER BY id ASC`,
    params
  );

  const invalidGrantIds = [];
  const reportRows = [];
  let scannedUsers = 0;

  for (const u of (users || [])) {
    const startDate = resolveEmploymentStartDate(u);
    if (!startDate) continue;
    scannedUsers += 1;
    const firstEligibleDate = addMonths(startDate, 6);
    const [grants] = await db.query(
      `SELECT id, grantDate, daysGranted, expiryDate
       FROM ${table}
       WHERE userId = ? AND type = 'paid'
       ORDER BY grantDate ASC`,
      [u.id]
    );
    for (const g of (grants || [])) {
      const grantDate = String(g.grantDate || '').slice(0, 10);
      if (!grantDate) continue;
      if (grantDate < firstEligibleDate) {
        invalidGrantIds.push(Number(g.id));
        reportRows.push({
          userId: u.id,
          employeeCode: u.employee_code || '',
          username: u.username || '',
          startDate,
          firstEligibleDate,
          grantId: g.id,
          grantDate,
          daysGranted: Number(g.daysGranted || 0),
          expiryDate: String(g.expiryDate || '').slice(0, 10)
        });
      }
    }
  }

  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Grants table: ${table}`);
  console.log(`Users scanned: ${scannedUsers}`);
  console.log(`Invalid paid grants found: ${invalidGrantIds.length}`);

  if (reportRows.length) {
    console.table(reportRows.slice(0, 50));
    if (reportRows.length > 50) {
      console.log(`...and ${reportRows.length - 50} more rows`);
    }
  }

  if (!args.apply || !invalidGrantIds.length) return;

  const chunks = [];
  for (let i = 0; i < invalidGrantIds.length; i += 500) {
    chunks.push(invalidGrantIds.slice(i, i + 500));
  }
  let deleted = 0;
  for (const ids of chunks) {
    const placeholders = ids.map(() => '?').join(',');
    const [res] = await db.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    deleted += Number(res?.affectedRows || 0);
  }
  console.log(`Deleted invalid grants: ${deleted}`);
}

main()
  .catch((err) => {
    console.error('cleanup-invalid-leave-grants failed:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch {}
  });

