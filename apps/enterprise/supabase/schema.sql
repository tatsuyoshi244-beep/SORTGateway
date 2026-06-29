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
