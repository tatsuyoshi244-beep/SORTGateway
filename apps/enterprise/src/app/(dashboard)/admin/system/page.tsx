'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { getBuildInfo } from '@/lib/build-info';

interface HealthData {
  status: string;
  version: string;
  build_sha: string;
  uptime_seconds: number;
}

interface ReadyData {
  ready: boolean;
  checks: Record<string, boolean>;
  mode: string;
}

interface SystemData {
  build: ReturnType<typeof getBuildInfo>;
  timing: { avg_ms: number; slow_count: number; records: Array<{ name: string; duration_ms: number; slow: boolean }> };
  slow_queries: Array<{ name: string; duration_ms: number; at: string }>;
  recent_errors: Array<{ context: string; message: string; timestamp: string }>;
  cache_entries: number;
}

export default function AdminSystemPage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [ready, setReady] = useState<ReadyData | null>(null);
  const [system, setSystem] = useState<SystemData | null>(null);
  const build = getBuildInfo();

  const load = useCallback(async () => {
    const [h, r] = await Promise.all([
      fetch('/api/health').then((res) => res.json()),
      fetch('/api/ready').then((res) => res.json()),
    ]);
    setHealth(h);
    setReady(r);

    if (user) {
      const res = await apiFetch(user, '/api/admin/system');
      const data = await res.json();
      setSystem(data);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <RouteGuard route="admin_system">
      <div>
        <PageHeader
          title="システム状態"
          description="ヘルスチェック・パフォーマンス・ビルド情報"
        />

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">バージョン</p>
              <p className="text-2xl font-bold text-slate-900">{build.version}</p>
              <p className="mt-1 text-xs text-slate-400">SHA: {build.build_sha.slice(0, 8)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              {health?.status === 'ok' ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <p className="text-sm text-slate-500">Liveness</p>
                <p className="font-semibold">{health?.status ?? '—'}</p>
                <p className="text-xs text-slate-400">uptime {health?.uptime_seconds ?? 0}s</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              {ready?.ready ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-amber-500" />
              )}
              <div>
                <p className="text-sm text-slate-500">Readiness</p>
                <p className="font-semibold">{ready?.ready ? 'Ready' : 'Not Ready'}</p>
                <p className="text-xs text-slate-400">mode: {ready?.mode ?? '—'}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {ready?.checks && (
          <Card className="mb-6">
            <CardBody>
              <h3 className="mb-3 font-semibold text-slate-900">依存サービス</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(ready.checks).map(([key, ok]) => (
                  <div key={key} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <dt className="text-slate-600">{key}</dt>
                    <dd className={ok ? 'text-green-700' : 'text-slate-400'}>
                      {ok ? 'OK' : '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        )}

        {system && (
          <Card>
            <CardBody>
              <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                <Activity className="h-4 w-4" />
                パフォーマンス
              </h3>
              <p className="text-sm text-slate-600">
                平均応答: {system.timing.avg_ms}ms · 遅延検出: {system.timing.slow_count} 件 ·
                キャッシュ: {system.cache_entries} エントリ
              </p>
              {system.slow_queries.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-amber-800">
                  {system.slow_queries.map((q, i) => (
                    <li key={i}>
                      {q.name}: {q.duration_ms}ms ({q.at})
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
