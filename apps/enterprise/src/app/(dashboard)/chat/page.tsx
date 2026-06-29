'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import type { ChatAssistantPayload, ChatMessage } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { AssistantMessage } from '@/components/chat/AssistantMessage';

export default function ChatPage() {
  const { user, activeTokenPass } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedbackSent, setFeedbackSent] = useState<Set<string>>(new Set());

  if (!user) return null;

  const sendFeedback = async (
    messageId: string,
    question: string,
    answer: string,
    rating: 'positive' | 'negative'
  ) => {
    if (feedbackSent.has(messageId)) return;
    await apiFetch(user, '/api/feedback', {
      method: 'POST',
      body: JSON.stringify({
        question,
        answer_summary: answer.slice(0, 200),
        rating,
        chat_message_id: messageId,
      }),
    });
    setFeedbackSent((prev) => new Set(prev).add(messageId));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch(user, '/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          hasActiveTokenPass: !!activeTokenPass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'チャット API エラー');
      }

      const payload = data.payload as ChatAssistantPayload;
      const chatLogId = (data.chat_log_id as string) ?? `m-${Date.now() + 1}`;

      const reply: ChatMessage = {
        id: chatLogId,
        role: 'assistant',
        content: payload.answer,
        payload,
        sources: payload.sources,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader
        title="AIチャット"
        description="社内ナレッジを参照しながら質問できます（回答・根拠・参照元を分離表示）"
      />

      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardBody className="flex flex-1 flex-col overflow-hidden p-0">
          <div className="flex-1 overflow-y-auto p-4 lg:p-6">
            {messages.length === 0 ? (
              <EmptyState
                title="質問を入力してください"
                description="営業規定、引継ぎ、担当者、FAQ などについてお尋ねください"
              />
            ) : (
              <div className="mx-auto max-w-3xl space-y-8">
                {messages.map((m, idx) => {
                  const prevUser = idx > 0 && messages[idx - 1]?.role === 'user' ? messages[idx - 1] : null;
                  return m.role === 'user' ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-xl bg-navy-800 px-4 py-3 text-sm leading-relaxed text-white">
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ) : m.payload ? (
                    <div key={m.id}>
                      <AssistantMessage
                        payload={m.payload}
                        messageId={m.id}
                        question={prevUser?.content}
                        onFeedback={
                          feedbackSent.has(m.id)
                            ? undefined
                            : (rating) =>
                                void sendFeedback(
                                  m.id,
                                  prevUser?.content ?? '',
                                  m.payload!.answer,
                                  rating
                                )
                        }
                      />
                      {feedbackSent.has(m.id) && (
                        <p className="mt-2 text-center text-xs text-slate-400">フィードバックを送信しました</p>
                      )}
                    </div>
                  ) : (
                    <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                      {m.content}
                    </div>
                  )
                })}
                {loading && (
                  <p className="text-center text-sm text-slate-400">回答を生成しています...</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="質問を入力..."
                rows={2}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button onClick={send} disabled={loading || !input.trim()} className="shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
