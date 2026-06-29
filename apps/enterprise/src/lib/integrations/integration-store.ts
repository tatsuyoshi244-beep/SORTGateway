import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  IntegrationConnection,
  IntegrationConnectionConfig,
  IntegrationProvider,
  IntegrationSyncFrequency,
  IntegrationSyncLog,
  IntegrationSyncStatus,
  IntegrationSyncSummary,
} from '@/types';
import {
  MOCK_INTEGRATION_CONNECTIONS,
  MOCK_INTEGRATION_SYNC_LOGS,
  publicConnections,
  defaultConfig,
  defaultScheduleFields,
  buildIntegrationSyncSummary,
  type StoredConnection,
} from '@/lib/mock-integrations';
import { encryptCredentials } from '@/lib/integrations/crypto';
import { computeNextSyncAt } from '@/lib/integrations/sync-schedule';

const STORE_FILE = 'integrations-store.json';

interface IntegrationsStore {
  connections: StoredConnection[];
  sync_logs: IntegrationSyncLog[];
}

function storePath(): string {
  return path.join(process.cwd(), '.data', STORE_FILE);
}

async function readStore(): Promise<IntegrationsStore> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    const parsed = JSON.parse(raw) as IntegrationsStore;
    parsed.connections = parsed.connections.map(normalizeConnection);
    return parsed;
  } catch {
    return {
      connections: [...MOCK_INTEGRATION_CONNECTIONS],
      sync_logs: [...MOCK_INTEGRATION_SYNC_LOGS],
    };
  }
}

function normalizeConnection(conn: StoredConnection): StoredConnection {
  const defaults = defaultScheduleFields();
  return {
    ...defaults,
    ...conn,
    sync_frequency: conn.sync_frequency ?? defaults.sync_frequency,
  };
}

async function writeStore(store: IntegrationsStore): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf-8');
}

export async function listIntegrationConnections(
  companyId: string
): Promise<IntegrationConnection[]> {
  const store = await readStore();
  return publicConnections(store.connections.filter((c) => c.company_id === companyId));
}

export async function getIntegrationSyncSummary(
  companyId: string
): Promise<IntegrationSyncSummary> {
  const connections = await listIntegrationConnections(companyId);
  return buildIntegrationSyncSummary(connections);
}

export async function listAllIntegrationConnections(): Promise<StoredConnection[]> {
  const store = await readStore();
  return store.connections;
}

export async function getIntegrationConnection(
  id: string
): Promise<StoredConnection | null> {
  const store = await readStore();
  return store.connections.find((c) => c.id === id) ?? null;
}

export async function createIntegrationConnection(input: {
  company_id: string;
  provider: IntegrationProvider;
  display_name: string;
  config_json?: Partial<IntegrationConnectionConfig>;
  credentials?: string;
  created_by: string;
  sync_enabled?: boolean;
  sync_frequency?: IntegrationSyncFrequency;
}): Promise<IntegrationConnection> {
  const store = await readStore();
  const now = new Date().toISOString();
  const existing = store.connections.find(
    (c) => c.company_id === input.company_id && c.provider === input.provider
  );
  if (existing) {
    throw new Error('このプロバイダーは既に接続されています');
  }

  const syncFrequency = input.sync_frequency ?? 'manual';
  const syncEnabled = input.sync_enabled ?? false;

  const conn: StoredConnection = {
    id: `int-${randomUUID().slice(0, 8)}`,
    company_id: input.company_id,
    provider: input.provider,
    status: input.credentials ? 'connected' : 'not_connected',
    display_name: input.display_name,
    config_json: { ...defaultConfig(input.provider), ...input.config_json },
    encrypted_credentials: input.credentials ? encryptCredentials(input.credentials) : null,
    last_sync_at: null,
    ...defaultScheduleFields(),
    sync_enabled: syncEnabled,
    sync_frequency: syncFrequency,
    next_sync_at:
      syncEnabled && syncFrequency !== 'manual' ? computeNextSyncAt(syncFrequency) : null,
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
  };

  store.connections.push(conn);
  await writeStore(store);
  return publicConnections([conn])[0];
}

export async function updateIntegrationConnection(
  id: string,
  patch: Partial<{
    status: StoredConnection['status'];
    display_name: string;
    config_json: IntegrationConnectionConfig;
    encrypted_credentials: string | null;
    last_sync_at: string | null;
    sync_enabled: boolean;
    sync_frequency: IntegrationSyncFrequency;
    next_sync_at: string | null;
    last_successful_sync_at: string | null;
    consecutive_error_count: number;
  }>
): Promise<IntegrationConnection | null> {
  const store = await readStore();
  const idx = store.connections.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  const updated: StoredConnection = {
    ...store.connections[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  store.connections[idx] = updated;
  await writeStore(store);
  return publicConnections([updated])[0];
}

export async function disconnectIntegrationConnection(
  id: string
): Promise<IntegrationConnection | null> {
  return updateIntegrationConnection(id, {
    status: 'not_connected',
    encrypted_credentials: null,
    last_sync_at: null,
    sync_enabled: false,
    sync_frequency: 'manual',
    next_sync_at: null,
    consecutive_error_count: 0,
  });
}

export async function listIntegrationSyncLogs(
  companyId: string,
  connectionId?: string
): Promise<IntegrationSyncLog[]> {
  const store = await readStore();
  return store.sync_logs
    .filter(
      (l) =>
        l.company_id === companyId &&
        (!connectionId || l.connection_id === connectionId)
    )
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export async function appendSyncLog(
  log: Omit<IntegrationSyncLog, 'id'>
): Promise<IntegrationSyncLog> {
  const store = await readStore();
  const entry: IntegrationSyncLog = { ...log, id: `isl-${randomUUID().slice(0, 8)}` };
  store.sync_logs.unshift(entry);
  if (store.sync_logs.length > 200) store.sync_logs.length = 200;
  await writeStore(store);
  return entry;
}

export function deriveSyncStatus(result: {
  error_count: number;
  imported_count: number;
}): IntegrationSyncStatus {
  if (result.error_count > 0 && result.imported_count === 0) return 'failed';
  if (result.error_count > 0) return 'partial';
  return 'success';
}

/** 定期同期対象の接続を取得 */
export async function listConnectionsDueForSync(now: Date = new Date()): Promise<StoredConnection[]> {
  const store = await readStore();
  const nowIso = now.toISOString();

  return store.connections.filter((c) => {
    if (!c.sync_enabled) return false;
    if (c.sync_frequency === 'manual') return false;
    if (c.status === 'disabled' || c.status === 'not_connected') return false;
    if (!c.encrypted_credentials) return false;
    if (!c.config_json.enabled) return false;
    if (c.status === 'syncing') return false;
    if (!c.next_sync_at) return true;
    return c.next_sync_at <= nowIso;
  });
}

export type { StoredConnection };
