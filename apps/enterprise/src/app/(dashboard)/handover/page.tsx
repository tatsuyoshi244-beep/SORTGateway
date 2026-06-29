'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { filterHandoversForUser } from '@/lib/data-access';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import {
  createHandoverItem,
  fetchHandoverItems,
} from '@/lib/repositories';
import { filterByCompany } from '@/lib/tenant/filter';
import { MOCK_HANDOVERS } from '@/lib/mock-data';
import type { HandoverItem } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { ClassificationBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { RouteGuard } from '@/components/auth/RouteGuard';

const STATUS_MAP = {
  draft: { label: '下書き', className: 'bg-slate-100 text-slate-600' },
  published: { label: '公開中', className: 'bg-green-50 text-green-700' },
  archived: { label: 'アーカイブ', className: 'bg-slate-100 text-slate-500' },
};

export default function HandoverPage() {
  const { user, activeTokenPass, effectiveCompanyId } = useAuth();
  const { data: allItems, loading, source, setData } = useRepositoryData(
    `handover-${effectiveCompanyId}`,
    () => fetchHandoverItems(effectiveCompanyId),
    filterByCompany(MOCK_HANDOVERS, effectiveCompanyId)
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', from_person: '', to_person: '' });

  const canManage = user
    ? ['manager', 'executive', 'admin', 'super_admin'].includes(user.role)
    : false;
  const visible = useMemo(
    () => (user ? filterHandoversForUser(user, !!activeTokenPass, allItems) : []),
    [user, activeTokenPass, allItems]
  );

  if (!user) return null;

  const addHandover = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (source === 'supabase' && !user.department_id) return;

    const newItem: HandoverItem = {
      id: `ho-${Date.now()}`,
      company_id: effectiveCompanyId,
      title: form.title,
      content: form.content,
      from_person: form.from_person || user.full_name,
      to_person: form.to_person || null,
      department_id: user.department_id ?? 'dept-1',
      department_name: user.department_name,
      classification: 'department',
      status: 'published',
      due_date: null,
      updated_at: new Date().toISOString(),
    };

    if (source === 'supabase') {
      const created = await createHandoverItem({
        ...newItem,
        created_by: user.id,
      });
      if (created) {
        setData((prev) => [created, ...prev]);
      }
    } else {
      setData((prev) => [newItem, ...prev]);
    }

    setForm({ title: '', content: '', from_person: '', to_person: '' });
    setShowForm(false);
  };

  return (
    <RouteGuard route="handover">
      <div>
        <PageHeader
          title="引継ぎ情報"
          description="案件・業務の引継ぎ内容を確認・登録できます"
          action={
            canManage ? (
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4" />
                引継ぎ登録
              </Button>
            ) : undefined
          }
        />

        {showForm && canManage && (
          <Card className="mb-6">
            <CardBody className="space-y-4">
              <div>
                <Label>タイトル</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>引継ぎ元</Label>
                  <Input
                    value={form.from_person}
                    placeholder={user.full_name}
                    onChange={(e) => setForm({ ...form, from_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label>引継ぎ先</Label>
                  <Input
                    value={form.to_person}
                    onChange={(e) => setForm({ ...form, to_person: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>内容</Label>
                <Textarea
                  rows={4}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <Button onClick={() => void addHandover()}>登録</Button>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">引継ぎ情報を読み込んでいます...</p>
        ) : visible.length === 0 ? (
          <EmptyState
            title="閲覧可能な引継ぎ情報がありません"
            description="部署・権限に応じた情報が表示されます"
          />
        ) : (
          <div className="grid gap-4">
            {visible.map((h) => (
              <Card key={h.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{h.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {h.from_person}
                        {h.to_person ? ` → ${h.to_person}` : ''}
                        {h.department_name && ` · ${h.department_name}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge status={h.status} map={STATUS_MAP} />
                      <ClassificationBadge value={h.classification} />
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {h.content}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">
                    更新: {formatDate(h.updated_at)}
                    {h.due_date && ` · 期限: ${h.due_date}`}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
