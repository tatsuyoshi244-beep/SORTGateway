'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';
import type { IntegrationConnection, IntegrationConnectionStatus } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { IntegrationOpsSummary } from '@/components/integrations/IntegrationOpsSummary';
import { SECURITY_POLICY } from '@/lib/security/config';

const INT_STATUS: Record<IntegrationConnectionStatus, string> = {
  not_connected: '未接続',
  connected: '接続済み',
  syncing: '同期中',
  error: 'エラー',
  disabled: '無効',
};

interface ReadinessSnapshot {
  ready: boolean;
  mode: 'production' | 'demo' | 'development';
  checks?: Record<string, boolean>;
  schema_version?: string | null;
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, effectiveCompanyName } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null);

  useEffect(() => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) return;
    apiFetch(user, '/api/integrations')
      .then((r) => r.json())
      .then((data) => {
        if (data.connections) setIntegrations(data.connections);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetch('/api/ready', { cache: 'no-store' })
      .then(async (response) => response.json())
      .then((data: ReadinessSnapshot) => setReadiness(data))
      .catch(() => setReadiness(null));
  }, []);

  return (
    <RouteGuard route="settings">
      <div>
        <PageHeader
          title="設定"
          description="現在実際に有効な運用設定と接続状態"
        />

        <Card className="max-w-2xl">
          <CardBody>
            <h3 className="font-semibold text-slate-900">有効な運用設定</h3>
            <div className="mt-3">
              <StatusRow label="操作中のテナント" value={effectiveCompanyName} />
              <StatusRow label="既定言語" value="日本語" />
              <StatusRow
                label="AI回答"
                value={readiness?.checks?.openai ? 'OpenAI API' : '根拠限定デモ回答'}
              />
              <StatusRow
                label="監査ログ保持方針"
                value={`${SECURITY_POLICY.audit.retention_days}日`}
              />
              <StatusRow
                label="一般社員の機密アクセス保護"
                value={
                  SECURITY_POLICY.confidential_access.require_token_for_confidential
                    ? '有効'
                    : '無効'
                }
              />
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              この画面は実効値の確認専用です。未実装だった疑似保存操作は廃止しました。
              本番設定の変更は、環境変数とセキュリティポリシーを変更し、レビュー後に再デプロイします。
            </p>
          </CardBody>
        </Card>

        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <h3 className="font-semibold text-slate-900">外部連携状態</h3>
            {integrations.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">接続中の外部連携はありません</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {integrations.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-800">
                      {INTEGRATION_PROVIDER_LABELS[c.provider]}
                    </span>
                    <span className="text-slate-500">{INT_STATUS[c.status]}</span>
                  </li>
                ))}
              </ul>
            )}
            {user && ['admin', 'super_admin'].includes(user.role) && (
              <p className="mt-3 text-xs text-slate-400">
                詳細設定は <a href="/admin/integrations" className="text-navy-600 underline">外部連携管理</a> から
              </p>
            )}
          </CardBody>
        </Card>

        <IntegrationOpsSummary />

        <Card className="mt-6 max-w-2xl">
          <CardBody>
            <h3 className="font-semibold text-slate-900">接続状態</h3>
            <p className="mt-2 text-sm text-slate-600">
              Supabase: {readiness?.checks?.supabase ? '設定済み' : '未設定（デモモード）'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              OpenAI API: {readiness?.checks?.openai ? '設定済み' : '未設定（デモ回答モード）'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Readiness: {readiness ? (readiness.ready ? 'Ready' : '要設定') : '確認できません'}
            </p>
            {readiness?.schema_version && (
              <p className="mt-1 text-sm text-slate-600">
                Schema: {readiness.schema_version}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              秘密値そのものは画面に表示しません
            </p>
          </CardBody>
        </Card>
      </div>
    </RouteGuard>
  );
}
