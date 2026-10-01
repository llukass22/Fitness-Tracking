const fs = require('node:fs');
const path = require('node:path');

async function connectDatabase() {
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    if (!process.env[key]) throw new Error(`Missing ${key}. See .env.example and README.md.`);
  }
  const pool = require('mysql2/promise').createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
    connectionLimit: 5, charset: 'utf8mb4', timezone: 'Z',
  });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    for (const sql of schema.split(';').filter(sql => sql.trim())) await pool.query(sql);
    await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
module.exports = { connectDatabase };
