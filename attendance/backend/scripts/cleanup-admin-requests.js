// Script xóa adjust requests của admin (test data cũ)
require('../src/config/loadEnv');
const db = require('../src/core/database/mysql');
const fs = require('fs');
const path = require('path');

async function cleanup() {
  const out = {};
  try {
    // Xem trước những gì sẽ xóa
    const [preview] = await db.query(`
      SELECT r.id, u.username, u.email, u.role, r.status, r.created_at
      FROM time_adjust_requests r
      INNER JOIN users u ON r.userId = u.id
      WHERE u.role = 'admin'
      ORDER BY r.id
    `);
    out.willDelete = preview;

    if (preview.length === 0) {
      out.message = 'No admin requests found, nothing to delete.';
    } else {
      const [result] = await db.query(`
        DELETE r FROM time_adjust_requests r
        INNER JOIN users u ON r.userId = u.id
        WHERE u.role = 'admin'
      `);
      out.deletedCount = result.affectedRows;
      out.message = `Deleted ${result.affectedRows} admin request(s)`;
    }

    // Hiển thị dữ liệu còn lại
    const [remaining] = await db.query(`
      SELECT r.id, u.username, u.email, u.role, r.status, r.created_at
      FROM time_adjust_requests r
      LEFT JOIN users u ON r.userId = u.id
      ORDER BY r.created_at DESC
    `);
    out.remaining = remaining;
    out.remainingCount = remaining.length;

  } catch (e) {
    out.error = e.message;
  } finally {
    const outPath = path.join(__dirname, 'cleanup-result.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  }
}

cleanup();
