'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Cloud,
  Link2,
  Plug,
  RefreshCw,
  ScrollText,
  Settings2,
  Unplug,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import {
  INTEGRATION_PROVIDER_DESCRIPTIONS,
  INTEGRATION_PROVIDER_LABELS,
} from '@/lib/integrations/constants';
import { SYNC_FREQUENCY_LABELS } from '@/lib/integrations/sync-schedule';
import type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationProvider,
  IntegrationSyncFrequency,
  IntegrationSyncLog,
} from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<IntegrationConnectionStatus, string> = {
  not_connected: '未接続',
  connected: '接続済み',
  syncing: '同期中',
  error: 'エラー',
  disabled: '無効',
};

const STATUS_CLASS: Record<IntegrationConnectionStatus, string> = {
  not_connected: 'bg-slate-100 text-slate-600',
  connected: 'bg-green-50 text-green-700',
  syncing: 'bg-blue-50 text-blue-700',
  error: 'bg-red-50 text-red-700',
  disabled: 'bg-slate-100 text-slate-400',
};

const SYNC_STATUS_LABELS: Record<IntegrationSyncLog['status'], string> = {
  running: '実行中',
  success: '成功',
  partial: '一部成功',
  failed: '失敗',
};

const FREQUENCIES: IntegrationSyncFrequency[] = ['manual', 'hourly', 'daily', 'weekly'];

