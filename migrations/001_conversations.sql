CREATE TABLE IF NOT EXISTS openai_chat_api_conversations (
  conversation_id UUID PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('/chat', '/function')),
  previous_response_id TEXT,
  response_id TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context) = 'object'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'processing', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS openai_chat_api_conversations_updated_at_idx
  ON openai_chat_api_conversations (updated_at);