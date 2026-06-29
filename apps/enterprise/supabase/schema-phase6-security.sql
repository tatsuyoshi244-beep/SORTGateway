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
