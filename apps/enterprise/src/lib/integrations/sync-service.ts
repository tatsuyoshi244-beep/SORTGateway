import type { SessionUser } from '@/types';
import { decryptCredentials } from '@/lib/integrations/crypto';
import { getIntegrationAdapter } from '@/lib/integrations/registry';
import {
  appendSyncLog,
  deriveSyncStatus,
  getIntegrationConnection,
  updateIntegrationConnection,
  type StoredConnection,
} from '@/lib/integrations/integration-store';
import { publicConnections } from '@/lib/mock-integrations';
import { upsertSyncedDocument } from '@/lib/documents/document-store';
import { recordAuditLog } from '@/lib/audit';
import { computeNextSyncAt } from '@/lib/integrations/sync-schedule';
import { createNotification } from '@/lib/knowledge/lifecycle-store';
import {
  buildSyncCriticalNotification,
  buildSyncFailureNotification,
  buildSyncSuccessNotification,
  buildDocumentUpdatedNotification,
} from '@/lib/integrations/integration-notifications';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';

const MAX_CONSECUTIVE_ERRORS = 3;

export interface RunSyncOptions {
  connectionId: string;
  companyId: string;
  user: SessionUser;
  syncType?: 'manual' | 'scheduled';
  ip?: string | null;
  userAgent?: string | null;
}

export interface RunSyncResult {
  log_id: string;
  scanned_count: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  document_ids: string[];
  new_count: number;
  updated_count: number;
}

function syncTypeLabel(syncType: 'manual' | 'scheduled'): string {
  return syncType === 'scheduled' ? '定期同期' : '手動同期';
}

async function handleSyncFailure(
  conn: StoredConnection,
  opts: RunSyncOptions,
  errorMessage: string,
  startedAt: string
): Promise<void> {
  const newErrorCount = (conn.consecutive_error_count ?? 0) + 1;
  const newStatus = newErrorCount >= MAX_CONSECUTIVE_ERRORS ? 'error' : 'connected';

  const updatedConn = await updateIntegrationConnection(conn.id, {
    status: newStatus,
    consecutive_error_count: newErrorCount,
    next_sync_at:
      conn.sync_enabled && conn.sync_frequency !== 'manual'
        ? computeNextSyncAt(conn.sync_frequency)
        : null,
  });

  await appendSyncLog({
    company_id: opts.companyId,
    connection_id: conn.id,
    provider: conn.provider,
    sync_type: opts.syncType ?? 'manual',
    status: 'failed',
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    scanned_count: 0,
    imported_count: 0,
    skipped_count: 0,
    error_count: 1,
    error_message: errorMessage,
  });

  const publicConn =
    updatedConn ??
    publicConnections([
      {
        ...conn,
        consecutive_error_count: newErrorCount,
        status: newStatus,
      },
    ])[0];

  await createNotification(buildSyncFailureNotification(publicConn, errorMessage));

  if (newErrorCount >= MAX_CONSECUTIVE_ERRORS) {
    await createNotification(buildSyncCriticalNotification(publicConn));
  }

  await recordAuditLog({
    userId: opts.user.id,
    userName: opts.user.full_name,
    companyId: opts.companyId,
    action: 'integration.sync',
    resourceType: 'integration_connection',
    resourceId: conn.id,
    result: 'failure',
    details: `${syncTypeLabel(opts.syncType ?? 'manual')}失敗: ${conn.display_name} — ${errorMessage}`,
    ipAddress: opts.ip,
    userAgent: opts.userAgent,
  });
}

