'use client';

import { ShieldCheck } from 'lucide-react';
import { SECURITY_POLICY } from '@/lib/security/config';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { IntegrationOpsSummary } from '@/components/integrations/IntegrationOpsSummary';

function PolicySection({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <Card>
      <CardBody>
        <h3 className="mb-4 font-semibold text-slate-900">{title}</h3>
        <dl className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-wrap justify-between gap-2 border-b border-slate-50 pb-2 last:border-0">
              <dt className="text-sm text-slate-600">{item.label}</dt>
              <dd className="text-sm font-medium text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

export default function AdminSecurityPage() {
  const p = SECURITY_POLICY;

  return (
    <RouteGuard route="admin_security">
      <div>
        <PageHeader
          title="セキュリティ設定"
          description="トークンパス・監査・ファイルアップロード・AI回答のセキュリティポリシー（参照用）"
        />

        <div className="mb-6 flex items-center gap-3 rounded-lg border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-900">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p>
            本画面は現在のポリシー設定を表示します。本番環境では環境変数・DB設定から変更できるよう拡張予定です。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PolicySection
            title="トークンパスポリシー"
            items={[
              { label: 'ハッシュアルゴリズム', value: p.token_pass.hash_algorithm },
              { label: 'デフォルト最大使用回数', value: String(p.token_pass.default_max_uses) },
              { label: 'デフォルト有効期限', value: `${p.token_pass.default_expiry_days} 日` },
              {
                label: '侵害時の失効必須',
                value: p.token_pass.require_revoke_on_compromise ? 'はい' : 'いいえ',
              },
            ]}
          />

          <PolicySection
            title="監査ログ保存方針"
            items={[
              { label: '保存期間', value: `${p.audit.retention_days} 日` },
              { label: 'IP アドレス記録', value: p.audit.log_ip_address ? '有効' : '無効' },
              { label: 'User-Agent 記録', value: p.audit.log_user_agent ? '有効' : '無効' },
              { label: '改ざん防止ストレージ', value: p.audit.immutable_storage ? '有効' : '未設定' },
            ]}
          />

          <PolicySection
            title="ファイルアップロード制限"
            items={[
              { label: '最大ファイルサイズ', value: `${p.upload.max_file_size_mb} MB` },
              {
                label: '許可拡張子',
                value: p.upload.allowed_extensions.join(', ').toUpperCase(),
              },
              { label: 'アップロード時スキャン', value: p.upload.scan_on_upload ? '有効' : '未設定' },
            ]}
          />

          <PolicySection
            title="AI回答ポリシー"
            items={[
              {
                label: '社内資料引用必須',
                value: p.ai.require_knowledge_citation ? 'はい' : 'いいえ',
              },
              {
                label: '資料なし時の警告',
                value: p.ai.show_no_knowledge_warning ? '表示' : '非表示',
              },
              {
                label: '外部データ漏洩防止',
                value: p.ai.block_external_data_leak ? '有効' : '無効',
              },
            ]}
          />

          <PolicySection
            title="機密情報アクセス設定"
            items={[
              {
                label: '機密閲覧にトークン必須',
                value: p.confidential_access.require_token_for_confidential ? 'はい' : 'いいえ',
              },
              {
                label: '役員限定の警告表示',
                value: p.confidential_access.warn_on_executive_only ? '有効' : '無効',
              },
              {
                label: '機密閲覧の警告表示',
                value: p.confidential_access.warn_on_confidential_view ? '有効' : '無効',
              },
            ]}
          />
        </div>

        <IntegrationOpsSummary />
      </div>
    </RouteGuard>
  );
}
