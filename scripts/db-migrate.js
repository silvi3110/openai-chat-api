require('dotenv').config({ quiet: true });
const { createPool, checkConnection, migrate } = require('../src/db');

async function main() {
  const pool = createPool();
  try {
    await checkConnection(pool);
    await migrate(pool);
    console.log('PostgreSQL migration complete');
  } catch (error) {
    console.error(`No se pudo migrar PostgreSQL (${error.code || 'error'}). Verifica DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD.`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(() => {
  process.exitCode = 1;
});
