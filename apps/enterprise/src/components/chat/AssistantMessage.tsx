'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  BookOpen,
  FileStack,
  Gauge,
  Lightbulb,
  MessageSquare,
  User,
} from 'lucide-react';
import type { ChatAssistantPayload } from '@/types';
import { ClassificationBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

export function AssistantMessage({
  payload,
  onFeedback,
  messageId,
}: {
  payload: ChatAssistantPayload;
  messageId?: string;
  question?: string;
  onFeedback?: (rating: 'positive' | 'negative') => void;
}) {
  const q = payload.quality;

  return (
    <div className="w-full max-w-3xl space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-700">
          <MessageSquare className="h-3.5 w-3.5" />
          回答
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {payload.answer}
        </p>
      </section>

      {payload.has_knowledge && q && (
        <section className="rounded-xl border border-navy-100 bg-navy-50/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-800">
            <Gauge className="h-3.5 w-3.5" />
            回答品質
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">信頼度スコア</dt>
              <dd className="font-semibold text-navy-900">{q.confidence_score}%</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">ナレッジバージョン</dt>
              <dd className="font-medium text-slate-800">
                {q.knowledge_version != null ? `v${q.knowledge_version}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">参照ソース数</dt>
              <dd className="font-medium text-slate-800">{q.source_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">最終更新</dt>
              <dd className="font-medium text-slate-800">
                {q.last_updated ? formatDate(q.last_updated) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">担当部署</dt>
              <dd className="font-medium text-slate-800">{q.responsible_department ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">担当者</dt>
              <dd className="inline-flex items-center gap-1 font-medium text-slate-800">
                <User className="h-3.5 w-3.5" />
                {q.responsible_person ?? '—'}
              </dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <Lightbulb className="h-3.5 w-3.5" />
          根拠
        </div>
        <p className="text-sm leading-relaxed text-slate-700">{payload.rationale}</p>
      </section>

      {payload.document_references.length > 0 && (
        <section className="rounded-xl border border-navy-200 bg-navy-50/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy-800">
            <FileStack className="h-3.5 w-3.5" />
            参考資料
          </div>
          <ul className="space-y-2">
            {payload.document_references.map((ref) => (
              <li key={ref.id}>
                <Link
                  href={`/documents/${ref.document_id}`}
                  className="block rounded-lg border border-navy-100 bg-white px-3 py-2 transition-colors hover:border-navy-300 hover:bg-navy-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-navy-900">{ref.filename}</span>
                    {ref.page_number != null && (
                      <span className="rounded bg-navy-100 px-1.5 py-0.5 text-xs font-mono text-navy-700">
                        P{ref.page_number}
                      </span>
                    )}
                    <ClassificationBadge value={ref.classification} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {ref.department ?? '—'} · 更新 {formatDate(ref.updated_at)}
                  </p>
                  {ref.excerpt && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{ref.excerpt}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <BookOpen className="h-3.5 w-3.5" />
          参照ナレッジ
        </div>
        {payload.references.length === 0 ? (
          <p className="text-sm text-slate-500">参照された社内ナレッジはありません</p>
        ) : (
          <ul className="space-y-2">
            {payload.references.map((ref) => (
              <li
                key={ref.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{ref.title}</span>
                  {ref.version != null && (
                    <span className="text-xs text-slate-400">v{ref.version}</span>
                  )}
                  <ClassificationBadge value={ref.classification} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {ref.responsible_department ?? '—'} · {ref.responsible_person ?? '—'}
                  {ref.updated_at && ` · 更新 ${formatDate(ref.updated_at)}`}
                </p>
                {ref.excerpt && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{ref.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {(payload.warnings.length > 0 || !payload.has_knowledge) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            注意事項
          </div>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
            {!payload.has_knowledge && (
              <li>
                社内ナレッジ・ドキュメントに該当情報がありません。以下は推測ではなく「情報なし」に基づく応答です。
              </li>
            )}
            {payload.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {onFeedback && messageId && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>この回答は役に立ちましたか？</span>
          <button
            type="button"
            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-green-800 hover:bg-green-100"
            onClick={() => onFeedback('positive')}
          >
            👍 正しかった
          </button>
          <button
            type="button"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-red-800 hover:bg-red-100"
            onClick={() => onFeedback('negative')}
          >
            👎 違う
          </button>
        </div>
      )}
    </div>
  );
}
