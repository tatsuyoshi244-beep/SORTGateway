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
  const [loginId, setLoginId] = useState('');
  const [plan, setPlan] = useState<Company['plan']>('standard');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmployeeNumber, setAdminEmployeeNumber] = useState('ADM-001');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');

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
    if (!name.trim() || !loginId.trim() || !user) return;
    setSubmitting(true);
    setFormError('');
    setMessage('');
    try {
      const res = await apiFetch(user, '/api/companies', {
        method: 'POST',
        body: JSON.stringify({
          name,
          loginId,
          plan,
          adminFullName,
          adminEmployeeNumber,
          adminEmail,
          adminPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error?.message ?? '企業の発行に失敗しました');
        return;
      }
      setName('');
      setLoginId('');
      setAdminFullName('');
      setAdminEmployeeNumber('ADM-001');
      setAdminEmail('');
      setAdminPassword('');
      setShowForm(false);
      setMessage('企業と初期管理者を発行しました。');
      await load();
    } finally {
      setSubmitting(false);
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

        {message && (
          <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        {showForm && (
          <Card className="mb-6">
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="company-name">企業名</Label>
                <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="company-login-id">企業ID（ログイン用）</Label>
                <Input
                  id="company-login-id"
                  value={loginId}
                  placeholder="acme-corp"
                  autoCapitalize="none"
                  onChange={(e) => setLoginId(e.target.value.toLowerCase())}
                />
              </div>
              <div>
                <Label htmlFor="company-plan">プラン</Label>
                <Select id="company-plan" value={plan} onChange={(e) => setPlan(e.target.value as Company['plan'])}>
                  <option value="starter">Starter</option>
                  <option value="standard">Standard</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </div>
              <div className="md:col-span-2 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-800">初期管理者</p>
                <p className="mt-1 text-xs text-slate-500">
                  企業発行と同時に、その企業で最初に社員を登録できる管理者を作成します。
                </p>
              </div>
              <div>
                <Label htmlFor="initial-admin-name">氏名</Label>
                <Input id="initial-admin-name" value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="initial-admin-number">社員番号</Label>
                <Input
                  id="initial-admin-number"
                  value={adminEmployeeNumber}
                  onChange={(e) => setAdminEmployeeNumber(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label htmlFor="initial-admin-email">メールアドレス（認証管理用）</Label>
                <Input
                  id="initial-admin-email"
                  type="email"
                  value={adminEmail}
                  autoComplete="email"
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="initial-admin-password">初期パスワード（12文字以上）</Label>
                <Input
                  id="initial-admin-password"
                  type="password"
                  value={adminPassword}
                  autoComplete="new-password"
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              {formError && (
                <p role="alert" className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => void create()} disabled={submitting}>
                  {submitting ? '発行中...' : '企業と初期管理者を発行'}
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>
                  キャンセル
                </Button>
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
                    <th className="px-6 py-3">企業ID</th>
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
                      <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.login_id}</td>
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
