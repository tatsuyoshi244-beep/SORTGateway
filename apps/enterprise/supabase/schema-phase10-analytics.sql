-- SORT Gateway v2.1 Enterprise — Phase 10: Analytics & Chat Logs
-- schema-phase9-scheduling.sql の後に実行

ALTER TABLE chat_logs
  ADD COLUMN IF NOT EXISTS has_knowledge BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score REAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_result TEXT,
  ADD COLUMN IF NOT EXISTS unresolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_by_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS no_knowledge_reason TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_item_id UUID;

CREATE INDEX IF NOT EXISTS idx_chat_logs_company_created ON chat_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_unresolved ON chat_logs(company_id, unresolved) WHERE unresolved = true;

COMMENT ON COLUMN chat_logs.has_knowledge IS 'ナレッジ根拠あり回答か';
COMMENT ON COLUMN chat_logs.unresolved IS '未解決フラグ（根拠なし・低信頼度）';
COMMENT ON COLUMN chat_logs.status IS 'open / assigned / resolved / hidden';
