const db = require('../src/core/database/mysql');
const attendanceRepo = require('../src/modules/attendance/attendance.repository');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function q(sql, params) {
  let last;
  for (let i = 0; i < 6; i++) {
    try {
      return await db.query(sql, params);
    } catch (e) {
      last = e;
      const msg = String(e?.message || '');
      if (msg.includes('Deadlock') || msg.includes('deadlock')) {
        await sleep(300 + i * 200);
        continue;
      }
      throw e;
    }
  }
  throw last;
}

async function main() {
  await sleep(800);
  const [t] = await q(`SHOW TABLES LIKE 'attendance'`);
  console.log('has_attendance_table=', !!(t && t.length));
  if (!t || !t.length) return;

  const [d] = await q(`DESCRIBE attendance`);
  const cols = d.map((r) => String(r.Field));
  const colSet = new Set(cols);
  console.log('columns=', cols.join(','));

  const [[c]] = await q(`SELECT COUNT(*) AS c FROM attendance`);
  console.log('row_count=', c.c);

  const want = ['id', 'userId', 'checkIn', 'checkOut', 'work_type', 'labels', 'shiftId', 'created_at', 'updated_at'];
  const selectCols = want.filter((c) => colSet.has(c));
  const [r] = await q(`SELECT ${selectCols.join(',')} FROM attendance ORDER BY id DESC LIMIT 10`);
  console.log('latest_rows=');
  console.table(r);

  try {
    await attendanceRepo.listDailyBetween(1, '2000-01-01', '2000-01-01');
  } catch (e) {
    console.log('attendance_daily_create_attempt_error=', e?.message || e);
  }

  const [t2] = await q(`SHOW TABLES LIKE 'attendance_daily'`);
  console.log('has_attendance_daily_table=', !!(t2 && t2.length));
  if (t2 && t2.length) {
    const [[c2]] = await q(`SELECT COUNT(*) AS c FROM attendance_daily`);
    console.log('daily_row_count=', c2.c);
    const [r2] = await q(`SELECT id,userId,date,work_type,location,reason,memo,break_minutes,night_break_minutes FROM attendance_daily ORDER BY id DESC LIMIT 10`);
    console.log('latest_daily_rows=');
    console.table(r2);
  }
}

main()
  .catch((e) => {
    console.error('DB_CHECK_ERROR:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch {}
  });
