'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import {
  createTokenPass,
  fetchTokenPasses,
  updateTokenPassActive,
} from '@/lib/repositories';
import { MOCK_TOKEN_PASSES } from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { ClassificationBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';

export default function AdminTokenPassesPage() {
  const { user, effectiveCompanyId } = useAuth();
  const { data: passes, loading, source, setData } = useRepositoryData(
    `token-passes-${effectiveCompanyId}`,
    () => fetchTokenPasses(effectiveCompanyId),
    filterByCompany(MOCK_TOKEN_PASSES, effectiveCompanyId)
  );
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState('');
  const [issuedPlainCode, setIssuedPlainCode] = useState<string | null>(null);

  const issue = async () => {
    if (!label.trim() || !expires) return;

    const created = await createTokenPass({
      company_id: effectiveCompanyId,
      label,
      expires_at: new Date(expires).toISOString(),
      created_by: user?.id,
    });

    if (created) {
      setData((prev) => [created, ...prev]);
      if (created.plain_code) {
        setIssuedPlainCode(created.plain_code);
      }
    }

    setLabel('');
    setExpires('');
    setShowForm(false);
  };

  const toggle = async (id: string) => {
    const target = passes.find((p) => p.id === id);
    if (!target) return;

    if (source === 'supabase') {
      const ok = await updateTokenPassActive(id, !target.is_active);
      if (ok) {
        setData((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p))
        );
      }
    } else {
      setData((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !p.is_active } : p))
      );
    }
  };

  return (
    <RouteGuard route="admin_token_passes">
      <div>
        <PageHeader
          title="トークンパス管理"
          description="機密情報へのアクセス用トークンの発行と有効期限管理（平文は発行時のみ表示・DBにはハッシュ保存）"
          action={
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" />
              新規発行
            </Button>
          }
        />

        {issuedPlainCode && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardBody>
              <p className="font-semibold text-amber-900">発行したトークン（この画面を閉じると再表示できません）</p>
              <p className="mt-2 font-mono text-lg text-navy-900">{issuedPlainCode}</p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => setIssuedPlainCode(null)}>
                確認しました
              </Button>
            </CardBody>
          </Card>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardBody className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>ラベル</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div>
                <Label>有効期限</Label>
                <Input
                  type="datetime-local"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={() => void issue()}>発行</Button>
              </div>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">トークンパスを読み込んでいます...</p>
        ) : (
          <div className="space-y-3">
            {passes.map((p) => {
              const expired = new Date(p.expires_at) < new Date();
              return (
                <Card key={p.id}>
                  <CardBody className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm text-slate-500">token_hash 保存済み</p>
                      <p className="mt-1 font-medium text-slate-900">{p.label}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        期限: {formatDate(p.expires_at)}
                        {expired && <span className="ml-2 text-red-600">（期限切れ）</span>}
                        {p.revoked_at && <span className="ml-2 text-red-600">（失効）</span>}
                      </p>
                      <p className="text-sm text-slate-500">
                        利用: {p.used_count}
                        {p.max_uses !== null && ` / ${p.max_uses}`}
                        {p.last_used_at && ` · 最終利用 ${formatDate(p.last_used_at)}`}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.classification_scope.map((c) => (
                          <ClassificationBadge key={c} value={c} />
                        ))}
                      </div>
                    </div>
                    <Button
                      variant={p.is_active ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => void toggle(p.id)}
                    >
                      {p.is_active ? '無効化' : '有効化'}
                    </Button>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
