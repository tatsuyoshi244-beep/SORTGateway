import type {
  IntegrationConnection,
  IntegrationConnectionConfig,
  IntegrationProvider,
  IntegrationSyncLog,
  IntegrationSyncSummary,
} from '@/types';
import { DEMO_COMPANY_ID } from '@/lib/tenant/constants';
import { encryptCredentials } from '@/lib/integrations/crypto';
import { computeNextSyncAt } from '@/lib/integrations/sync-schedule';

const C = DEMO_COMPANY_ID;
const NOW = '2026-06-01T10:00:00Z';

interface StoredConnection extends Omit<IntegrationConnection, 'has_credentials'> {
  encrypted_credentials: string | null;
}

function toPublic(conn: StoredConnection): IntegrationConnection {
  const { encrypted_credentials, ...rest } = conn;
  void encrypted_credentials;
  return {
    ...rest,
    has_credentials: Boolean(conn.encrypted_credentials),
  };
}

export const MOCK_INTEGRATION_CONNECTIONS: StoredConnection[] = [
  {
    id: 'int-gdrive',
    company_id: C,
    provider: 'google_drive',
    status: 'connected',
    display_name: '本社 Google Drive',
    config_json: {
      sync_target: '/Shared/社内規程',
      enabled: true,
      scanned_count: 12,
      imported_count: 8,
      error_count: 0,
    },
    encrypted_credentials: encryptCredentials('mock-oauth-token-gdrive'),
    last_sync_at: '2026-05-28T14:00:00Z',
    sync_enabled: true,
    sync_frequency: 'daily',
    next_sync_at: computeNextSyncAt('daily', new Date('2026-05-28T14:00:00Z')),
    last_successful_sync_at: '2026-05-28T14:00:00Z',
    consecutive_error_count: 0,
    created_by: 'user-4',
    created_at: NOW,
    updated_at: '2026-05-28T14:00:00Z',
  },
  {
    id: 'int-m365',
    company_id: C,
    provider: 'microsoft_365',
    status: 'connected',
    display_name: 'SharePoint 営業部',
    config_json: {
      sync_target: '/sites/sales/Documents',
      enabled: true,
      scanned_count: 24,
      imported_count: 15,
      error_count: 1,
    },
    encrypted_credentials: encryptCredentials('mock-oauth-token-m365'),
    last_sync_at: '2026-05-30T09:00:00Z',
    sync_enabled: true,
    sync_frequency: 'weekly',
    next_sync_at: computeNextSyncAt('weekly', new Date('2026-05-30T09:00:00Z')),
    last_successful_sync_at: '2026-05-30T09:00:00Z',
    consecutive_error_count: 0,
    created_by: 'user-4',
    created_at: NOW,
    updated_at: '2026-05-30T09:00:00Z',
  },
  {
    id: 'int-slack',
    company_id: C,
    provider: 'slack',
    status: 'error',
    display_name: 'Slack Workspace',
    config_json: {
      sync_target: '#sales, #general',
      enabled: true,
      scanned_count: 5,
      imported_count: 2,
      error_count: 3,
    },
    encrypted_credentials: encryptCredentials('mock-bot-token-slack'),
    last_sync_at: '2026-05-20T11:00:00Z',
    sync_enabled: true,
    sync_frequency: 'hourly',
    next_sync_at: null,
    last_successful_sync_at: '2026-05-15T10:00:00Z',
    consecutive_error_count: 3,
    created_by: 'user-4',
    created_at: NOW,
    updated_at: '2026-05-20T11:00:00Z',
  },
];

export const MOCK_INTEGRATION_SYNC_LOGS: IntegrationSyncLog[] = [
  {
    id: 'isl-1',
    company_id: C,
    connection_id: 'int-gdrive',
    provider: 'google_drive',
    sync_type: 'scheduled',
    status: 'success',
    started_at: '2026-05-28T13:55:00Z',
    finished_at: '2026-05-28T14:00:00Z',
    scanned_count: 12,
    imported_count: 8,
    skipped_count: 4,
    error_count: 0,
    error_message: null,
  },
  {
    id: 'isl-2',
    company_id: C,
    connection_id: 'int-slack',
    provider: 'slack',
    sync_type: 'manual',
    status: 'partial',
    started_at: '2026-05-20T11:00:00Z',
    finished_at: '2026-05-20T11:05:00Z',
    scanned_count: 5,
    imported_count: 2,
    skipped_count: 0,
    error_count: 3,
    error_message: 'チャンネル #private-sales へのアクセス権限がありません',
  },
  {
    id: 'isl-3',
    company_id: C,
    connection_id: 'int-slack',
    provider: 'slack',
    sync_type: 'scheduled',
    status: 'failed',
    started_at: '2026-05-19T08:00:00Z',
    finished_at: '2026-05-19T08:01:00Z',
    scanned_count: 0,
    imported_count: 0,
    skipped_count: 0,
    error_count: 1,
    error_message: 'Slack API タイムアウト（モック）',
  },
];

export function publicConnections(conns: StoredConnection[]): IntegrationConnection[] {
  return conns.map(toPublic);
}

export type { StoredConnection };

export function defaultConfig(provider: IntegrationProvider): IntegrationConnectionConfig {
  const targets: Record<IntegrationProvider, string> = {
    google_drive: '/My Drive/社内資料',
    microsoft_365: '/sites/company/Shared Documents',
    slack: '#general',
    teams: '全社チャネル / Files',
    notion: '社内Wiki',
    box: '/All Files/Company',
  };
  return { sync_target: targets[provider], enabled: true, scanned_count: 0, imported_count: 0, error_count: 0 };
}

export function defaultScheduleFields() {
  return {
    sync_enabled: false,
    sync_frequency: 'manual' as const,
    next_sync_at: null as string | null,
    last_successful_sync_at: null as string | null,
    consecutive_error_count: 0,
  };
}

export function buildIntegrationSyncSummary(
  connections: IntegrationConnection[]
): IntegrationSyncSummary {
  const scheduled = connections.filter(
    (c) => c.sync_enabled && c.sync_frequency !== 'manual' && c.status !== 'disabled'
  );
  const errors = connections.filter((c) => c.status === 'error');
  const lastSync = connections
    .map((c) => c.last_sync_at)
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  return {
    scheduled_enabled_count: scheduled.length,
    error_connection_count: errors.length,
    last_sync_at: lastSync,
  };
}
