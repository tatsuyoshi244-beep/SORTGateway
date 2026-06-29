'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import {
  MOCK_AUDIT_LOGS,
  MOCK_FILE_CONNECTIONS,
  MOCK_TOKEN_PASSES,
  MOCK_USERS,
} from '@/lib/mock-data';
import { MOCK_DOCUMENTS } from '@/lib/mock-documents';
import { canAccessRoute } from '@/lib/permissions';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getDocumentStats } from '@/lib/documents/stats';

interface DocumentStats {
  total: number;
  indexed: number;
  processing: number;
  error: number;
}

interface LifecycleStats {
  ai_usage_count: number;
  knowledge_count: number;
  stale_knowledge_count: number;
  pending_approval_count: number;
  feedback_count: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [docStats, setDocStats] = useState<DocumentStats>(
    getDocumentStats(MOCK_DOCUMENTS)
  );
  const [lifecycle, setLifecycle] = useState<LifecycleStats | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch(user, '/api/documents')
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setDocStats(data.stats);
      })
      .catch(() => {});
    apiFetch(user, '/api/admin/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.stats) setLifecycle(data.stats);
      })
      .catch(() => {});
  }, [user]);

  if (!user) return null;

  const links = [
    { href: '/admin/knowledge', label: 'ナレッジ管理', count: lifecycle?.knowledge_count ?? 0, key: 'admin_knowledge' as const },
    { href: '/admin/knowledge-health', label: 'ナレッジ鮮度', count: lifecycle?.stale_knowledge_count ?? 0, key: 'admin_knowledge_health' as const },
    { href: '/admin/feedback', label: 'AIフィードバック', count: lifecycle?.feedback_count ?? 0, key: 'admin_feedback' as const },
    { href: '/admin/documents', label: 'ドキュメント管理', count: docStats.total, key: 'admin_documents' as const },
    { href: '/admin/users', label: 'ユーザー・ロール', count: MOCK_USERS.length, key: 'admin_users' as const },
    { href: '/admin/token-passes', label: 'トークンパス', count: MOCK_TOKEN_PASSES.length, key: 'admin_token_passes' as const },
    { href: '/admin/audit', label: '監査ログ', count: MOCK_AUDIT_LOGS.length, key: 'admin_audit' as const },
    { href: '/admin/files', label: 'ファイル連携', count: MOCK_FILE_CONNECTIONS.length, key: 'admin_files' as const },
    { href: '/admin/security', label: 'セキュリティ設定', count: 0, key: 'admin_security' as const },
    { href: '/admin/integrations', label: '外部連携', count: 0, key: 'admin_integrations' as const },
    { href: '/admin/analytics', label: '利用分析', count: 0, key: 'admin_analytics' as const },
    { href: '/admin/system', label: 'システム状態', count: 0, key: 'admin_system' as const },
    { href: '/admin/unresolved-questions', label: '未解決質問', count: 0, key: 'admin_unresolved_questions' as const },
  ].filter((l) => canAccessRoute(user.role, l.key));

  return (
    <RouteGuard route="admin">
      <div>
        <PageHeader
          title="管理者ダッシュボード"
          description="ナレッジライフサイクル・AI利用状況の概要"
        />

        {lifecycle && (
          <div className="mb-6 grid gap-4 sm:grid-cols-5">
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">AI利用回数</p>
                <p className="text-3xl font-bold text-navy-800">{lifecycle.ai_usage_count}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">ナレッジ数</p>
                <p className="text-3xl font-bold text-slate-900">{lifecycle.knowledge_count}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">古いナレッジ</p>
                <p className="text-3xl font-bold text-red-600">{lifecycle.stale_knowledge_count}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">未承認・未公開</p>
                <p className="text-3xl font-bold text-amber-600">{lifecycle.pending_approval_count}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">フィードバック</p>
                <p className="text-3xl font-bold text-slate-900">{lifecycle.feedback_count}</p>
              </CardBody>
            </Card>
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">ドキュメント</p>
              <p className="text-3xl font-bold text-slate-900">{docStats.total}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Indexed</p>
              <p className="text-3xl font-bold text-green-700">{docStats.indexed}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Processing</p>
              <p className="text-3xl font-bold text-amber-600">{docStats.processing}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Error</p>
              <p className="text-3xl font-bold text-red-600">{docStats.error}</p>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {links.map((l) => (
            <Card key={l.href}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{l.label}</h3>
                  <p className="text-sm text-slate-500">{l.count} 件</p>
                </div>
                <Link href={l.href}>
                  <Button variant="secondary" size="sm">
                    開く
                  </Button>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </RouteGuard>
  );
}
