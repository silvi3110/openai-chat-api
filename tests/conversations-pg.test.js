const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresConversationStore } = require('../src/conversations');

function createPoolStub() {
  const rows = new Map();
  return {
    async query(statement, params = []) {
      const sql = statement.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('INSERT INTO openai_chat_api_conversations')) {
        const row = { conversation_id: params[0], mode: params[1], previous_response_id: null,
          response_id: null, context: {}, status: 'processing', created_at: new Date(), updated_at: new Date() };
        rows.set(row.conversation_id, row);
        return { rows: [{ ...row }] };
      }
      if (sql.startsWith('UPDATE openai_chat_api_conversations SET status = \'processing\'')) {
        const row = rows.get(params[0]);
        if (!row || row.mode !== params[1] || row.status !== 'active') return { rows: [] };
        row.previous_response_id = row.response_id;
        row.status = 'processing';
        row.updated_at = new Date();
        return { rows: [{ ...row }] };
      }
      if (sql.startsWith('SELECT conversation_id, mode, status, updated_at')) {
        const row = rows.get(params[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (sql.startsWith('UPDATE openai_chat_api_conversations SET status = \'expired\'')) {
        const row = rows.get(params[0]);
        if (row?.status === 'active') row.status = 'expired';
        return { rows: [] };
      }
      if (sql.startsWith('UPDATE openai_chat_api_conversations SET response_id =')) {
        const row = rows.get(params[0]);
        if (!row || row.status !== 'processing') return { rows: [] };
        row.response_id = params[1];
        row.context = JSON.parse(params[2]);
        row.status = 'active';
        row.updated_at = new Date();
        return { rows: [{ ...row }] };
      }
      if (sql.startsWith('DELETE FROM openai_chat_api_conversations')) {
        rows.delete(params[0]);
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
  };
}

test('PostgreSQL store instances recover response IDs and structured context', async () => {
  const pool = createPoolStub();
  const firstProcessStore = createPostgresConversationStore(pool);
  const first = await firstProcessStore.acquire(undefined, '/function');
  const savedContext = { lastTool: { name: 'getProductProfits', arguments: { product: 'Yogurt Natural' } } };
  await firstProcessStore.release(first, 'resp_final_1', savedContext);

  const restartedStore = createPostgresConversationStore(pool);
  const restored = await restartedStore.acquire(first.id, '/function');
  assert.equal(restored.responseId, 'resp_final_1');
  assert.equal(restored.previousResponseId, 'resp_final_1');
  assert.deepEqual(restored.context, savedContext);
  await assert.rejects(restartedStore.acquire(first.id, '/function'), error => error.status === 409);
  await restartedStore.release(restored, 'resp_final_2', savedContext);
});