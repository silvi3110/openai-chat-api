const { randomUUID } = require('node:crypto');
const { AppError } = require('./errors');

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateId(id) {
  if (id !== undefined && (typeof id !== 'string' || !UUID_V4.test(id))) {
    throw new AppError(400, 'conversationId debe ser un UUID generado por el servidor');
  }
}

function createConversationStore({ ttl = 60 * 60 * 1000, max = 1000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    acquire(id, mode) {
      for (const [key, entry] of entries) {
        if (!entry.busy && now() - entry.updatedAt >= ttl) entries.delete(key);
      }
      validateId(id);
      let entry = id === undefined ? undefined : entries.get(id);
      if (id !== undefined && !entry) throw new AppError(404, 'Conversación inexistente o expirada; inicia otra sin conversationId');
      if (entry && entry.mode !== mode) throw new AppError(409, 'Continúa la conversación en el endpoint donde comenzó');
      if (entry?.busy) throw new AppError(409, 'La conversación está procesando otro mensaje');
      if (!entry) {
        if (entries.size >= max) throw new AppError(503, 'Límite temporal de conversaciones alcanzado');
        entry = { id: randomUUID(), mode, updatedAt: now(), responseId: undefined, context: {}, status: 'processing' };
        entries.set(entry.id, entry);
      }
      entry.busy = true;
      entry.status = 'processing';
      return entry;
    },
    release(entry, responseId, context = entry.context) {
      if (responseId) entry.responseId = responseId;
      entry.busy = false;
      entry.status = 'active';
      entry.context = context || {};
      entry.updatedAt = now();
      if (!entry.responseId) entries.delete(entry.id);
    },
  };
}

function createPostgresConversationStore(pool, { ttl = 30 * 24 * 60 * 60 * 1000, processingLease = 5 * 60 * 1000 } = {}) {
  return {
    async acquire(id, mode) {
      validateId(id);
      if (id === undefined) {
        const conversationId = randomUUID();
        const inserted = await pool.query(
          `INSERT INTO openai_chat_api_conversations (conversation_id, mode, status)
           VALUES ($1, $2, 'processing') RETURNING *`,
          [conversationId, mode],
        );
        return toConversation(inserted.rows[0], true);
      }

      const claimed = await pool.query(
        `UPDATE openai_chat_api_conversations
         SET status = 'processing', previous_response_id = response_id, updated_at = NOW()
         WHERE conversation_id = $1 AND mode = $2
           AND updated_at > NOW() - ($3 * INTERVAL '1 millisecond')
           AND (status = 'active' OR (status = 'processing' AND updated_at <= NOW() - ($4 * INTERVAL '1 millisecond')))
         RETURNING *`,
        [id, mode, ttl, processingLease],
      );
      if (claimed.rows[0]) return toConversation(claimed.rows[0], false);

      const existing = await pool.query(
        'SELECT conversation_id, mode, status, updated_at FROM openai_chat_api_conversations WHERE conversation_id = $1',
        [id],
      );
      const row = existing.rows[0];
      if (!row) throw new AppError(404, 'Conversación inexistente o expirada; inicia otra sin conversationId');
      if (row.mode !== mode) throw new AppError(409, 'Continúa la conversación en el endpoint donde comenzó');
      if (row.status === 'processing' && Date.now() - new Date(row.updated_at).getTime() < processingLease) {
        throw new AppError(409, 'La conversación está procesando otro mensaje');
      }
      if (row.status === 'active') {
        await pool.query(
          `UPDATE openai_chat_api_conversations SET status = 'expired', updated_at = NOW()
           WHERE conversation_id = $1 AND status = 'active'`,
          [id],
        );
      }
      throw new AppError(404, 'Conversación inexistente o expirada; inicia otra sin conversationId');
    },
    async release(entry, responseId, context = entry.context) {
      if (responseId) entry.responseId = responseId;
      entry.context = context || {};
      if (entry.isNew && !entry.responseId) {
        await pool.query('DELETE FROM openai_chat_api_conversations WHERE conversation_id = $1 AND status = $2', [entry.id, 'processing']);
        return;
      }
      await pool.query(
        `UPDATE openai_chat_api_conversations
         SET response_id = $2, context = $3::jsonb, status = 'active', updated_at = NOW()
         WHERE conversation_id = $1 AND status = 'processing'`,
        [entry.id, entry.responseId || null, JSON.stringify(entry.context)],
      );
    },
  };
}

function toConversation(row, isNew) {
  return {
    id: row.conversation_id,
    mode: row.mode,
    responseId: row.response_id || undefined,
    previousResponseId: row.previous_response_id || undefined,
    context: row.context || {},
    status: row.status,
    isNew,
    busy: true,
    updatedAt: row.updated_at,
  };
}

module.exports = { createConversationStore, createPostgresConversationStore };
