-- =============================================================================
-- SORT Gateway v2.1 Enterprise — Production Setup (Phase 12)
-- =============================================================================
-- Supabase SQL Editor でこのファイルを一括実行してください。
-- 個別フェーズファイルもリポジトリに残していますが、本番初回は本ファイル推奨です。
--
-- 適用順（本ファイル内）:
--   1. schema.sql              (Phase 3  ベース)
--   2. schema-phase5-tenant    (マルチテナント)
--   3. schema-phase6-security  (セキュリティ)
--   4. schema-phase7-lifecycle (ナレッジライフサイクル)
--   5. schema-phase8-integrations
--   6. schema-phase9-scheduling
--   7. schema-phase10-analytics
--   8. schema-phase12-production (バージョン管理・Storage)
--
-- ⚠️ 破壊的変更の注意:
--   - DROP POLICY / DROP TRIGGER は既存ポリシーを再作成します（データは保持）
--   - phase7 の approval_status デフォルトは draft（既存行への UPDATE はコメントアウト）
--   - 本スクリプトは既存本番 DB への再実行より、新規プロジェクト向けです
--   - 既存 DB には個別 phase ファイルで差分適用してください
-- =============================================================================


-- ########## BEGIN schema.sql ##########

-- SORT Gateway v2.1 Enterprise — Supabase Schema (Phase 3)
-- RLS-enabled design for production deployment
-- auth.users.id と public.users.id を同一 UUID で連携

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('employee', 'manager', 'executive', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE info_classification AS ENUM ('internal', 'department', 'confidential', 'executive_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE handover_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE file_provider AS ENUM ('sharepoint', 'google_drive', 'box', 'local_smb');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('connected', 'disconnected', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- roles (master)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name user_role NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- users: auth.users と 1:1（id = auth.uid()）
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'employee',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'その他',
  classification info_classification NOT NULL DEFAULT 'internal',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handover_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  from_person TEXT NOT NULL,
  to_person TEXT,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  classification info_classification NOT NULL DEFAULT 'department',
  status handover_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS responsible_persons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_title TEXT NOT NULL,
  responsibilities TEXT[] NOT NULL DEFAULT '{}',
  phone TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_summary TEXT NOT NULL,
  source_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  classification_scope info_classification[] NOT NULL,
  issued_to TEXT,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  used_count INT NOT NULL DEFAULT 0,
  max_uses INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS file_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  provider file_provider NOT NULL,
  status connection_status NOT NULL DEFAULT 'disconnected',
  sync_path TEXT NOT NULL,
  credentials_vault_key TEXT,
  last_synced_at TIMESTAMPTZ,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_classification ON knowledge_items(classification);
CREATE INDEX IF NOT EXISTS idx_knowledge_department ON knowledge_items(department_id);
CREATE INDEX IF NOT EXISTS idx_handover_department ON handover_items(department_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_code ON token_passes(code);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id);

-- Helper: current user role (auth.uid() → users.id)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM users WHERE id = auth.uid() AND is_active = TRUE),
    'employee'::user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM users WHERE id = auth.uid();
$$;

-- auth.users 作成時に public.users へプロフィール自動作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'employee'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsible_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_connections ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除して再作成（再実行可能）
DROP POLICY IF EXISTS departments_read ON departments;
DROP POLICY IF EXISTS departments_admin ON departments;
DROP POLICY IF EXISTS roles_read ON roles;
DROP POLICY IF EXISTS users_read_self ON users;
DROP POLICY IF EXISTS users_admin_write ON users;
DROP POLICY IF EXISTS knowledge_select ON knowledge_items;
DROP POLICY IF EXISTS knowledge_write ON knowledge_items;
DROP POLICY IF EXISTS knowledge_update ON knowledge_items;
DROP POLICY IF EXISTS knowledge_delete ON knowledge_items;
DROP POLICY IF EXISTS handover_select ON handover_items;
DROP POLICY IF EXISTS handover_write ON handover_items;
DROP POLICY IF EXISTS contacts_read ON responsible_persons;
DROP POLICY IF EXISTS contacts_admin ON responsible_persons;
DROP POLICY IF EXISTS chat_logs_own ON chat_logs;
DROP POLICY IF EXISTS chat_logs_insert ON chat_logs;
DROP POLICY IF EXISTS audit_read ON audit_logs;
DROP POLICY IF EXISTS audit_read_admin ON audit_logs;
DROP POLICY IF EXISTS audit_read_manager ON audit_logs;
DROP POLICY IF EXISTS audit_insert ON audit_logs;
DROP POLICY IF EXISTS token_read ON token_passes;
DROP POLICY IF EXISTS token_write ON token_passes;
DROP POLICY IF EXISTS token_admin_all ON token_passes;
DROP POLICY IF EXISTS files_read ON file_connections;
DROP POLICY IF EXISTS files_write ON file_connections;

-- departments: 認証ユーザーは閲覧可、admin のみ書き込み
CREATE POLICY departments_read ON departments FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_admin ON departments FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

-- roles: 閲覧のみ
CREATE POLICY roles_read ON roles FOR SELECT TO authenticated USING (true);

-- users: 自分または admin/manager/executive が閲覧、admin のみ書き込み
CREATE POLICY users_read_self ON users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR current_user_role() IN ('admin', 'manager', 'executive')
  );
