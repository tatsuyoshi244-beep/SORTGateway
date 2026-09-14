'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { allowsDemoAuth } from '@/lib/env';
import { APPROVAL_STATUS_LABELS, canTransitionWorkflow } from '@/lib/knowledge/workflow';
import { MOCK_KNOWLEDGE } from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import type { KnowledgeApprovalStatus, KnowledgeItem } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

const STATUS_FLOW: KnowledgeApprovalStatus[] = ['draft', 'review', 'approved', 'published'];

function demoStorageKey(companyId: string): string {
  return `sort-gateway-demo-knowledge:${companyId}`;
}

function loadDemoItems(companyId: string): KnowledgeItem[] {
  const fallback = filterByCompany(MOCK_KNOWLEDGE, companyId);
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(demoStorageKey(companyId));
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? (parsed as KnowledgeItem[]) : fallback;
  } catch {
    return fallback;
  }
}

function saveDemoItems(companyId: string, items: KnowledgeItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(demoStorageKey(companyId), JSON.stringify(items));
}

export default function AdminKnowledgePage() {
  const { user, effectiveCompanyId } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    if (allowsDemoAuth()) {
      setItems(loadDemoItems(effectiveCompanyId));
      return;
    }
    try {
      const res = await apiFetch(user, '/api/knowledge');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'ナレッジを読み込めませんでした');
      if (data.knowledge) setItems(data.knowledge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ナレッジを読み込めませんでした');
    }
  }, [effectiveCompanyId, user]);

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
    setError(null);
    setNotice(null);

    if (allowsDemoAuth()) {
      const now = new Date().toISOString();
      let next: KnowledgeItem[];
      if (editing) {
        const updated: KnowledgeItem = {
          ...editing,
          ...form,
          version: editing.version + 1,
          approval_status: 'draft',
          updated_at: now,
          updated_by: user.id,
          updated_by_name: user.full_name,
          approved_by: null,
          approved_by_name: null,
        };
        next = items.map((item) => (item.id === editing.id ? updated : item));
      } else {
        const created: KnowledgeItem = {
          id: `demo-kn-${Date.now()}`,
          company_id: effectiveCompanyId,
          title: form.title.trim(),
          content: form.content.trim(),
          summary: form.summary.trim(),
          category: form.category.trim() || 'その他',
          classification: form.classification,
          department_id: user.department_id,
          department_name: user.department_name,
          tags: [],
          created_by: user.id,
          updated_at: now,
          approval_status: 'draft',
          version: 1,
          responsible_person_id: user.id,
          responsible_person_name: user.full_name,
          updated_by: user.id,
          updated_by_name: user.full_name,
          approved_by: null,
          approved_by_name: null,
        };
        next = [created, ...items];
      }
      setItems(next);
      saveDemoItems(effectiveCompanyId, next);
      setNotice('この端末のデモデータとして保存しました');
      openNew();
      return;
    }

    try {
      const res = await apiFetch(user, editing ? `/api/knowledge/${editing.id}` : '/api/knowledge', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(
          editing
            ? { ...form, change_reason: form.change_reason || '内容更新' }
            : { ...form, company_id: effectiveCompanyId }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? '保存できませんでした');
      setNotice(editing ? 'ナレッジを更新しました' : 'ナレッジを登録しました');
      openNew();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存できませんでした');
    }
  };

  const transition = async (id: string, status: KnowledgeApprovalStatus) => {
    if (!user) return;
    setError(null);
    setNotice(null);
    if (allowsDemoAuth()) {
      const now = new Date().toISOString();
      const next = items.map((item) =>
        item.id === id
          ? {
              ...item,
              approval_status: status,
              updated_at: now,
              updated_by: user.id,
              updated_by_name: user.full_name,
              approved_by: status === 'approved' || status === 'published' ? user.id : item.approved_by,
              approved_by_name:
                status === 'approved' || status === 'published' ? user.full_name : item.approved_by_name,
            }
          : item
      );
      setItems(next);
      saveDemoItems(effectiveCompanyId, next);
      setNotice(`ステータスを${APPROVAL_STATUS_LABELS[status]}に変更しました`);
      return;
    }
    try {
      const res = await apiFetch(user, `/api/knowledge/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'ステータスを変更できませんでした');
      setNotice(`ステータスを${APPROVAL_STATUS_LABELS[status]}に変更しました`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステータスを変更できませんでした');
    }
  };

  const remove = async (id: string) => {
    if (!user || !confirm('このナレッジを削除しますか？')) return;
    setError(null);
    setNotice(null);
    if (allowsDemoAuth()) {
      const next = items.filter((item) => item.id !== id);
      setItems(next);
      saveDemoItems(effectiveCompanyId, next);
      setNotice('この端末のデモデータから削除しました');
      return;
    }
    try {
      const res = await apiFetch(user, `/api/knowledge/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? '削除できませんでした');
      setItems((prev) => prev.filter((item) => item.id !== id));
      setNotice('ナレッジを削除しました');
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除できませんでした');
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

        {allowsDemoAuth() && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            デモ環境の登録・編集内容は、この端末のブラウザにのみ保存されます。
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

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
                      <Button variant="ghost" size="sm" onClick={() => void remove(k.id)}>
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
