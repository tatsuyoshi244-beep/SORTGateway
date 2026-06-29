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