export async function runIntegrationSync(
  opts: RunSyncOptions
): Promise<RunSyncResult> {
  const conn = await getIntegrationConnection(opts.connectionId);
  if (!conn || conn.company_id !== opts.companyId) {
    throw new Error('連携が見つかりません');
  }
  if (conn.status === 'disabled') {
    throw new Error('連携が無効化されています');
  }
  if (!conn.config_json.enabled) {
    throw new Error('連携が無効です。設定で有効化してください');
  }

  const startedAt = new Date().toISOString();
  const syncType = opts.syncType ?? 'manual';
  await updateIntegrationConnection(conn.id, { status: 'syncing' });

  const adapter = getIntegrationAdapter(conn.provider);
  const credentials = decryptCredentials(conn.encrypted_credentials);
  const documentIds: string[] = [];
  let newCount = 0;
  let updatedCount = 0;

  try {
    const syncResult = await adapter.sync(
      conn.config_json as unknown as Record<string, unknown>,
      credentials
    );

    for (const item of syncResult.items) {
      const result = await upsertSyncedDocument({
        company_id: opts.companyId,
        title: item.title,
        filename: item.filename,
        content: item.content,
        source_path: item.source_path,
        owner_id: opts.user.id,
        owner_name: opts.user.full_name,
        source_provider: conn.provider,
      });
      documentIds.push(result.document.id);
      if (result.is_new) newCount += 1;
      else if (result.content_changed) {
        updatedCount += 1;
        await createNotification(
          buildDocumentUpdatedNotification(
            opts.companyId,
            item.title,
            result.document.id,
            INTEGRATION_PROVIDER_LABELS[conn.provider]
          )
        );
      }
    }

    const status = deriveSyncStatus(syncResult);
    const finishedAt = new Date().toISOString();
    const isFullFailure = status === 'failed';

    const log = await appendSyncLog({
      company_id: opts.companyId,
      connection_id: conn.id,
      provider: conn.provider,
      sync_type: syncType,
      status,
      started_at: startedAt,
      finished_at: finishedAt,
      scanned_count: syncResult.scanned_count,
      imported_count: syncResult.imported_count,
      skipped_count: syncResult.skipped_count,
      error_count: syncResult.error_count,
      error_message: syncResult.errors.join('; ') || null,
    });

    let consecutiveErrors = conn.consecutive_error_count ?? 0;
    if (isFullFailure) {
      consecutiveErrors += 1;
    } else {
      consecutiveErrors = 0;
    }

    const connectionStatus =
      consecutiveErrors >= MAX_CONSECUTIVE_ERRORS
        ? 'error'
        : isFullFailure
          ? 'connected'
          : 'connected';

    const updatedConn = await updateIntegrationConnection(conn.id, {
      status: connectionStatus,
      last_sync_at: finishedAt,
      last_successful_sync_at: isFullFailure ? conn.last_successful_sync_at : finishedAt,
      consecutive_error_count: consecutiveErrors,
      next_sync_at:
        conn.sync_enabled && conn.sync_frequency !== 'manual'
          ? computeNextSyncAt(conn.sync_frequency)
          : null,
      config_json: {
        ...conn.config_json,
        scanned_count: syncResult.scanned_count,
        imported_count: syncResult.imported_count,
        error_count: syncResult.error_count,
      },
    });

    if (isFullFailure && syncResult.errors.length > 0) {
      const publicConn = updatedConn ?? publicConnections([conn])[0];
      await createNotification(
        buildSyncFailureNotification(publicConn, syncResult.errors.join('; '))
      );
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        await createNotification(buildSyncCriticalNotification(publicConn));
      }
    }

    if (!isFullFailure && (newCount > 0 || updatedCount > 0)) {
      const publicConn = updatedConn ?? publicConnections([conn])[0];
      await createNotification(
        buildSyncSuccessNotification(publicConn, newCount, updatedCount)
      );
    }

    await recordAuditLog({
      userId: opts.user.id,
      userName: opts.user.full_name,
      companyId: opts.companyId,
      action: 'integration.sync',
      resourceType: 'integration_connection',
      resourceId: conn.id,
      result: status === 'failed' ? 'failure' : 'success',
      details: `${syncTypeLabel(syncType)}: ${conn.display_name}（新規 ${newCount} / 更新 ${updatedCount} / 取込 ${syncResult.imported_count}）`,
      ipAddress: opts.ip,
      userAgent: opts.userAgent,
    });

    return {
      log_id: log.id,
      scanned_count: syncResult.scanned_count,
      imported_count: syncResult.imported_count,
      skipped_count: syncResult.skipped_count,
      error_count: syncResult.error_count,
      document_ids: documentIds,
      new_count: newCount,
      updated_count: updatedCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '同期に失敗しました';
    await handleSyncFailure(conn, opts, msg, startedAt);
    throw err;
  }
}

export async function testIntegrationConnection(
  conn: StoredConnection
): Promise<{ ok: boolean; message: string }> {
  const adapter = getIntegrationAdapter(conn.provider);
  const credentials = decryptCredentials(conn.encrypted_credentials);
  return adapter.testConnection(conn.config_json as unknown as Record<string, unknown>, credentials);
}
