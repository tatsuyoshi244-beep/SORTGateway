import type { SupabaseClient } from '@supabase/supabase-js';
import type { User, UserRole } from '@/types';

export interface TenantUserInput {
  companyId: string;
  fullName: string;
  employeeNumber: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'super_admin'>;
  departmentId?: string | null;
}

export class ProvisioningError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ProvisioningError';
  }
}

export async function createTenantUser(
  client: SupabaseClient,
  input: TenantUserInput
): Promise<User> {
  if (input.departmentId) {
    const { data: department, error } = await client
      .from('departments')
      .select('id, name')
      .eq('id', input.departmentId)
      .eq('company_id', input.companyId)
      .maybeSingle();
    if (error || !department) {
      throw new ProvisioningError('指定された部署はこの企業に存在しません。', 400);
    }
  }

  const { data: duplicate } = await client
    .from('users')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('employee_number', input.employeeNumber)
    .maybeSingle();
  if (duplicate) {
    throw new ProvisioningError('この社員番号は既に登録されています。', 409);
  }

  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authError || !authData.user) {
    throw new ProvisioningError('社員アカウントを作成できませんでした。', 409);
  }

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await client
    .from('users')
    .update({
      company_id: input.companyId,
      employee_number: input.employeeNumber,
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      department_id: input.departmentId ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('*, departments:department_id(name)')
    .single();

  if (profileError || !profile) {
    await client.auth.admin.deleteUser(userId);
    throw new ProvisioningError('社員プロフィールを作成できませんでした。', 500);
  }

  const joined = profile.departments as { name?: string } | { name?: string }[] | null;
  const departmentName = Array.isArray(joined) ? joined[0]?.name : joined?.name;
  return {
    id: String(profile.id),
    company_id: String(profile.company_id),
    employee_number: String(profile.employee_number),
    email: String(profile.email),
    full_name: String(profile.full_name),
    role: profile.role as UserRole,
    department_id: profile.department_id ? String(profile.department_id) : null,
    department_name: departmentName,
    is_active: Boolean(profile.is_active),
    created_at: String(profile.created_at),
  };
}
