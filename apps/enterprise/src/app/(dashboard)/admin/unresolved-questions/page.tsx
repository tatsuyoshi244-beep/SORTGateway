'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookPlus, Check, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { MOCK_USERS } from '@/lib/mock-data';
import type { UnresolvedQuestionView } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

const STATUS_LABELS: Record<UnresolvedQuestionView['status'], string> = {
  open: '未対応',
  assigned: '担当割当済',
  resolved: '解決済',
  hidden: '非表示',
};

export default function UnresolvedQuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<UnresolvedQuestionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/admin/unresolved-questions');
      const data = await res.json();
      if (data.questions) setQuestions(data.questions);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    if (!user) return;
    setActing(id);
    try {
      const res = await apiFetch(user, `/api/admin/unresolved-questions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error?.message ?? '操作に失敗しました');
        return;
      }
      await load();
    } finally {
      setActing(null);
    }
  };

  const managers = MOCK_USERS.filter((u) =>
    ['manager', 'admin', 'executive'].includes(u.role)
  );

  return (
    <RouteGuard route="admin_unresolved_questions">
      <div>
        <PageHeader
          title="未解決質問"
          description="根拠なし・低信頼度の質問を管理し、ナレッジ不足を解消"
        />

        <div className="mb-4">
          <Link href="/admin/analytics">
            <Button variant="ghost" size="sm">
              利用分析に戻る
            </Button>
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-slate-500">未解決質問はありません</p>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <Card key={q.id} className={q.status === 'hidden' ? 'opacity-60' : ''}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{q.question}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {q.user_name} · {q.department ?? '—'} · {formatDate(q.created_at)}
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {STATUS_LABELS[q.status]}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p className="text-xs font-medium text-slate-400">AI回答</p>
                    <p className="mt-1">{q.answer_summary}</p>
                  </div>

                  {q.no_knowledge_reason && (
                    <p className="text-sm text-red-600">
                      根拠なし理由: {q.no_knowledge_reason}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>信頼度: {Math.round(q.confidence_score * 100)}%</span>
                    <span>類似質問: {q.similar_count} 件</span>
                    {q.group_keywords.length > 0 && (
                      <span>キーワード: {q.group_keywords.join(', ')}</span>
                    )}
                    {q.assigned_to_name && <span>担当: {q.assigned_to_name}</span>}
                  </div>

                  {q.status !== 'hidden' && q.status !== 'resolved' && (
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={acting === q.id}
                        onClick={() =>
                          void patch(q.id, { action: 'create_knowledge' })
                        }
                      >
                        <BookPlus className="h-3.5 w-3.5" />
                        ナレッジ化
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acting === q.id}
                        onClick={() => {
                          const assignee = managers[0];
                          if (!assignee) return;
                          void patch(q.id, {
                            action: 'assign',
                            assigned_to_id: assignee.id,
                            assigned_to_name: assignee.full_name,
                          });
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        担当者割当
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acting === q.id}
                        onClick={() => void patch(q.id, { action: 'resolve' })}
                      >
                        <Check className="h-3.5 w-3.5" />
                        解決済み
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acting === q.id}
                        onClick={() => void patch(q.id, { action: 'hide' })}
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        非表示
                      </Button>
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
