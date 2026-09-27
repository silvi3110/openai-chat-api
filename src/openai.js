const OpenAI = require('openai');

function createClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('Falta OPENAI_API_KEY en .env');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 1 });
}
module.exports = { createClient };
