'use client';

import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api/client';
import { useRepositoryData } from '@/lib/hooks/use-repository-data';
import { fetchUsers, updateUserRole } from '@/lib/repositories';
import { MOCK_DEPARTMENTS, MOCK_USERS } from '@/lib/mock-data';
import { filterByCompany } from '@/lib/tenant/filter';
import type { UserRole } from '@/types';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { RoleBadge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';

export default function AdminUsersPage() {
  const { user: currentUser, effectiveCompanyId } = useAuth();
  const { data: users, loading, source, setData } = useRepositoryData(
    `users-${effectiveCompanyId}`,
    () => fetchUsers(effectiveCompanyId),
    filterByCompany(MOCK_USERS, effectiveCompanyId)
  );

  const updateRole = async (id: string, role: UserRole) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;

    if (source === 'supabase') {
      const ok = await updateUserRole(id, role);
      if (!ok) return;
    }

    setData((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));

    if (currentUser) {
      apiFetch(currentUser, '/api/audit', {
        method: 'POST',
        body: JSON.stringify({
          action: 'role.change',
          resourceType: 'user',
          resourceId: id,
          targetUserId: id,
          targetRole: role,
          details: `ロール変更: ${target.full_name} → ${role}`,
        }),
      }).catch(() => {});
    }
  };

  return (
    <RouteGuard route="admin_users">
      <div>
        <PageHeader
          title="ユーザー・ロール管理"
          description="社員アカウントとロール（employee / manager / executive / admin）の管理"
        />

        {loading ? (
          <p className="text-sm text-slate-500">ユーザーを読み込んでいます...</p>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">氏名</th>
                    <th className="px-6 py-3">メール</th>
                    <th className="px-6 py-3">部署</th>
                    <th className="px-6 py-3">ロール</th>
                    <th className="px-6 py-3">変更</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{u.full_name}</td>
                      <td className="px-6 py-4 text-slate-600">{u.email}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {u.department_name ?? '—'}
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          className="w-36"
                          value={u.role}
                          onChange={(e) => void updateRole(u.id, e.target.value as UserRole)}
                        >
                          <option value="employee">一般社員</option>
                          <option value="manager">責任者</option>
                          <option value="executive">役員</option>
                          <option value="admin">管理者</option>
                        </Select>
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
