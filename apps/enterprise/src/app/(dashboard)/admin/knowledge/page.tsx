'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { APPROVAL_STATUS_LABELS, canTransitionWorkflow } from '@/lib/knowledge/workflow';
import type { KnowledgeApprovalStatus, KnowledgeItem } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

const STATUS_FLOW: KnowledgeApprovalStatus[] = ['draft', 'review', 'approved', 'published'];

export default function AdminKnowledgePage() {
  const { user, effectiveCompanyId } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    summary: '',
    category: '規定・ルール',
    classification: 'internal' as KnowledgeItem['classification'],
    change_reason: '',
  });

  const load = useCallback(async () => {
    if (!user) return;
    const res = await apiFetch(user, '/api/knowledge');
    const data = await res.json();
    if (data.knowledge) setItems(data.knowledge);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({
      title: '',
      content: '',
      summary: '',
      category: '規定・ルール',
      classification: 'internal',
      change_reason: '',
    });
  };

  const save = async () => {
    if (!user || !form.title.trim() || !form.content.trim()) return;

    if (editing) {
      const res = await apiFetch(user, `/api/knowledge/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          change_reason: form.change_reason || '内容更新',
        }),
      });
      const data = await res.json();
      if (data.knowledge) {
        setItems((prev) => prev.map((k) => (k.id === editing.id ? data.knowledge : k)));
      }
    } else {
      const res = await apiFetch(user, '/api/knowledge', {
        method: 'POST',
        body: JSON.stringify({ ...form, company_id: effectiveCompanyId }),
      });
      const data = await res.json();
      if (data.knowledge) setItems((prev) => [data.knowledge, ...prev]);
    }
    openNew();
    void load();
  };

  const transition = async (id: string, status: KnowledgeApprovalStatus) => {
    if (!user) return;
    const res = await apiFetch(user, `/api/knowledge/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (res.ok) void load();
  };

  const remove = (id: string) => {
    if (confirm('このナレッジを削除しますか？（デモでは一覧から非表示のみ）')) {
      setItems((prev) => prev.filter((k) => k.id !== id));
    }
  };

  const nextStatuses = (item: KnowledgeItem): KnowledgeApprovalStatus[] => {
    if (!user) return [];
    return STATUS_FLOW.filter(
      (s) => s !== item.approval_status && canTransitionWorkflow(user.role, item.approval_status, s)
    );
  };

  return (
    <RouteGuard route="admin_knowledge">
      <div>
        <PageHeader
          title="ナレッジ登録・編集"
          description="承認ワークフロー: Draft → Review → Approved → Published（Published のみ AI 検索対象）"
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              新規登録
            </Button>
          }
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody>
              <h3 className="mb-4 font-semibold">{editing ? '編集' : '新規登録'}</h3>
              <div className="space-y-4">
                <div>
                  <Label>タイトル</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>要約</Label>
                  <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>カテゴリ</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div>
                    <Label>情報分類</Label>
                    <Select
                      value={form.classification}
                      onChange={(e) =>
                        setForm({ ...form, classification: e.target.value as KnowledgeItem['classification'] })
                      }
                    >
                      <option value="internal">社内一般</option>
                      <option value="department">部署限定</option>
                      <option value="confidential">機密</option>
                      <option value="executive_only">役員限定</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>内容</Label>
                  <Textarea rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
                </div>
                {editing && (
                  <div>
                    <Label>変更理由</Label>
                    <Input value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} />
                  </div>
                )}
                <Button onClick={() => void save()}>{editing ? '更新（Draft に戻る）' : '登録'}</Button>
              </div>
            </CardBody>
          </Card>

          <div className="space-y-2">
            {items.map((k) => (
              <Card key={k.id}>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{k.title}</p>
                      <p className="mt-1 text-xs text-slate-500">v{k.version} · {APPROVAL_STATUS_LABELS[k.approval_status]}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ClassificationBadge value={k.classification} />
                        <span className="text-xs text-slate-400">{formatDate(k.updated_at)}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        担当: {k.department_name ?? '—'} / {k.responsible_person_name ?? '—'}
                      </p>
                      <p className="text-xs text-slate-400">
                        更新: {k.updated_by_name ?? '—'} · 承認: {k.approved_by_name ?? '—'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(k);
                          setForm({
                            title: k.title,
                            content: k.content,
                            summary: k.summary,
                            category: k.category,
                            classification: k.classification,
                            change_reason: '',
                          });
                        }}
                      >
                        編集
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(k.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses(k).map((s) => (
                      <Button key={s} size="sm" variant="secondary" onClick={() => void transition(k.id, s)}>
                        → {APPROVAL_STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
