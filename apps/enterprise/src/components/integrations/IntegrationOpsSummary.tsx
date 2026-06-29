'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import type { IntegrationSyncSummary } from '@/types';
import { Card, CardBody } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';

export function IntegrationOpsSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<IntegrationSyncSummary | null>(null);

  useEffect(() => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) return;
    apiFetch(user, '/api/integrations')
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) setSummary(data.summary);
      })
      .catch(() => {});
  }, [user]);

  if (!user || !['admin', 'super_admin'].includes(user.role)) return null;
  if (!summary) return null;

  return (
    <Card className="mt-6 max-w-2xl">
      <CardBody>
        <h3 className="font-semibold text-slate-900">定期同期の運用状態</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-50 pb-2">
            <dt className="text-slate-600">定期同期が有効な連携</dt>
            <dd className="font-medium text-slate-900">{summary.scheduled_enabled_count} 件</dd>
          </div>
          <div className="flex justify-between border-b border-slate-50 pb-2">
            <dt className="text-slate-600">エラー中の連携</dt>
            <dd
              className={`font-medium ${summary.error_connection_count > 0 ? 'text-red-600' : 'text-slate-900'}`}
            >
              {summary.error_connection_count} 件
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">最終同期日時</dt>
            <dd className="font-medium text-slate-900">
              {summary.last_sync_at ? formatDate(summary.last_sync_at) : '—'}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-400">
          詳細は{' '}
          <Link href="/admin/integrations" className="text-navy-600 underline">
            外部連携管理
          </Link>{' '}
          /{' '}
          <Link href="/admin/integrations/logs" className="text-navy-600 underline">
            同期ログ
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
