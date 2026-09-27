const express = require('express');
const { createAssistant } = require('./assistant');
const { createConversationStore } = require('./conversations');
const { AppError } = require('./errors');

function createApp({ client, log = () => {}, clock, store = createConversationStore() }) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  const respond = createAssistant({ client, log, clock });
  for (const endpoint of ['/chat', '/function']) {
    app.post(endpoint, async (req, res, next) => {
      let conversation;
      let result;
      try {
        const { message, conversationId } = req.body || {};
        if (typeof message !== 'string' || !message.trim()) throw new AppError(400, 'message debe ser texto no vacío');
        if (message.length > 4000) throw new AppError(400, 'message no puede superar 4000 caracteres');
        conversation = store.acquire(conversationId, endpoint);
        result = await respond(message.trim(), conversation, endpoint === '/function');
        res.json(result);
      } catch (error) { next(error); }
      finally { if (conversation) store.release(conversation, result?.responseId); }
    });
  }
  app.use((error, req, res, next) => {
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body JSON inválido' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Body demasiado grande' });
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
module.exports = { createApp };
