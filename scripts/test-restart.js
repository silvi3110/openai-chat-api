require('dotenv').config({ quiet: true });
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { createApp } = require('../src/app');
const { createPool, checkConnection, migrate, databaseConfig } = require('../src/db');
const { createPostgresConversationStore } = require('../src/conversations');

async function runWorker() {
  let pool;
  try {
    pool = createPool();
    await checkConnection(pool);
    await migrate(pool);
    const client = { responses: { create: async request => {
      process.send({ type: 'request', previous_response_id: request.previous_response_id,
        input: request.input, instructions: request.instructions });
      if (!request.previous_response_id) {
        return { id: 'restart-call', status: 'completed', output: [{ type: 'function_call', name: 'getProductProfits',
          call_id: 'restart-call-id', arguments: JSON.stringify({ startDate: '2026-09-01', endDate: '2026-09-30', product: 'Yogurt Natural' }) }] };
      }
      if (request.input[0]?.type === 'function_call_output') {
        return { id: 'restart-final-first-turn', status: 'completed', output: [], output_text: 'Consulta mock completa.' };
      }
      return { id: 'restart-final-follow-up', status: 'completed', output: [], output_text: 'Continuación recuperada.' };
    } } };
    const app = createApp({ client, store: createPostgresConversationStore(pool) });
    const server = app.listen(0, '127.0.0.1', () => process.send({ type: 'ready', port: server.address().port }));
  } catch (error) {
    process.send({ type: 'startup_error', code: error.code || 'configuration' }, async () => {
      await pool?.end().catch(() => {});
      process.exit(1);
    });
  }
}

function startWorker() {
  const child = fork(__filename, ['worker'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const protocol = [];
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El proceso de prueba no inició a tiempo')), 15000);
    child.on('message', message => {
      if (message.type === 'request') protocol.push(message);
      if (message.type === 'ready') { clearTimeout(timer); resolve(message.port); }
      if (message.type === 'startup_error') { clearTimeout(timer); reject(new Error(`PostgreSQL no inició (${message.code})`)); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      if (code !== 0) { clearTimeout(timer); reject(new Error('El proceso de prueba terminó antes de iniciar')); }
    });
  });
  return { child, protocol, ready };
}

async function stopWorker(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await once(child, 'exit');
}

async function post(port, body) {
  const response = await fetch(`http://127.0.0.1:${port}/function`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function runParent() {
  databaseConfig();
  const createdIds = [];
  const workers = [];
  const pool = createPool();
  try {
    const firstWorker = startWorker();
    workers.push(firstWorker);
    const firstPort = await firstWorker.ready;
    const first = await post(firstPort, { message: 'Ganancias de Yogurt Natural este mes' });
    if (first.status !== 200) throw new Error('Falló la primera consulta de prueba');
    createdIds.push(first.body.conversationId);
    await stopWorker(firstWorker.child);

    const restartedWorker = startWorker();
    workers.push(restartedWorker);
    const restartedPort = await restartedWorker.ready;
    const continued = await post(restartedPort, { message: '¿Y el mes pasado?', conversationId: first.body.conversationId });
    if (continued.status !== 200) throw new Error('No se pudo continuar después del reinicio');
    if (continued.body.conversationId !== first.body.conversationId) throw new Error('Cambió el conversationId tras reiniciar');
    const resumed = restartedWorker.protocol.find(item => item.previous_response_id === first.body.responseId);
    if (!resumed || !resumed.instructions.includes('Yogurt Natural') || !resumed.instructions.includes('lastTool')) {
      throw new Error('No se recuperaron previous_response_id y contexto desde PostgreSQL');
    }

    const independent = await post(restartedPort, { message: 'Nueva conversación' });
    if (independent.status !== 200 || independent.body.conversationId === first.body.conversationId) {
      throw new Error('La nueva conversación no quedó separada');
    }
    createdIds.push(independent.body.conversationId);
    console.log('PASS PostgreSQL: persistencia, reinicio, continuidad y conversación independiente');
  } finally {
    await Promise.all(workers.map(worker => stopWorker(worker.child).catch(() => {})));
    if (createdIds.length) await pool.query(
      'DELETE FROM openai_chat_api_conversations WHERE conversation_id = ANY($1::uuid[])', [createdIds],
    );
    await pool.end();
  }
}

if (process.argv[2] === 'worker') runWorker();
else runParent().catch(error => {
  console.error(`Falló la prueba de reinicio: ${error.message}`);
  process.exitCode = 1;
});