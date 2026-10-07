require('dotenv').config({ quiet: true });
const { createClient } = require('./src/openai');
const { createApp } = require('./src/app');
const { createPool, checkConnection, migrate } = require('./src/db');
const { createPostgresConversationStore } = require('./src/conversations');

const log = (event, details) => {
  if (process.env.NODE_ENV !== 'production') console.log(JSON.stringify({ event, ...details }));
};
async function start() {
  const pool = createPool();
  try {
    await checkConnection(pool);
    await migrate(pool);
  } catch (error) {
    console.error(`No se pudo inicializar PostgreSQL (${error.code || 'error'}). Verifica DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD.`);
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return;
  }
  const app = createApp({ client: createClient(), log, store: createPostgresConversationStore(pool) });
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`Servidor en puerto ${port}: POST /chat y POST /function`));
  return { server, pool };
}

if (require.main === module) start().catch(() => {
  console.error('No se pudo iniciar el servidor; revisa la configuración local.');
  process.exitCode = 1;
});

module.exports = { start };