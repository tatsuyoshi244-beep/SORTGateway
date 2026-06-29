'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { filterKnowledgeForUser } from '@/lib/data-access';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { filterByCompany } from '@/lib/tenant/filter';
import { fetchKnowledgeItems } from '@/lib/repositories';
import { MOCK_KNOWLEDGE } from '@/lib/mock-data';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { ConfidentialAccessBanner } from '@/components/security/ConfidentialAccessBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

export default function KnowledgePage() {
  const { user, activeTokenPass, effectiveCompanyId } = useAuth();
  const { data: allItems, loading } = useRepositoryData(
    `knowledge-${effectiveCompanyId}`,
    () => fetchKnowledgeItems(effectiveCompanyId),
    filterByCompany(MOCK_KNOWLEDGE, effectiveCompanyId)
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const items = useMemo(
    () => (user ? filterKnowledgeForUser(user, !!activeTokenPass, allItems, { publishedOnly: true }) : []),
    [user, activeTokenPass, allItems]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (k) =>
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        k.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [items, query]);

  const active = filtered.find((k) => k.id === selected) ?? filtered[0];
  const lastAudited = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !user || lastAudited.current === active.id) return;
    lastAudited.current = active.id;
    apiFetch(user, '/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        action: 'knowledge.view',
        resourceType: 'knowledge_item',
        resourceId: active.id,
        details: active.title,
      }),
    }).catch(() => {});
  }, [active, user]);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="社内ナレッジ検索"
        description="権限に応じて閲覧可能なナレッジを検索・参照できます"
      />

      {loading ? (
        <p className="text-sm text-slate-500">ナレッジを読み込んでいます...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-10"
                placeholder="キーワード検索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {filtered.length === 0 ? (
              <EmptyState
                title="該当するナレッジがありません"
                description="検索条件を変えるか、アクセス権限・トークンパスを確認してください"
              />
            ) : (
              <ul className="space-y-2">
                {filtered.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(k.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        active?.id === k.id
                          ? 'border-navy-300 bg-navy-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="font-medium text-slate-900">{k.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ClassificationBadge value={k.classification} />
                        <span className="text-xs text-slate-400">{k.category}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Card className="lg:col-span-3">
            {active ? (
              <CardBody>
                <ConfidentialAccessBanner classification={active.classification} />
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{active.title}</h2>
                  <ClassificationBadge value={active.classification} prominent />
                </div>
                <p className="mb-4 text-sm text-slate-500">
                  更新: {formatDate(active.updated_at)}
                  {active.department_name && ` · 担当部署: ${active.department_name}`}
                </p>
                <dl className="mb-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-400">担当者</dt>
                    <dd className="font-medium">{active.responsible_person_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">最終更新者</dt>
                    <dd className="font-medium">{active.updated_by_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">承認者</dt>
                    <dd className="font-medium">{active.approved_by_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">バージョン</dt>
                    <dd className="font-medium">v{active.version}</dd>
                  </div>
                </dl>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700">
                  {active.content}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {active.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      #{t}
                    </span>
                  ))}
                </div>
              </CardBody>
            ) : (
              <CardBody>
                <EmptyState title="ナレッジを選択してください" />
              </CardBody>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
