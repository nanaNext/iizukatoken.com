const mysql = require('mysql2/promise');
require('../../config/loadEnv');
// Khởi tạo pool kết nối MySQL dùng mysql2 (promise)

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONN_LIMIT || '10', 10),
  queueLimit: parseInt(process.env.DB_QUEUE_LIMIT || '0', 10),
  dateStrings: true,
  charset: 'utf8mb4'
});

// Kiểm tra kết nối DB khi khởi động server (bỏ qua khi NODE_ENV=test để tránh log async trong môi trường test)
if (String(process.env.NODE_ENV || '').toLowerCase() !== 'test') {
  (async () => {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      try {
        const dbName = process.env.DB_NAME;
        if (dbName) {
          try { await connection.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci`); } catch {}
          const [rows] = await connection.query(`
            SELECT TABLE_NAME AS t, TABLE_COLLATION AS c
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          `, [dbName]);
          for (const r of rows || []) {
            const coll = String(r.c || '');
            if (!coll.startsWith('utf8mb4')) {
              const t = String(r.t);
              try { await connection.query(`ALTER TABLE \`${dbName}\`.\`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`); } catch {}
            }
          }
        }
      } catch {}
      console.log('✅ Kết nối MySQL thành công!');
      connection.release();
    } catch (err) {
      console.error('❌ Kết nối MySQL thất bại:', err.message);
      console.error('Kiểm tra biến môi trường DB_HOST/DB_USER/DB_PASS/DB_NAME');
    }
  })();
}

const origPoolQuery = pool.query.bind(pool);
pool.query = async function(...args) {
  const t0 = Date.now();
  const res = await origPoolQuery(...args);
  const dur = Date.now() - t0;
  if (dur > 200) {
    try {
      console.warn(JSON.stringify({ level: 'warn', type: 'slow_query', duration_ms: dur }));
      try { require('../metrics').inc('slow_query_count', 1); } catch {}
    } catch {}
  }
  return res;
};
const origGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function() {
  const conn = await origGetConnection();
  try {
    await conn.query(`SET NAMES utf8mb4`);
    try { await conn.query(`SET collation_connection = utf8mb4_0900_ai_ci`); } catch {}
  } catch {}
  const origConnQuery = conn.query.bind(conn);
  conn.query = async function(...args) {
    const t0 = Date.now();
    const res = await origConnQuery(...args);
    const dur = Date.now() - t0;
    if (dur > 200) {
      try {
        console.warn(JSON.stringify({ level: 'warn', type: 'slow_query', duration_ms: dur }));
        try { require('../metrics').inc('slow_query_count', 1); } catch {}
      } catch {}
    }
    return res;
  };
  return conn;
};

module.exports = pool;