CREATE POLICY users_admin_write ON users FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

-- knowledge_items: classification による閲覧制御
CREATE POLICY knowledge_select ON knowledge_items FOR SELECT TO authenticated
  USING (
    classification = 'internal'
    OR (
      classification = 'department'
      AND (
        department_id = current_user_department()
        OR current_user_role() IN ('manager', 'executive', 'admin')
      )
    )
    OR (
      classification = 'confidential'
      AND current_user_role() IN ('manager', 'executive', 'admin')
    )
    OR (
      classification = 'executive_only'
      AND current_user_role() IN ('executive', 'admin')
    )
  );
CREATE POLICY knowledge_write ON knowledge_items FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('manager', 'executive', 'admin'));
CREATE POLICY knowledge_update ON knowledge_items FOR UPDATE TO authenticated
  USING (current_user_role() IN ('manager', 'executive', 'admin'));
CREATE POLICY knowledge_delete ON knowledge_items FOR DELETE TO authenticated
  USING (current_user_role() IN ('manager', 'executive', 'admin'));

-- handover_items
CREATE POLICY handover_select ON handover_items FOR SELECT TO authenticated
  USING (
    classification = 'internal'
    OR department_id = current_user_department()
    OR current_user_role() IN ('executive', 'admin')
    OR (
      classification = 'executive_only'
      AND current_user_role() IN ('executive', 'admin')
    )
  );
CREATE POLICY handover_write ON handover_items FOR ALL TO authenticated
  USING (current_user_role() IN ('manager', 'executive', 'admin'));

-- responsible_persons
CREATE POLICY contacts_read ON responsible_persons FOR SELECT TO authenticated USING (true);
CREATE POLICY contacts_admin ON responsible_persons FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

-- chat_logs
CREATE POLICY chat_logs_own ON chat_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_user_role() IN ('manager', 'admin'));
CREATE POLICY chat_logs_insert ON chat_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- audit_logs: admin は全件、manager は同一部署ユーザーのみ
CREATE POLICY audit_read_admin ON audit_logs FOR SELECT TO authenticated
  USING (current_user_role() = 'admin');
CREATE POLICY audit_read_manager ON audit_logs FOR SELECT TO authenticated
  USING (
    current_user_role() = 'manager'
    AND user_id IN (
      SELECT id FROM users WHERE department_id = current_user_department()
    )
  );
CREATE POLICY audit_insert ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- token_passes: admin のみ管理・閲覧
CREATE POLICY token_admin_all ON token_passes FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

-- file_connections: admin のみ
CREATE POLICY files_read ON file_connections FOR SELECT TO authenticated
  USING (current_user_role() = 'admin');
CREATE POLICY files_write ON file_connections FOR ALL TO authenticated
  USING (current_user_role() = 'admin');

