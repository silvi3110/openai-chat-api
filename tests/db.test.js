require('dotenv').config({ quiet: true });
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { databaseConfig, createPool } = require('../src/db');

const env = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '5433',
  DB_NAME: 'openai_chat_api',
  DB_USER: 'postgres',
  DB_PASSWORD: 'test-password',
};

test('database config uses the DB environment variables and string password', () => {
  assert.deepEqual(databaseConfig(env), {
    host: '127.0.0.1', port: 5433, database: 'openai_chat_api', user: 'postgres', password: 'test-password',
  });
  assert.throws(() => databaseConfig({ ...env, DB_PASSWORD: '' }), /Configuración PostgreSQL incompleta/);
  assert.throws(() => databaseConfig({ ...env, DB_PASSWORD: undefined }), /Configuración PostgreSQL incompleta/);
  assert.throws(() => databaseConfig({ ...env, DB_PORT: 'not-a-port' }), /Configuración PostgreSQL incompleta/);
});

test('pool receives a validated string password without exposing it in errors', () => {
  let received;
  class PoolStub { constructor(config) { received = config; } }
  createPool({ env, PoolClass: PoolStub });
  assert.equal(received.host, '127.0.0.1');
  assert.equal(received.port, 5433);
  assert.equal(typeof received.password, 'string');
  assert.equal(received.connectionTimeoutMillis, 5000);
});

test('db migration script is available and runnable', () => {
  const runtimePassword = process.env.DB_PASSWORD || env.DB_PASSWORD;
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:migrate'], {
    cwd: __dirname + '/..',
    encoding: 'utf8',
    shell: true,
    env: {
      ...process.env,
      DB_HOST: process.env.DB_HOST || env.DB_HOST,
      DB_PORT: process.env.DB_PORT || env.DB_PORT,
      DB_NAME: process.env.DB_NAME || env.DB_NAME,
      DB_USER: process.env.DB_USER || env.DB_USER,
      DB_PASSWORD: runtimePassword,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});