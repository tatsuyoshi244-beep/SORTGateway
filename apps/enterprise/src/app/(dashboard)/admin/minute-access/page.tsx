'use client';

import Link from 'next/link';
import { Check, ExternalLink, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { fetchMinuteAccessRequests, reviewMinuteAccessRequest } from '@/lib/repositories';
import { MOCK_MINUTE_ACCESS_REQUESTS } from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataLoadError } from '@/components/ui/DataLoadError';
import type { MinuteAccessRequestStatus } from '@/types';

const STATUS_LABELS: Record<MinuteAccessRequestStatus, string> = {
  pending: '審査待ち',
  approved: '承認済み',
  rejected: '却下',
};

export default function MinuteAccessAdminPage() {
  const { user, effectiveCompanyId } = useAuth();
  const { data: requests, loading, error, reload, setData } = useRepositoryData(
    `minute-access-requests-${effectiveCompanyId}`,
    () => fetchMinuteAccessRequests(effectiveCompanyId),
    filterByCompany(MOCK_MINUTE_ACCESS_REQUESTS, effectiveCompanyId),
    { persistMock: true, configuredInitial: [] }
  );

  const review = async (id: string, status: 'approved' | 'rejected') => {
    if (!user) return;
    const ok = await reviewMinuteAccessRequest(id, status, user.id);
    if (!ok) return;
    const reviewedAt = new Date().toISOString();
    setData((current) => current.map((request) => (
      request.id === id
        ? {
            ...request,
            status,
            reviewed_by: user.id,
            reviewed_by_name: user.full_name,
            reviewed_at: reviewedAt,
          }
        : request
    )));
  };

  const pending = requests.filter((request) => request.status === 'pending').length;

  return (
    <RouteGuard route="admin_minute_access">
      <div>
        <PageHeader
          title="議事録閲覧申請"
          description={`他部署の議事録を必要とする社員の申請を審査します。審査待ち ${pending}件`}
          action={
            <Link href="/minutes"><Button variant="secondary"><ExternalLink className="h-4 w-4" />議事録を確認</Button></Link>
          }
        />

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardBody className="text-sm text-blue-950">
            <p className="font-semibold">承認基準</p>
            <p className="mt-1">業務改善・部署間支援・重複作業の削減など、目的が具体的な申請を承認します。承認は申請者本人と対象議事録だけに適用されます。</p>
          </CardBody>
        </Card>

        {error && <DataLoadError message={error} onRetry={() => void reload()} />}
        {loading ? (
          <p className="text-sm text-slate-500">申請を読み込んでいます...</p>
        ) : requests.length === 0 ? (
          <Card><CardBody className="text-sm text-slate-500">現在、閲覧申請はありません。一般社員から申請するとここに表示されます。</CardBody></Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${request.status === 'pending' ? 'bg-amber-50 text-amber-700' : request.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {STATUS_LABELS[request.status]}
                      </span>
                      <h2 className="mt-2 font-semibold text-slate-900">{request.minute_title}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        申請者: {request.requester_name}（{request.requester_department_name ?? '部署未設定'}）
                      </p>
                      <p className="text-sm text-slate-500">対象部署: {request.target_department_name ?? request.target_department_id}</p>
                      <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <p className="text-xs font-medium text-slate-500">利用目的</p>
                        <p className="mt-1 whitespace-pre-wrap">{request.reason}</p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">申請日時: {new Date(request.requested_at).toLocaleString('ja-JP')}</p>
                      {request.reviewed_at && <p className="text-xs text-slate-400">審査: {request.reviewed_by_name ?? request.reviewed_by} · {new Date(request.reviewed_at).toLocaleString('ja-JP')}</p>}
                    </div>
                    {request.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => void review(request.id, 'approved')}><Check className="h-4 w-4" />承認</Button>
                        <Button size="sm" variant="secondary" onClick={() => void review(request.id, 'rejected')}><X className="h-4 w-4" />却下</Button>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
