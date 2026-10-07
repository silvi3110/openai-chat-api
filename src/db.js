const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function databaseConfig(env = process.env) {
  const password = env.DB_PASSWORD;
  const port = Number(env.DB_PORT);
  if (!env.DB_HOST || !env.DB_NAME || !env.DB_USER || typeof password !== 'string' || !password.length ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Configuración PostgreSQL incompleta: revisa DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD');
  }
  return { host: env.DB_HOST, port, database: env.DB_NAME, user: env.DB_USER, password };
}

function createPool({ env = process.env, PoolClass = Pool } = {}) {
  return new PoolClass({ ...databaseConfig(env), connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}

async function checkConnection(pool) {
  await pool.query('SELECT 1');
  return true;
}

async function migrate(pool) {
  const filename = path.join(__dirname, '..', 'migrations', '001_conversations.sql');
  await pool.query(fs.readFileSync(filename, 'utf8'));
}

module.exports = { databaseConfig, createPool, checkConnection, migrate };