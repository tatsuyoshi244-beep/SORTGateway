'use client';

import { useAuth } from '@/lib/auth-context';
import { filterByCompany } from '@/lib/tenant/filter';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { fetchAuditLogs } from '@/lib/repositories';
import { MOCK_AUDIT_LOGS } from '@/lib/mock-data';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminAuditPage() {
  const { user, effectiveCompanyId } = useAuth();
  const { data: logs, loading, source } = useRepositoryData(
    `audit-${effectiveCompanyId}`,
    () => fetchAuditLogs(effectiveCompanyId),
    filterByCompany(MOCK_AUDIT_LOGS, effectiveCompanyId)
  );

  return (
    <RouteGuard route="admin_audit">
      <div>
        <PageHeader
          title="監査ログ"
          description="ユーザー操作・トークン利用・権限変更などの監査記録"
        />

        {user?.role === 'manager' && source === 'supabase' && (
          <p className="mb-4 text-sm text-slate-500">
            責任者ロールでは、同一部署のユーザーの操作ログのみ表示されます（RLS）。
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">監査ログを読み込んでいます...</p>
        ) : logs.length === 0 ? (
          <EmptyState title="監査ログがありません" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">日時</th>
                    <th className="px-6 py-3">ユーザー</th>
                    <th className="px-6 py-3">アクション</th>
                    <th className="px-6 py-3">リソース</th>
                    <th className="px-6 py-3">詳細</th>
                    <th className="px-6 py-3">結果</th>
                    <th className="px-6 py-3">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-600">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900">{log.user_name}</td>
                      <td className="px-6 py-3 font-mono text-xs text-navy-700">{log.action}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {log.resource_type}
                        {log.resource_id && ` #${log.resource_id}`}
                      </td>
                      <td className="max-w-xs px-6 py-3 text-slate-600">{log.details}</td>
                      <td className="px-6 py-3">
                        <span
                          className={
                            log.result === 'success'
                              ? 'text-xs font-medium text-green-700'
                              : 'text-xs font-medium text-red-600'
                          }
                        >
                          {log.result ?? 'success'}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400">
                        {log.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
