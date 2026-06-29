import {
  listConnectionsDueForSync,
  type StoredConnection,
} from '@/lib/integrations/integration-store';
import { runIntegrationSync } from '@/lib/integrations/sync-service';
import { buildSystemSyncUser } from '@/lib/integrations/system-user';

export interface ScheduledSyncJobResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: Array<{
    connection_id: string;
    company_id: string;
    provider: string;
    status: 'success' | 'failed';
    imported_count?: number;
    error?: string;
  }>;
}

/** 期限到来の integration_connections を一括同期 */
export async function runScheduledIntegrationSyncs(
  now: Date = new Date()
): Promise<ScheduledSyncJobResult> {
  const due = await listConnectionsDueForSync(now);
  const results: ScheduledSyncJobResult['results'] = [];
  let succeeded = 0;
  let failed = 0;

  for (const conn of due) {
    try {
      const result = await runIntegrationSync({
        connectionId: conn.id,
        companyId: conn.company_id,
        user: buildSystemSyncUser(conn.company_id),
        syncType: 'scheduled',
      });
      succeeded += 1;
      results.push({
        connection_id: conn.id,
        company_id: conn.company_id,
        provider: conn.provider,
        status: 'success',
        imported_count: result.imported_count,
      });
    } catch (err) {
      failed += 1;
      results.push({
        connection_id: conn.id,
        company_id: conn.company_id,
        provider: conn.provider,
        status: 'failed',
        error: err instanceof Error ? err.message : '同期失敗',
      });
    }
  }

  return {
    processed: due.length,
    succeeded,
    failed,
    results,
  };
}

export type { StoredConnection };
