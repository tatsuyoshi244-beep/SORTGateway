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
