'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import type { DepartmentAnalyticsRow } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function DeptBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 truncate text-slate-600">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-navy-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default function DepartmentAnalyticsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentAnalyticsRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/admin/analytics/departments');
      const data = await res.json();
      if (data.departments) setDepartments(data.departments);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxQuestions = Math.max(...departments.map((d) => d.question_count), 1);

  return (
    <RouteGuard route="admin_analytics_departments">
      <div>
        <div className="mb-4">
          <Link href="/admin/analytics">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" />
              利用分析に戻る
            </Button>
          </Link>
        </div>

        <PageHeader title="部署別分析" description="部署ごとの質問・未解決・低評価・ナレッジ鮮度" />

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-slate-500">データがありません</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardBody>
                <h3 className="mb-4 font-semibold text-slate-900">部署別質問数</h3>
                <div className="space-y-3">
                  {departments.map((d) => (
                    <DeptBar
                      key={d.department_id ?? d.department}
                      label={d.department}
                      value={d.question_count}
                      max={maxQuestions}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="mb-4 font-semibold text-slate-900">部署別未解決数</h3>
                <div className="space-y-3">
                  {departments.map((d) => (
                    <DeptBar
                      key={`u-${d.department_id}`}
                      label={d.department}
                      value={d.unresolved_count}
                      max={Math.max(...departments.map((x) => x.unresolved_count), 1)}
                    />
                  ))}
                </div>
              </CardBody>
            </Card>

            {departments.map((d) => (
              <Card key={d.department_id ?? d.department}>
                <CardBody>
                  <h3 className="font-semibold text-slate-900">{d.department}</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-400">低評価</dt>
                      <dd className="font-medium text-red-600">{d.negative_feedback_count}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">古いナレッジ</dt>
                      <dd className="font-medium text-orange-600">{d.stale_knowledge_count}</dd>
                    </div>
                  </dl>
                  {d.top_knowledge_titles.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-400">よく参照されるナレッジ</p>
                      <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                        {d.top_knowledge_titles.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
