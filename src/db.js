const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true,
    tdsVersion: '7_1',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function connectDB() {
  if (pool) return pool;
  try {
    pool = await sql.connect(config);
    console.log('✅ Conectado ao SQL Server 2008!');
    return pool;
  } catch (err) {
    console.error('❌ Erro ao conectar:', err.message);
    throw err;
  }
}

module.exports = { sql, connectDB };