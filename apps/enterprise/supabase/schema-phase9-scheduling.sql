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
