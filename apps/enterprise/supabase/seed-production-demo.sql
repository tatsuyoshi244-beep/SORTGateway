-- =============================================================================
-- SORT Gateway v2.1 Enterprise — Production Demo Seed
-- =============================================================================
-- 前提: production-setup.sql 適用済み
--
-- 手順:
--   1. Supabase Dashboard → Authentication → Users で以下ユーザーを作成
--      - superadmin@your-domain.com  (SORT 運営)
--      - admin@your-domain.com       (テナント管理者)
--   2. 作成された UUID を控える（Users 一覧の ID 列）
--   3. 下記のプレースホルダーを実 UUID に置換して SQL Editor で実行
--   4. 初回ログイン後、パスワード変更を推奨
--   5. サンプルドキュメントの Storage ファイルはアプリからアップロード
-- =============================================================================

-- プレースホルダー（実行前に必ず置換）
-- :SUPER_ADMIN_AUTH_UUID  — superadmin の auth.users.id
-- :ADMIN_AUTH_UUID        — admin の auth.users.id

-- -----------------------------------------------------------------------------
-- 1. 企業（テナント）
-- -----------------------------------------------------------------------------
INSERT INTO companies (id, name, slug, plan, status)
VALUES
  ('platform', 'SORT Platform', 'platform', 'platform', 'active'),
  ('demo-company', 'デモ株式会社', 'demo-company', 'standard', 'active')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 2. 部署
-- -----------------------------------------------------------------------------
INSERT INTO departments (company_id, name, code)
VALUES
  ('demo-company', '営業部', 'SALES'),
  ('demo-company', '経営企画', 'CORP')
ON CONFLICT DO NOTHING;

-- 既存 code UNIQUE 制約がある場合、company_id 付きで再投入:
-- DELETE FROM departments WHERE company_id = 'demo-company';
-- INSERT INTO departments (company_id, name, code) VALUES ...

-- -----------------------------------------------------------------------------
-- 3. super_admin（SORT 運営）
-- -----------------------------------------------------------------------------
UPDATE public.users
SET
  company_id = 'platform',
  role = 'super_admin',
  full_name = 'SORT 運営管理者',
  is_active = TRUE
WHERE id = ':SUPER_ADMIN_AUTH_UUID';

-- -----------------------------------------------------------------------------
-- 4. テナント admin
-- -----------------------------------------------------------------------------
UPDATE public.users
SET
  company_id = 'demo-company',
  role = 'admin',
  full_name = 'デモ 管理者',
  department_id = (
    SELECT id FROM departments
    WHERE company_id = 'demo-company' AND code = 'CORP'
    LIMIT 1
  ),
  is_active = TRUE
WHERE id = ':ADMIN_AUTH_UUID';

-- -----------------------------------------------------------------------------
-- 5. サンプルナレッジ（公開済み）
-- -----------------------------------------------------------------------------
INSERT INTO knowledge_items (
  company_id,
  title,
  content,
  summary,
  category,
  classification,
  department_id,
  tags,
  created_by,
  approval_status,
  version
)
SELECT
  'demo-company',
  '営業活動ガイドライン 2026',
  '見積提出から受注までの標準フロー、承認ルート、禁止事項を定めます。50万円以上の見積は部長承認が必要です。',
  '営業活動の標準フローと承認ルート',
  '規定・ルール',
  'internal',
  d.id,
  ARRAY['営業', 'ガイドライン'],
  ':ADMIN_AUTH_UUID'::uuid,
  'published',
  1
FROM departments d
WHERE d.company_id = 'demo-company' AND d.code = 'SALES'
ON CONFLICT DO NOTHING;

INSERT INTO knowledge_items (
  company_id,
  title,
  content,
  summary,
  category,
  classification,
  department_id,
  tags,
  created_by,
  approval_status,
  version
)
SELECT
  'demo-company',
  '営業部 顧客対応FAQ',
  'よくある問い合わせと標準回答テンプレート集。',
  '顧客対応のFAQとテンプレート',
  'FAQ',
  'department',
  d.id,
  ARRAY['FAQ', '顧客対応'],
  ':ADMIN_AUTH_UUID'::uuid,
  'published',
  1
FROM departments d
WHERE d.company_id = 'demo-company' AND d.code = 'SALES'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. サンプルドキュメント（メタデータのみ）
--    実ファイルは /admin/documents からアップロードするか、
--    Storage の documents バケットに配置後 storage_path を更新
-- -----------------------------------------------------------------------------
INSERT INTO documents (
  company_id,
  title,
  filename,
  mime_type,
  size_bytes,
  storage_path,
  status,
  classification,
  uploaded_by
)
VALUES (
  'demo-company',
  '就業規則サンプル',
  'employment-rules-sample.txt',
  'text/plain',
  1024,
  'seed/employment-rules-sample.txt',
  'ready',
  'internal',
  ':ADMIN_AUTH_UUID'::uuid
)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. デモ用トークンパス（任意・本番ではランダムコードを推奨）
-- -----------------------------------------------------------------------------
INSERT INTO token_passes (
  company_id,
  code,
  label,
  classification_scope,
  issued_to,
  issued_by,
  expires_at,
  is_active,
  max_uses
)
VALUES (
  'demo-company',
  'EXEC-2026-Q2-A1B2',
  '役員向けデモパス',
  ARRAY['executive_only', 'confidential']::info_classification[],
  '役員デモ',
  ':ADMIN_AUTH_UUID'::uuid,
  NOW() + INTERVAL '90 days',
  TRUE,
  100
)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 確認クエリ
-- -----------------------------------------------------------------------------
-- SELECT id, email, role, company_id FROM users WHERE id IN (':SUPER_ADMIN_AUTH_UUID', ':ADMIN_AUTH_UUID');
-- SELECT id, title, approval_status FROM knowledge_items WHERE company_id = 'demo-company';
-- SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1;
