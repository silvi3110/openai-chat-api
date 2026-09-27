const { randomUUID } = require('node:crypto');
const { AppError } = require('./errors');

function createConversationStore({ ttl = 60 * 60 * 1000, max = 1000, now = Date.now } = {}) {
  const entries = new Map();
  return {
    acquire(id, mode) {
      for (const [key, entry] of entries) {
        if (!entry.busy && now() - entry.updatedAt >= ttl) entries.delete(key);
      }
      if (id !== undefined && (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
        throw new AppError(400, 'conversationId debe ser un UUID generado por el servidor');
      }
      let entry = id === undefined ? undefined : entries.get(id);
      if (id !== undefined && !entry) throw new AppError(404, 'Conversación inexistente o expirada; inicia otra sin conversationId');
      if (entry && entry.mode !== mode) throw new AppError(409, 'Continúa la conversación en el endpoint donde comenzó');
      if (entry?.busy) throw new AppError(409, 'La conversación está procesando otro mensaje');
      if (!entry) {
        if (entries.size >= max) throw new AppError(503, 'Límite temporal de conversaciones alcanzado');
        entry = { id: randomUUID(), mode, updatedAt: now(), responseId: undefined };
        entries.set(entry.id, entry);
      }
      entry.busy = true;
      return entry;
    },
    release(entry, responseId) {
      if (responseId) entry.responseId = responseId;
      entry.busy = false;
      entry.updatedAt = now();
      if (!entry.responseId) entries.delete(entry.id);
    },
  };
}
module.exports = { createConversationStore };
