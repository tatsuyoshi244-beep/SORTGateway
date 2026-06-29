
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
