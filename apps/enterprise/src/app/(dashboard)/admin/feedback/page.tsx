'use client';

import { useCallback, useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import type { KnowledgeFeedback } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<KnowledgeFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/feedback');
      const data = await res.json();
      if (data.feedback) setFeedback(data.feedback);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const positive = feedback.filter((f) => f.rating === 'positive').length;
  const negative = feedback.filter((f) => f.rating === 'negative').length;

  return (
    <RouteGuard route="admin_feedback">
      <div>
        <PageHeader
          title="AIフィードバック"
          description="社員からのチャット回答評価（👍 正しかった / 👎 違う）"
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <div className="p-4">
              <p className="text-sm text-slate-500">総件数</p>
              <p className="text-3xl font-bold text-slate-900">{feedback.length}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-slate-500">👍 正しかった</p>
              <p className="text-3xl font-bold text-green-700">{positive}</p>
            </div>
          </Card>
          <Card>
            <div className="p-4">
              <p className="text-sm text-slate-500">👎 違う</p>
              <p className="text-3xl font-bold text-red-600">{negative}</p>
            </div>
          </Card>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : feedback.length === 0 ? (
          <EmptyState title="フィードバックはまだありません" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">日時</th>
                    <th className="px-6 py-3">ユーザー</th>
                    <th className="px-6 py-3">評価</th>
                    <th className="px-6 py-3">質問</th>
                    <th className="px-6 py-3">回答要約</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id} className="border-b border-slate-50">
                      <td className="whitespace-nowrap px-6 py-3 text-slate-600">
                        {formatDate(f.created_at)}
                      </td>
                      <td className="px-6 py-3 font-medium">{f.user_name}</td>
                      <td className="px-6 py-3">
                        {f.rating === 'positive' ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <ThumbsUp className="h-4 w-4" /> 正しかった
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <ThumbsDown className="h-4 w-4" /> 違う
                          </span>
                        )}
                      </td>
                      <td className="max-w-xs px-6 py-3 text-slate-700">{f.question}</td>
                      <td className="max-w-xs px-6 py-3 text-slate-500">{f.answer_summary}</td>
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
