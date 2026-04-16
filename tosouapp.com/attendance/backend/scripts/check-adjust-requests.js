// Script kiểm tra dữ liệu time_adjust_requests trong DB
// Ghi kết quả ra file output.json để tránh vấn đề terminal silent
const path = require('path');
const fs = require('fs');

// Load env
require('../src/config/loadEnv');

const db = require('../src/core/database/mysql');

async function main() {
  const out = {};
  try {
    // 1. Kiểm tra bảng tồn tại chưa
    const [tables] = await db.query(`SHOW TABLES LIKE 'time_adjust_requests'`);
    out.tableExists = tables.length > 0;

    if (!out.tableExists) {
      out.error = 'Table time_adjust_requests does not exist yet';
      return;
    }

    // 2. Cấu trúc bảng
    const [cols] = await db.query(`DESCRIBE time_adjust_requests`);
    out.columns = cols.map(c => ({ field: c.Field, type: c.Type, null: c.Null, default: c.Default }));

    // 3. Tất cả requests JOIN users
    const [rows] = await db.query(`
      SELECT
        r.id,
        r.userId,
        u.username,
        u.email,
        u.role,
        r.attendanceId,
        r.requestedCheckIn,
        r.requestedCheckOut,
        r.reason,
        r.status,
        r.created_at
      FROM time_adjust_requests r
      LEFT JOIN users u ON r.userId = u.id
      ORDER BY r.created_at DESC
    `);
    out.totalCount = rows.length;
    out.rows = rows;

    // 4. Thống kê theo status
    const [stats] = await db.query(`
      SELECT status, COUNT(*) as cnt
      FROM time_adjust_requests
      GROUP BY status
    `);
    out.statsByStatus = stats;

    // 5. Thống kê theo role của user
    const [byRole] = await db.query(`
      SELECT u.role, COUNT(r.id) as cnt
      FROM time_adjust_requests r
      LEFT JOIN users u ON r.userId = u.id
      GROUP BY u.role
    `);
    out.statsByRole = byRole;

  } catch (e) {
    out.error = e.message;
    out.stack = e.stack;
  } finally {
    const outPath = path.join(__dirname, 'adjust-requests-dump.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log('Done. Output written to:', outPath);
    process.exit(0);
  }
}

main();
