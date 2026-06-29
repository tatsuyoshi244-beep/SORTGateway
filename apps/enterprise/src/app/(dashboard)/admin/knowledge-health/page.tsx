'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { tierClassName, tierLabel } from '@/lib/knowledge/freshness';
import { APPROVAL_STATUS_LABELS } from '@/lib/knowledge/workflow';
import type { KnowledgeItem } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';

interface HealthRow {
  item: KnowledgeItem;
  days_since_update: number;
  tier: import('@/lib/knowledge/freshness').FreshnessTier;
}

interface HealthCounts {
  ok: number;
  30: number;
  90: number;
  180: number;
  365: number;
  total: number;
}

export default function KnowledgeHealthPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [counts, setCounts] = useState<HealthCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/knowledge/health');
      const data = await res.json();
      if (data.health) setRows(data.health);
      if (data.counts) setCounts(data.counts);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RouteGuard route="admin_knowledge_health">
      <div>
        <PageHeader
          title="ナレッジ鮮度管理"
          description="更新からの経過日数に基づく鮮度監視（期限超過は赤表示・AI検索順位低下）"
        />

        {counts && (
          <div className="mb-6 grid gap-4 sm:grid-cols-5">
            {([
              ['ok', '30日以内', 'text-green-700'],
              ['30', '30日超', 'text-amber-600'],
              ['90', '90日超', 'text-orange-600'],
              ['180', '180日超', 'text-red-600'],
              ['365', '365日超', 'text-red-800 font-bold'],
            ] as const).map(([key, label, cls]) => (
              <Card key={key}>
                <CardBody>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className={`text-3xl font-bold ${cls}`}>
                    {counts[key as keyof HealthCounts] ?? 0}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">タイトル</th>
                    <th className="px-6 py-3">ステータス</th>
                    <th className="px-6 py-3">最終更新</th>
                    <th className="px-6 py-3">経過日数</th>
                    <th className="px-6 py-3">鮮度</th>
                    <th className="px-6 py-3">担当者</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ item, days_since_update, tier }) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{item.title}</td>
                      <td className="px-6 py-3">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                          {APPROVAL_STATUS_LABELS[item.approval_status]}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600">{formatDate(item.updated_at)}</td>
                      <td className={`px-6 py-3 ${tierClassName(tier)}`}>{days_since_update}日</td>
                      <td className={`px-6 py-3 ${tierClassName(tier)}`}>{tierLabel(tier)}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {item.responsible_person_name ?? '—'}
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
