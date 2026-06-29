'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Company, CompanyStatus } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';

const STATUS_LABELS: Record<CompanyStatus, string> = {
  active: '稼働中',
  suspended: '停止',
  trial: 'トライアル',
};

export default function AdminCompaniesPage() {
  const { user, setActiveTenant } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<Company['plan']>('standard');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(user, '/api/companies');
      const data = await res.json();
      if (data.companies) setCompanies(data.companies);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim() || !slug.trim() || !user) return;
    const res = await apiFetch(user, '/api/companies', {
      method: 'POST',
      body: JSON.stringify({ name, slug, plan }),
    });
    if (res.ok) {
      setName('');
      setSlug('');
      setShowForm(false);
      await load();
    }
  };

  const updateStatus = async (id: string, status: CompanyStatus) => {
    if (!user) return;
    const res = await apiFetch(user, '/api/companies', {
      method: 'PATCH',
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) await load();
  };

  return (
    <RouteGuard route="admin_companies">
      <div>
        <PageHeader
          title="企業管理"
          description="SORT Gateway SaaS — テナント（企業）の登録・状態管理（super_admin 専用）"
          action={
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4" />
              企業登録
            </Button>
          }
        />

        {showForm && (
          <Card className="mb-6">
            <CardBody className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>企業名</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>スラッグ（URL用）</Label>
                <Input
                  value={slug}
                  placeholder="acme-corp"
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div>
                <Label>プラン</Label>
                <Select value={plan} onChange={(e) => setPlan(e.target.value as Company['plan'])}>
                  <option value="starter">Starter</option>
                  <option value="standard">Standard</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Button onClick={() => void create()}>登録</Button>
              </div>
            </CardBody>
          </Card>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : companies.length === 0 ? (
          <EmptyState title="登録企業がありません" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">企業名</th>
                    <th className="px-6 py-3">スラッグ</th>
                    <th className="px-6 py-3">プラン</th>
                    <th className="px-6 py-3">状態</th>
                    <th className="px-6 py-3">ユーザー</th>
                    <th className="px-6 py-3">ドキュメント</th>
                    <th className="px-6 py-3">最終利用</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                      <td className="px-6 py-3 capitalize">{c.plan}</td>
                      <td className="px-6 py-3">
                        <Select
                          className="w-28"
                          value={c.status}
                          onChange={(e) =>
                            void updateStatus(c.id, e.target.value as CompanyStatus)
                          }
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-6 py-3">{c.user_count ?? '—'}</td>
                      <td className="px-6 py-3">{c.document_count ?? '—'}</td>
                      <td className="px-6 py-3 text-slate-500">
                        {formatDate(c.last_activity_at ?? c.updated_at)}
                      </td>
                      <td className="px-6 py-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setActiveTenant(c.id, c.name)}
                        >
                          切替
                        </Button>
                      </td>
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
