require('dotenv').config();
const { Pool } = require('pg');

console.log('Iniciando conexión con PostgreSQL...');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  connectionTimeoutMillis: 5000,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar:', err.message);
  } else {
    console.log('✅ Conectado. Hora del servidor:', res.rows[0].now);
  }
  pool.end(() => {
    console.log('Pool cerrado, terminando proceso.');
  });
});


