'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { DEFAULT_SETTINGS } from '@/lib/mock-data';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';
import type { AppSettings, IntegrationConnection, IntegrationConnectionStatus } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { isOpenAIConfigured, isSupabaseConfigured } from '@/lib/env';
import { IntegrationOpsSummary } from '@/components/integrations/IntegrationOpsSummary';

const INT_STATUS: Record<IntegrationConnectionStatus, string> = {
  not_connected: '未接続',
  connected: '接続済み',
  syncing: '同期中',
  error: 'エラー',
  disabled: '無効',
};

export default function SettingsPage() {
  const { user, effectiveCompanyName } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_SETTINGS,
    company_name: effectiveCompanyName,
  });
  const [saved, setSaved] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationConnection[]>([]);

  useEffect(() => {
    if (!user || !['admin', 'super_admin'].includes(user.role)) return;
    apiFetch(user, '/api/integrations')
      .then((r) => r.json())
      .then((data) => {
        if (data.connections) setIntegrations(data.connections);
      })
      .catch(() => {});
  }, [user]);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <RouteGuard route="settings">
      <div>
        <PageHeader
          title="設定"
          description="アプリケーション全体の動作設定"
        />

        <Card className="max-w-2xl">
          <CardBody className="space-y-5">
            <div>
              <Label>会社名（テナント）</Label>
              <Input value={effectiveCompanyName} readOnly className="bg-slate-50" />
              <p className="mt-1 text-xs text-slate-400">
                表示用の会社名。super_admin はヘッダーで企業を切り替えできます。
              </p>
            </div>
            <div>
              <Label>設定上の会社名</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              />
            </div>
            <div>
              <Label>デフォルト言語</Label>
              <Input
                value={settings.default_language}
                onChange={(e) => setSettings({ ...settings, default_language: e.target.value })}
              />
            </div>
            <div>
              <Label>チャットモデル</Label>
              <Input
                value={settings.chat_model}
                onChange={(e) => setSettings({ ...settings, chat_model: e.target.value })}
              />
            </div>
            <div>
              <Label>ログ保持日数</Label>
              <Input
                type="number"
                value={settings.retention_days}
                onChange={(e) =>
                  setSettings({ ...settings, retention_days: parseInt(e.target.value, 10) || 90 })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={settings.require_token_for_confidential}
                onChange={(e) =>
                  setSettings({ ...settings, require_token_for_confidential: e.target.checked })
                }
              />
              機密情報にトークンパスを必須にする
            </label>
            <Button onClick={save}>{saved ? '保存しました' : '設定を保存'}</Button>
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
              Supabase: {isSupabaseConfigured() ? '設定済み' : '未設定（モックデータモード）'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              OpenAI API: {isOpenAIConfigured() ? '設定済み' : '未設定（モック回答モード）'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              環境変数は .env.local に設定。Vercel 本番でも同キーを設定してください
            </p>
          </CardBody>
        </Card>
      </div>
    </RouteGuard>
  );
}
