import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser, UserRole } from '@/types';
import { DEMO_COMPANY_ID, DEMO_COMPANY_NAME } from '@/lib/tenant/constants';

interface UserProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  department_id: string | null;
  is_active: boolean;
  departments: { name: string } | { name: string }[] | null;
  companies: { name: string } | { name: string }[] | null;
}

function joinName(
  rel: { name: string } | { name: string }[] | null
): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  return rel.name;
}

/** auth.users と public.users を連携してセッションユーザーを構築。失敗時は employee として安全側に倒す */
export async function fetchUserProfile(
  client: SupabaseClient,
  authUserId: string,
  authEmail?: string | null
): Promise<SessionUser> {
  const safeFallback = (id: string, email: string): SessionUser => {
    const name = email.split('@')[0] || 'ユーザー';
    return {
      id,
      email,
      full_name: name,
      display_name: name,
      role: 'employee',
      company_id: DEMO_COMPANY_ID,
      company_name: DEMO_COMPANY_NAME,
      department_id: null,
    };
  };

  try {
    const { data, error } = await client
      .from('users')
      .select(
        'id, email, full_name, role, company_id, department_id, is_active, departments(name), companies(name)'
      )
      .eq('id', authUserId)
      .maybeSingle();

    if (error || !data) {
      return safeFallback(authUserId, authEmail ?? '');
    }

    const row = data as UserProfileRow;
    if (!row.is_active) {
      return safeFallback(authUserId, row.email ?? authEmail ?? '');
    }

    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      display_name: row.full_name,
      role: row.role ?? 'employee',
      company_id: row.company_id ?? DEMO_COMPANY_ID,
      company_name: joinName(row.companies) ?? DEMO_COMPANY_NAME,
      department_id: row.department_id,
      department_name: joinName(row.departments),
    };
  } catch {
    return safeFallback(authUserId, authEmail ?? '');
  }
}
