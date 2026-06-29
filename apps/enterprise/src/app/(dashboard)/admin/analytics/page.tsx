'use client';

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  HelpCircle,
  MessageSquare,
  ThumbsDown,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { downloadCsvExport } from '@/lib/api/export-download';
import type { AnalyticsOverview } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`text-3xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <Icon className="h-8 w-8 shrink-0 text-navy-300" />
      </CardBody>
    </Card>
  );
}

function RateBar({ label, percent, color }: { label: string; percent: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{percent}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/admin/analytics');
      const data = await res.json();
      if (data.overview) setOverview(data.overview);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(true);
      return;
    }
    void load();
  }, [load, user]);

  const handleExport = async (type: string, path: string, filename: string) => {
    if (!user) return;
    setExporting(type);
    try {
      await downloadCsvExport(user, path, filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'エクスポート失敗');
    } finally {
      setExporting(null);
    }
  };

  return (
    <RouteGuard route="admin_analytics">
      <div>
        <PageHeader
          title="利用分析"
          description="AI質問・ナレッジ活用・フィードバックの可視化（manager 以上）"
        />

        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/admin/analytics/departments">
            <Button variant="secondary" size="sm">
              <BarChart3 className="h-3.5 w-3.5" />
              部署別分析
            </Button>
          </Link>
          <Link href="/admin/unresolved-questions">
            <Button variant="secondary" size="sm">
              <HelpCircle className="h-3.5 w-3.5" />
              未解決質問
            </Button>
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : !overview ? (
          <p className="text-sm text-slate-500">分析データを取得できませんでした</p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label="AI質問数" value={overview.question_count} icon={MessageSquare} />
              <StatCard
                label="アクティブユーザー数"
                value={overview.active_user_count}
                sub="直近30日"
                icon={Users}
              />
              <StatCard
                label="参照されたナレッジ数"
                value={overview.referenced_knowledge_count}
                icon={BarChart3}
              />
              <StatCard
                label="フィードバック件数"
                value={overview.feedback_count}
                icon={ThumbsDown}
              />
              <StatCard
                label="低評価件数"
                value={overview.negative_feedback_count}
                accent="text-red-600"
                icon={ThumbsDown}
              />
              <StatCard
                label="未解決質問数"
                value={overview.unresolved_count}
                accent="text-amber-600"
                icon={HelpCircle}
              />
              <StatCard
                label="古いナレッジ参照数"
                value={overview.stale_knowledge_reference_count}
                accent="text-orange-600"
                icon={BarChart3}
              />
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-2">
              <Card>
                <CardBody className="space-y-4">
                  <h3 className="font-semibold text-slate-900">回答の根拠率</h3>
                  <RateBar
                    label="根拠あり回答率"
                    percent={overview.with_knowledge_rate}
                    color="bg-green-500"
                  />
                  <RateBar
                    label="根拠なし回答率"
                    percent={overview.without_knowledge_rate}
                    color="bg-red-400"
                  />
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="mb-4 font-semibold text-slate-900">改善フロー（推奨）</h3>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
                    <li>未解決質問を確認し、頻出テーマをナレッジ化</li>
                    <li>低評価・古いナレッジ参照を鮮度管理で更新</li>
                    <li>部署別分析で質問が集中する領域を担当者に割当</li>
                    <li>CSVエクスポートで経営報告・四半期レビューに活用</li>
                  </ol>
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardBody>
                <h3 className="mb-4 font-semibold text-slate-900">CSVエクスポート</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'audit', path: '/api/export/audit', file: 'audit-logs.csv', label: '監査ログ' },
                    { key: 'chat', path: '/api/export/chat-logs', file: 'chat-logs.csv', label: 'AI質問ログ' },
                    {
                      key: 'unresolved',
                      path: '/api/export/unresolved-questions',
                      file: 'unresolved.csv',
                      label: '未解決質問',
                    },
                    { key: 'feedback', path: '/api/export/feedback', file: 'feedback.csv', label: 'フィードバック' },
                  ].map((item) => (
                    <Button
                      key={item.key}
                      variant="secondary"
                      size="sm"
                      disabled={exporting === item.key}
                      onClick={() => void handleExport(item.key, item.path, item.file)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {exporting === item.key ? '出力中...' : item.label}
                    </Button>
                  ))}
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