-- documents / document_chunks (RAG)
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('processing', 'indexed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE embedding_status AS ENUM ('pending', 'completed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  department TEXT,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  classification info_classification NOT NULL DEFAULT 'internal',
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  owner_name TEXT,
  status document_status NOT NULL DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  token_count INT NOT NULL DEFAULT 0,
  page_number INT,
  embedding_status embedding_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(classification);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks(document_id);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_select ON documents;
DROP POLICY IF EXISTS documents_write ON documents;
DROP POLICY IF EXISTS document_chunks_select ON document_chunks;
DROP POLICY IF EXISTS document_chunks_write ON document_chunks;

CREATE POLICY documents_select ON documents FOR SELECT TO authenticated
  USING (
    classification = 'internal'
    OR (
      classification = 'department'
      AND (
        department_id = current_user_department()
        OR current_user_role() IN ('manager', 'executive', 'admin')
      )
    )
    OR (
      classification = 'confidential'
      AND current_user_role() IN ('manager', 'executive', 'admin')
    )
    OR (
      classification = 'executive_only'
      AND current_user_role() IN ('executive', 'admin')
    )
  );

CREATE POLICY documents_write ON documents FOR ALL TO authenticated
  USING (current_user_role() IN ('manager', 'executive', 'admin'));

CREATE POLICY document_chunks_select ON document_chunks FOR SELECT TO authenticated
  USING (
    document_id IN (SELECT id FROM documents)
  );

CREATE POLICY document_chunks_write ON document_chunks FOR ALL TO authenticated
  USING (current_user_role() IN ('manager', 'executive', 'admin'));

-- Storage bucket（Supabase Dashboard または SQL で作成）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Seed roles
INSERT INTO roles (name, label, description) VALUES
  ('employee', '一般社員', 'チャット・検索・閲覧'),
  ('manager', '責任者', '部署ナレッジ・引継ぎ管理'),
  ('executive', '役員', '機密・トークンパス'),
  ('admin', '管理者', '全体管理')
ON CONFLICT (name) DO NOTHING;

-- ########## END schema.sql ##########


-- ########## BEGIN schema-phase5-tenant.sql ##########


-- =============================================================================
-- Phase 5: Multi-tenant (companies + company_id)
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- company_id カラム追加（既存 DB 向けマイグレーション）
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE handover_items ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE responsible_persons ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE file_connections ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);

-- departments.code を company 内ユニークに（既存 UNIQUE 制約がある場合は手動調整）
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_company_code ON departments(company_id, code);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_company ON knowledge_items(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);