export default function AdminIntegrationsPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [available, setAvailable] = useState<Array<{ provider: IntegrationProvider; label: string }>>([]);
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<IntegrationProvider | null>(null);
  const [formName, setFormName] = useState('');
  const [formTarget, setFormTarget] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [connRes, logRes] = await Promise.all([
        apiFetch(user, '/api/integrations'),
        apiFetch(user, '/api/integrations/sync-logs'),
      ]);
      const connData = await connRes.json();
      const logData = await logRes.json();
      if (connData.connections) setConnections(connData.connections);
      if (connData.available) setAvailable(connData.available);
      if (logData.logs) setLogs(logData.logs.slice(0, 10));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSync = async (id: string) => {
    if (!user) return;
    setSyncingId(id);
    try {
      const res = await apiFetch(user, `/api/integrations/${id}/sync`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) alert(data.error?.message ?? '同期に失敗しました');
      else {
        const r = data.result;
        alert(
          `同期完了: 新規 ${r?.new_count ?? 0} 件 / 更新 ${r?.updated_count ?? 0} 件を documents に反映しました`
        );
      }
      await load();
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!user || !confirm(`「${name}」の接続を切断しますか？`)) return;
    await apiFetch(user, `/api/integrations/${id}/disconnect`, { method: 'POST' });
    await load();
  };

  const handleConnect = async (provider: IntegrationProvider) => {
    if (!user || !formName.trim()) return;
    const res = await apiFetch(user, '/api/integrations', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        display_name: formName,
        config_json: { sync_target: formTarget || undefined, enabled: true },
        credentials: 'mock-oauth-token',
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error?.message ?? '接続に失敗しました');
      return;
    }
    setConnecting(null);
    setFormName('');
    setFormTarget('');
    await load();
  };

  const toggleEnabled = async (conn: IntegrationConnection) => {
    if (!user) return;
    await apiFetch(user, `/api/integrations/${conn.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !conn.config_json.enabled }),
    });
    await load();
  };

  const updateSchedule = async (
    conn: IntegrationConnection,
    patch: { sync_enabled?: boolean; sync_frequency?: IntegrationSyncFrequency }
  ) => {
    if (!user) return;
    await apiFetch(user, `/api/integrations/${conn.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await load();
  };

  return (
    <RouteGuard route="admin_integrations">
      <div>
        <PageHeader
          title="外部連携"
          description="Google Drive / Microsoft 365 / Slack / Teams / Notion / Box（モック接続・手動/定期同期）"
        />

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          現時点は<strong>モック実装</strong>です。定期同期は <code className="rounded bg-amber-100 px-1">/api/jobs/sync-integrations</code> で実行します。本番 OAuth は今後のアダプター差し替えで対応します。
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {connections.map((conn) => (
                <Card key={conn.id}>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-navy-600" />
                        <div>
                          <p className="font-semibold text-slate-900">{conn.display_name}</p>
                          <p className="text-xs text-slate-500">
                            {INTEGRATION_PROVIDER_LABELS[conn.provider]}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[conn.status]}`}
                      >
                        {STATUS_LABELS[conn.status]}
                      </span>
                    </div>

                    {conn.consecutive_error_count >= 3 && (
                      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          連続 {conn.consecutive_error_count} 回失敗しています。接続設定を確認してください。
                        </span>
                      </div>
                    )}

                    {conn.consecutive_error_count > 0 && conn.consecutive_error_count < 3 && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>連続エラー {conn.consecutive_error_count} 回（3回で自動停止）</span>
                      </div>
                    )}

                    <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <dt className="text-slate-400">同期対象</dt>
                        <dd className="truncate font-medium">{conn.config_json.sync_target}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">最終同期</dt>
                        <dd>{conn.last_sync_at ? formatDate(conn.last_sync_at) : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">最終成功</dt>
                        <dd>
                          {conn.last_successful_sync_at
                            ? formatDate(conn.last_successful_sync_at)
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">次回同期</dt>
                        <dd>
                          {conn.sync_enabled && conn.next_sync_at
                            ? formatDate(conn.next_sync_at)
                            : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">同期件数</dt>
                        <dd>{conn.config_json.imported_count ?? 0} 取込</dd>
                      </div>
                      <div>
                        <dt className="text-slate-400">エラー</dt>
                        <dd className={conn.config_json.error_count ? 'font-medium text-red-600' : ''}>
                          {conn.config_json.error_count ?? 0}
                        </dd>
                      </div>
                    </dl>

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-medium text-slate-700">定期同期設定</p>
                      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={conn.sync_enabled}
                          disabled={conn.status === 'not_connected'}
                          onChange={(e) =>
                            void updateSchedule(conn, { sync_enabled: e.target.checked })
                          }
                        />
                        定期同期を有効にする
                      </label>
                      <select
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                        value={conn.sync_frequency}
                        disabled={conn.status === 'not_connected'}
                        onChange={(e) =>
                          void updateSchedule(conn, {
                            sync_frequency: e.target.value as IntegrationSyncFrequency,
                          })
                        }
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f} value={f}>
                            {SYNC_FREQUENCY_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-xs text-slate-400">
                      認証情報: {conn.has_credentials ? '暗号化保存済み（非表示）' : '未設定'}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={conn.status === 'not_connected' || syncingId === conn.id}
                        onClick={() => void handleSync(conn.id)}
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${syncingId === conn.id ? 'animate-spin' : ''}`}
                        />
                        手動同期
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleEnabled(conn)}>
                        <Settings2 className="h-3.5 w-3.5" />
                        {conn.config_json.enabled ? '無効化' : '有効化'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDisconnect(conn.id, conn.display_name)}
                      >
                        <Unplug className="h-3.5 w-3.5" />
                        切断
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {available.length > 0 && (
              <Card className="mb-8">
                <CardBody>
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                    <Plug className="h-4 w-4" />
                    新規連携を追加
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {available.map((a) => (
                      <Button
                        key={a.provider}
                        variant={connecting === a.provider ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => {
                          setConnecting(a.provider);
                          setFormName(a.label);
                          setFormTarget('');
                        }}
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        {a.label}
                      </Button>
                    ))}
                  </div>
                  {connecting && (
                    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
                      <p className="text-sm text-slate-600 md:col-span-2">
                        {INTEGRATION_PROVIDER_DESCRIPTIONS[connecting]}
                      </p>
                      <div>
                        <Label>表示名</Label>
                        <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
                      </div>
                      <div>
                        <Label>同期対象パス</Label>
                        <Input
                          value={formTarget}
                          onChange={(e) => setFormTarget(e.target.value)}
                          placeholder="例: /sites/sales/Documents"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Button onClick={() => void handleConnect(connecting)}>
                          接続（モック OAuth）
                        </Button>
                        <Button className="ml-2" variant="ghost" onClick={() => setConnecting(null)}>
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">同期ログ（直近）</h3>
                  <Link href="/admin/integrations/logs">
                    <Button variant="ghost" size="sm">
                      <ScrollText className="h-3.5 w-3.5" />
                      詳細ログを見る
                    </Button>
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2">開始</th>
                        <th className="px-4 py-2">プロバイダー</th>
                        <th className="px-4 py-2">種別</th>
                        <th className="px-4 py-2">結果</th>
                        <th className="px-4 py-2">取込</th>
                        <th className="px-4 py-2">エラー</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-50">
                          <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                            {formatDate(log.started_at)}
                          </td>
                          <td className="px-4 py-2">{INTEGRATION_PROVIDER_LABELS[log.provider]}</td>
                          <td className="px-4 py-2">{log.sync_type === 'scheduled' ? '定期' : '手動'}</td>
                          <td className="px-4 py-2">{SYNC_STATUS_LABELS[log.status]}</td>
                          <td className="px-4 py-2 text-green-700">{log.imported_count}</td>
                          <td className="px-4 py-2 text-red-600">{log.error_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
