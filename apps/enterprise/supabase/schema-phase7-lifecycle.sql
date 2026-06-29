-- SORT Gateway v2.1 Enterprise — Phase 7: Knowledge Lifecycle
-- schema-phase6-security.sql の後に実行

CREATE TYPE knowledge_approval_status AS ENUM ('draft', 'review', 'approved', 'published');

ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT '';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS approval_status knowledge_approval_status NOT NULL DEFAULT 'draft';
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS responsible_person_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_id UUID NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  company_id TEXT REFERENCES companies(id),
  version INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_status knowledge_approval_status NOT NULL,
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_versions_item ON knowledge_versions(knowledge_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_items(approval_status);

CREATE TYPE feedback_rating AS ENUM ('positive', 'negative');

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT REFERENCES companies(id),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer_summary TEXT,
  rating feedback_rating NOT NULL,
  chat_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_company ON feedback(company_id, created_at DESC);

CREATE TYPE notification_type AS ENUM ('knowledge_published', 'knowledge_review', 'system');

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT REFERENCES companies(id),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, created_at DESC);

-- 既存データを Published に移行（初回のみ）
-- UPDATE knowledge_items SET approval_status = 'published', version = 1 WHERE approval_status = 'draft';
