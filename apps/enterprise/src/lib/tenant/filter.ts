import type { SessionUser } from '@/types';
import { DEMO_COMPANY_ID } from './constants';

/** エンティティを company_id でフィルタ（モック / クライアント側二重チェック） */
export function filterByCompany<T extends { company_id?: string }>(
  items: T[],
  companyId: string
): T[] {
  return items.filter((item) => (item.company_id ?? DEMO_COMPANY_ID) === companyId);
}

export function resolveEffectiveCompanyId(user: SessionUser | null): string {
  if (!user) return DEMO_COMPANY_ID;
  return user.tenant_company_id ?? user.company_id ?? DEMO_COMPANY_ID;
}

export function resolveEffectiveCompanyName(user: SessionUser | null): string {
  if (!user) return DEMO_COMPANY_ID;
  return user.tenant_company_name ?? user.company_name ?? DEMO_COMPANY_ID;
}

export function isSuperAdmin(role: string): boolean {
  return role === 'super_admin';
}
