'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, ScrollText } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';
import { formatSyncDuration, syncDurationMs } from '@/lib/integrations/sync-schedule';
import type { IntegrationSyncLog } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

const SYNC_STATUS_LABELS: Record<IntegrationSyncLog['status'], string> = {
  running: '実行中',
  success: '成功',
  partial: '一部成功',
  failed: '失敗',
};

const SYNC_TYPE_LABELS: Record<IntegrationSyncLog['sync_type'], string> = {
  manual: '手動',
  scheduled: '定期',
};

const STATUS_CLASS: Record<IntegrationSyncLog['status'], string> = {
  running: 'bg-blue-50 text-blue-700',
  success: 'bg-green-50 text-green-700',
  partial: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};

export default function IntegrationLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/integrations/sync-logs');
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RouteGuard route="admin_integrations_logs">
      <div>
        <div className="mb-4">
          <Link href="/admin/integrations">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              外部連携に戻る
            </Button>
          </Link>
        </div>

        <PageHeader
          title="同期ログ詳細"
          description="外部連携の同期実行履歴（手動・定期）"
        />

        <Card>
          <CardBody>
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
              <ScrollText className="h-4 w-4" />
              同期ログ一覧
            </h3>

            {loading ? (
              <p className="text-sm text-slate-500">読み込み中...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-slate-500">同期ログはまだありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">開始</th>
                      <th className="px-4 py-2">終了</th>
                      <th className="px-4 py-2">実行時間</th>
                      <th className="px-4 py-2">プロバイダー</th>
                      <th className="px-4 py-2">種別</th>
                      <th className="px-4 py-2">結果</th>
                      <th className="px-4 py-2">スキャン</th>
                      <th className="px-4 py-2">取込</th>
                      <th className="px-4 py-2">スキップ</th>
                      <th className="px-4 py-2">エラー</th>
                      <th className="px-4 py-2">メッセージ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const duration = syncDurationMs(log.started_at, log.finished_at);
                      return (
                        <tr key={log.id} className="border-b border-slate-50">
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                            {formatDate(log.started_at)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                            {log.finished_at ? formatDate(log.finished_at) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-400" />
                              {formatSyncDuration(duration)}
                            </span>
                          </td>
                          <td className="px-4 py-2">{INTEGRATION_PROVIDER_LABELS[log.provider]}</td>
                          <td className="px-4 py-2">{SYNC_TYPE_LABELS[log.sync_type]}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[log.status]}`}
                            >
                              {SYNC_STATUS_LABELS[log.status]}
                            </span>
                          </td>
                          <td className="px-4 py-2">{log.scanned_count}</td>
                          <td className="px-4 py-2 text-green-700">{log.imported_count}</td>
                          <td className="px-4 py-2">{log.skipped_count}</td>
                          <td className="px-4 py-2 text-red-600">{log.error_count}</td>
                          <td className="max-w-xs px-4 py-2 text-xs text-slate-500">
                            {log.error_message ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </RouteGuard>
  );
}