-- テナントヘルパー
CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM users WHERE id = auth.uid() AND is_active = TRUE),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.same_company(row_company_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin() OR row_company_id = current_user_company_id();
$$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_super_admin ON companies;
CREATE POLICY companies_super_admin ON companies FOR ALL TO authenticated
  USING (is_super_admin());

DROP POLICY IF EXISTS companies_read_own ON companies;
CREATE POLICY companies_read_own ON companies FOR SELECT TO authenticated
  USING (id = current_user_company_id());

-- 既存テーブル RLS に company_id 条件を追加（例: knowledge_items）
DROP POLICY IF EXISTS knowledge_select ON knowledge_items;
CREATE POLICY knowledge_select ON knowledge_items FOR SELECT TO authenticated
  USING (
    same_company(company_id)
    AND (
      classification = 'internal'
      OR (
        classification = 'department'
        AND (
          department_id = current_user_department()
          OR current_user_role() IN ('manager', 'executive', 'admin')
        )
      )
      OR (
        classification = 'confidential'
        AND current_user_role() IN ('manager', 'executive', 'admin')
      )
      OR (
        classification = 'executive_only'
        AND current_user_role() IN ('executive', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS knowledge_write ON knowledge_items;
CREATE POLICY knowledge_write ON knowledge_items FOR ALL TO authenticated
  USING (
    same_company(company_id)
    AND current_user_role() IN ('manager', 'executive', 'admin')
  );

-- users: 自社のみ（super_admin は全社閲覧可）
DROP POLICY IF EXISTS users_read_self ON users;
CREATE POLICY users_read_self ON users FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (
      company_id = current_user_company_id()
      AND (id = auth.uid() OR current_user_role() IN ('admin', 'manager', 'executive'))
    )
  );

DROP POLICY IF EXISTS users_admin_write ON users;
CREATE POLICY users_admin_write ON users FOR ALL TO authenticated
  USING (
    (current_user_role() = 'admin' AND company_id = current_user_company_id())
    OR is_super_admin()
  );

-- Seed demo company
INSERT INTO companies (id, name, slug, plan, status) VALUES
  ('demo-company', 'デモ株式会社', 'demo-company', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (name, label, description) VALUES
  ('super_admin', 'SORT運営', '全テナント管理')
ON CONFLICT (name) DO NOTHING;

-- ########## END schema-phase5-tenant.sql ##########


-- ########## BEGIN schema-phase6-security.sql ##########

-- SORT Gateway v2.1 Enterprise — Phase 6: Security Hardening
-- schema.sql + schema-phase5-tenant.sql の後に実行

-- audit_logs 強化
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result TEXT NOT NULL DEFAULT 'success';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- token_passes: 平文 code → token_hash 移行
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS allowed_roles user_role[] DEFAULT ARRAY['employee','manager','executive','admin']::user_role[];
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE token_passes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 既存 code をハッシュ化（PostgreSQL pgcrypto またはアプリ側で移行後に実行）
-- UPDATE token_passes SET token_hash = encode(digest(upper(trim(code)), 'sha256'), 'hex') WHERE token_hash IS NULL AND code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_token_hash ON token_passes(token_hash) WHERE token_hash IS NOT NULL;

-- code 列は移行完了後に削除推奨:
-- ALTER TABLE token_passes DROP COLUMN IF EXISTS code;

COMMENT ON COLUMN token_passes.token_hash IS 'SHA-256 hex of uppercase trimmed plain token. Never store plain text.';
COMMENT ON COLUMN audit_logs.result IS 'success | failure';
COMMENT ON COLUMN audit_logs.user_agent IS 'HTTP User-Agent at time of action';

-- ########## END schema-phase6-security.sql ##########


-- ########## BEGIN schema-phase7-lifecycle.sql ##########

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

-- ########## END schema-phase7-lifecycle.sql ##########


-- ########## BEGIN schema-phase8-integrations.sql ##########

-- SORT Gateway v2.1 Enterprise — Phase 8: External Integrations
-- schema-phase7-lifecycle.sql の後に実行

CREATE TYPE integration_provider AS ENUM (
  'google_drive',
  'microsoft_365',
  'slack',
  'teams',
  'notion',
  'box'
);

CREATE TYPE integration_connection_status AS ENUM (
  'not_connected',
  'connected',
  'syncing',
  'error',
  'disabled'
);

CREATE TYPE integration_sync_status AS ENUM ('running', 'success', 'partial', 'failed');
CREATE TYPE integration_sync_type AS ENUM ('manual', 'scheduled');

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id),
  provider integration_provider NOT NULL,
  status integration_connection_status NOT NULL DEFAULT 'not_connected',
  display_name TEXT NOT NULL,
  config_json JSONB NOT NULL DEFAULT '{}',
  encrypted_credentials TEXT,
  last_sync_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_company ON integration_connections(company_id);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id TEXT NOT NULL REFERENCES companies(id),
  connection_id UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  sync_type integration_sync_type NOT NULL DEFAULT 'manual',
  status integration_sync_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  scanned_count INT NOT NULL DEFAULT 0,
  imported_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_company ON integration_sync_logs(company_id, started_at DESC);

COMMENT ON COLUMN integration_connections.encrypted_credentials IS 'KMS/AES で暗号化した認証情報。平文は保存しない';
COMMENT ON COLUMN integration_connections.config_json IS 'sync_target, enabled, 集計キャッシュ等';

-- ########## END schema-phase8-integrations.sql ##########


-- ########## BEGIN schema-phase9-scheduling.sql ##########

-- SORT Gateway v2.1 Enterprise — Phase 9: Integration Sync Scheduling
-- schema-phase8-integrations.sql の後に実行

CREATE TYPE integration_sync_frequency AS ENUM ('manual', 'hourly', 'daily', 'weekly');

ALTER TABLE integration_connections
  ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_frequency integration_sync_frequency NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_error_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_integration_connections_due_sync
  ON integration_connections (next_sync_at)
  WHERE sync_enabled = true AND status NOT IN ('disabled', 'not_connected');

COMMENT ON COLUMN integration_connections.sync_enabled IS '定期同期の ON/OFF';
COMMENT ON COLUMN integration_connections.sync_frequency IS 'manual / hourly / daily / weekly';
COMMENT ON COLUMN integration_connections.next_sync_at IS '次回定期同期予定時刻';
COMMENT ON COLUMN integration_connections.consecutive_error_count IS '連続失敗回数（3回で error）';

-- ########## END schema-phase9-scheduling.sql ##########


-- ########## BEGIN schema-phase10-analytics.sql ##########

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

-- ########## END schema-phase10-analytics.sql ##########


-- ########## BEGIN schema-phase12-production.sql ##########

-- =============================================================================
-- Phase 12: Production infrastructure (schema version + storage)
-- production-setup.sql の最終セクションとして実行
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.schema_migrations (version, description) VALUES
  ('phase3', 'Base schema (users, knowledge, RLS)'),
  ('phase5', 'Multi-tenant (companies, company_id)'),
  ('phase6', 'Security (audit, token_pass hash)'),
  ('phase7', 'Knowledge lifecycle (approval, feedback)'),
  ('phase8', 'External integrations'),
  ('phase9', 'Scheduled sync columns'),
  ('phase10', 'Analytics chat_logs extensions')
ON CONFLICT (version) DO NOTHING;

-- Storage bucket（ドキュメントアップロード必須）
-- 既存バケットがある場合はスキップ
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- 認証ユーザーの documents バケットアクセス（service_role 経由のアップロードは RLS バイパス）
-- アプリは service_role で Storage に書き込むため、追加ポリシーは任意

COMMENT ON TABLE public.schema_migrations IS 'SORT Gateway DB schema version tracker — /api/ready で phase10 を検証';

-- ########## END schema-phase12-production.sql ##########

