'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { fetchUsers } from '@/lib/repositories';
import { MOCK_DEPARTMENTS, MOCK_USERS } from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import type { UserRole } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { RoleBadge } from '@/components/ui/Badge';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DataLoadError } from '@/components/ui/DataLoadError';

export default function AdminUsersPage() {
  const { user: currentUser, effectiveCompanyId } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'super_admin'>>('employee');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const { data: users, loading, source, error, reload, setData } = useRepositoryData(
    `users-${effectiveCompanyId}`,
    () => fetchUsers(effectiveCompanyId),
    filterByCompany(MOCK_USERS, effectiveCompanyId),
    { persistMock: true, configuredInitial: [] }
  );

  const createUser = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    setFormError('');
    setMessage('');
    try {
      const response = await apiFetch(currentUser, '/api/users', {
        method: 'POST',
        body: JSON.stringify({ fullName, employeeNumber, email, password, role }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error?.message ?? '社員登録に失敗しました');
        return;
      }
      setData((previous) => [...previous, data.user]);
      setFullName('');
      setEmployeeNumber('');
      setEmail('');
      setPassword('');
      setRole('employee');
      setShowForm(false);
      setMessage('社員アカウントを登録しました。');
    } finally {
      setSubmitting(false);
    }
  };

  const updateRole = async (id: string, role: UserRole) => {
    const target = users.find((u) => u.id === id);
    if (!target || !currentUser) return;
    const response = await apiFetch(currentUser, '/api/users', {
      method: 'PATCH',
      body: JSON.stringify({ id, role }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFormError(data.error?.message ?? 'ロール変更に失敗しました');
      return;
    }
    setData((prev) => prev.map((item) => (item.id === id ? data.user : item)));
  };

  const updateActive = async (id: string, isActive: boolean) => {
    if (!currentUser) return;
    setFormError('');
    const response = await apiFetch(currentUser, '/api/users', {
      method: 'PATCH',
      body: JSON.stringify({ id, isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFormError(data.error?.message ?? '利用状態の変更に失敗しました');
      return;
    }
    setData((prev) => prev.map((item) => (item.id === id ? data.user : item)));
  };

  return (
    <RouteGuard route="admin_users">
      <div>
        <PageHeader
          title="ユーザー・ロール管理"
          description="社員アカウントとロール（employee / manager / executive / admin）の管理"
          action={
            <Button onClick={() => setShowForm((value) => !value)}>
              <Plus className="h-4 w-4" />
              社員登録
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
                <Label htmlFor="employee-name">氏名</Label>
                <Input id="employee-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="employee-number">社員番号</Label>
                <Input
                  id="employee-number"
                  value={employeeNumber}
                  onChange={(event) => setEmployeeNumber(event.target.value.toUpperCase())}
                  placeholder="EMP-001"
                />
              </div>
              <div>
                <Label htmlFor="employee-email">メールアドレス（認証管理用）</Label>
                <Input
                  id="employee-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="employee-password">初期パスワード（12文字以上）</Label>
                <Input
                  id="employee-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="employee-role">ロール</Label>
                <Select id="employee-role" value={role} onChange={(event) => setRole(event.target.value as Exclude<UserRole, 'super_admin'>)}>
                  <option value="employee">一般社員</option>
                  <option value="manager">責任者</option>
                  <option value="executive">役員</option>
                  <option value="admin">管理者</option>
                </Select>
              </div>
              {formError && (
                <p role="alert" className="md:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => void createUser()} disabled={submitting}>
                  {submitting ? '登録中...' : '社員を登録'}
                </Button>
                <Button variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>
                  キャンセル
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        {error ? (
          <DataLoadError message={error} onRetry={() => void reload()} />
        ) : loading ? (
          <p className="text-sm text-slate-500">ユーザーを読み込んでいます...</p>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">氏名</th>
                    <th className="px-6 py-3">社員番号</th>
                    <th className="px-6 py-3">部署</th>
                    <th className="px-6 py-3">ロール</th>
                    <th className="px-6 py-3">状態</th>
                    <th className="px-6 py-3">変更</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{u.full_name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{u.employee_number}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.department_name ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4">
                        <span className={u.is_active ? 'text-emerald-700' : 'text-red-600'}>
                          {u.is_active ? '有効' : '停止'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Select
                            className="w-36"
                            value={u.role}
                            disabled={u.id === currentUser?.id}
                            onChange={(e) => void updateRole(u.id, e.target.value as UserRole)}
                          >
                            <option value="employee">一般社員</option>
                            <option value="manager">責任者</option>
                            <option value="executive">役員</option>
                            <option value="admin">管理者</option>
                          </Select>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={u.id === currentUser?.id}
                            onClick={() => void updateActive(u.id, !u.is_active)}
                          >
                            {u.is_active ? '停止' : '再開'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardBody className="border-t border-slate-100 text-xs text-slate-400">
              部署マスタ: {MOCK_DEPARTMENTS.map((d) => d.name).join('、')}
              {source === 'supabase' && '（Supabase departments テーブル参照）'}
            </CardBody>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
