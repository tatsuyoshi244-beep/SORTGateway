'use client';

import { useAuth } from '@/lib/auth-context';
import { filterByCompany } from '@/lib/tenant/filter';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import {
  fetchFileConnections,
  updateFileConnectionSync,
} from '@/lib/repositories';
import { MOCK_FILE_CONNECTIONS } from '@/lib/mock-data';
import type { FileConnection } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

const STATUS_MAP = {
  connected: { label: '接続済み', className: 'bg-green-50 text-green-700' },
  disconnected: { label: '未接続', className: 'bg-slate-100 text-slate-600' },
  error: { label: 'エラー', className: 'bg-red-50 text-red-700' },
};

const PROVIDER_LABELS: Record<FileConnection['provider'], string> = {
  sharepoint: 'SharePoint',
  google_drive: 'Google Drive',
  box: 'Box',
  local_smb: '社内 SMB',
};

export default function AdminFilesPage() {
  const { effectiveCompanyId } = useAuth();
  const { data: connections, loading, source, setData } = useRepositoryData(
    `file-connections-${effectiveCompanyId}`,
    () => fetchFileConnections(effectiveCompanyId),
    filterByCompany(MOCK_FILE_CONNECTIONS, effectiveCompanyId)
  );

  const sync = async (id: string) => {
    if (source === 'supabase') {
      const updated = await updateFileConnectionSync(id);
      if (updated) {
        setData((prev) => prev.map((c) => (c.id === id ? updated : c)));
      }
    } else {
      setData((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: 'connected' as const, last_synced_at: new Date().toISOString() }
            : c
        )
      );
    }
  };

  return (
    <RouteGuard route="admin_files">
      <div>
        <PageHeader
          title="社内ファイル連携設定"
          description="SharePoint / Google Drive 等との同期設定（OAuth 接続は Supabase Edge Functions で拡張）"
        />

        {loading ? (
          <p className="text-sm text-slate-500">連携設定を読み込んでいます...</p>
        ) : (
          <div className="grid gap-4">
            {connections.map((c) => (
              <Card key={c.id}>
                <CardBody className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      <StatusBadge status={c.status} map={STATUS_MAP} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {PROVIDER_LABELS[c.provider]} · {c.sync_path}
                    </p>
                    <p className="text-xs text-slate-400">
                      最終同期: {formatDate(c.last_synced_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void sync(c.id)}>
                      同期実行
                    </Button>
                    <Button variant="ghost" size="sm">
                      設定
                    </Button>
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
