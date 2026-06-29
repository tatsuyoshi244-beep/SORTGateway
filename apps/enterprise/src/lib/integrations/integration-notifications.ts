import type { IntegrationConnection, AppNotification } from '@/types';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';

export function buildSyncFailureNotification(
  conn: IntegrationConnection,
  errorMessage: string
): Omit<AppNotification, 'id' | 'created_at' | 'is_read'> {
  return {
    company_id: conn.company_id,
    user_id: null,
    type: 'integration_sync_failed',
    title: '外部連携の同期に失敗しました',
    message: `「${conn.display_name}」（${INTEGRATION_PROVIDER_LABELS[conn.provider]}）: ${errorMessage}`,
    resource_type: 'integration_connection',
    resource_id: conn.id,
  };
}

export function buildSyncCriticalNotification(
  conn: IntegrationConnection
): Omit<AppNotification, 'id' | 'created_at' | 'is_read'> {
  return {
    company_id: conn.company_id,
    user_id: null,
    type: 'integration_sync_critical',
    title: '【要対応】外部連携が連続失敗しています',
    message: `「${conn.display_name}」が ${conn.consecutive_error_count} 回連続で同期に失敗しました。接続設定を確認してください。`,
    resource_type: 'integration_connection',
    resource_id: conn.id,
  };
}

export function buildSyncSuccessNotification(
  conn: IntegrationConnection,
  importedCount: number,
  updatedCount: number
): Omit<AppNotification, 'id' | 'created_at' | 'is_read'> {
  const parts: string[] = [];
  if (importedCount > 0) parts.push(`新規 ${importedCount} 件`);
  if (updatedCount > 0) parts.push(`更新 ${updatedCount} 件`);
  const detail = parts.length > 0 ? parts.join('、') : '変更なし';

  return {
    company_id: conn.company_id,
    user_id: null,
    type: 'integration_sync_success',
    title: '外部連携の同期が完了しました',
    message: `「${conn.display_name}」（${INTEGRATION_PROVIDER_LABELS[conn.provider]}）: ${detail}を documents に反映しました`,
    resource_type: 'integration_connection',
    resource_id: conn.id,
  };
}

export function buildDocumentUpdatedNotification(
  companyId: string,
  title: string,
  documentId: string,
  provider: string
): Omit<AppNotification, 'id' | 'created_at' | 'is_read'> {
  return {
    company_id: companyId,
    user_id: null,
    type: 'system',
    title: '同期ドキュメントが更新されました',
    message: `「${title}」が ${provider} から再同期され、AI検索対象を更新しました`,
    resource_type: 'document',
    resource_id: documentId,
  };
}
