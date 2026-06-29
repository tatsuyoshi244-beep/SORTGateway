import type {
  AuditLog,
  FileConnection,
  HandoverItem,
  KnowledgeItem,
  ResponsiblePerson,
  TokenPass,
  User,
  UserRole,
} from '@/types';

type DeptJoin = { name: string } | { name: string }[] | null;

function deptName(departments: DeptJoin): string | undefined {
  if (!departments) return undefined;
  if (Array.isArray(departments)) return departments[0]?.name;
  return departments.name;
}

export function mapKnowledgeRow(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    title: row.title as string,
    content: row.content as string,
    summary: String(row.summary ?? ''),
    category: (row.category as string) ?? 'その他',
    classification: row.classification as KnowledgeItem['classification'],
    department_id: (row.department_id as string | null) ?? null,
    department_name: deptName(row.departments as DeptJoin),
    tags: (row.tags as string[]) ?? [],
    created_by: (row.created_by as string) ?? '',
    updated_at: row.updated_at as string,
    approval_status: (row.approval_status as KnowledgeItem['approval_status']) ?? 'published',
    version: Number(row.version ?? 1),
    responsible_person_id: row.responsible_person_id ? String(row.responsible_person_id) : null,
    responsible_person_name: row.responsible_person_name ? String(row.responsible_person_name) : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_by_name: row.updated_by_name ? String(row.updated_by_name) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_by_name: row.approved_by_name ? String(row.approved_by_name) : null,
  };
}

export function mapHandoverRow(row: Record<string, unknown>): HandoverItem {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    title: row.title as string,
    content: row.content as string,
    from_person: row.from_person as string,
    to_person: (row.to_person as string | null) ?? null,
    department_id: row.department_id as string,
    department_name: deptName(row.departments as DeptJoin),
    classification: row.classification as HandoverItem['classification'],
    status: row.status as HandoverItem['status'],
    due_date: (row.due_date as string | null) ?? null,
    updated_at: row.updated_at as string,
  };
}

export function mapContactRow(row: Record<string, unknown>): ResponsiblePerson {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    full_name: row.full_name as string,
    email: row.email as string,
    department_id: row.department_id as string,
    department_name: deptName(row.departments as DeptJoin),
    role_title: row.role_title as string,
    responsibilities: (row.responsibilities as string[]) ?? [],
    phone: (row.phone as string | null) ?? null,
    is_primary: Boolean(row.is_primary),
  };
}

export function mapAuditRow(row: Record<string, unknown>): AuditLog {
  const users = row.users as { full_name: string } | { full_name: string }[] | null;
  let userName = '—';
  if (users) {
    userName = Array.isArray(users) ? users[0]?.full_name ?? '—' : users.full_name;
  }

  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    user_id: (row.user_id as string) ?? '',
    user_name: userName,
    action: row.action as string,
    resource_type: row.resource_type as string,
    resource_id: (row.resource_id as string | null) ?? null,
    result: (row.result as AuditLog['result']) ?? 'success',
    details: (row.details as string) ?? '',
    ip_address: row.ip_address ? String(row.ip_address) : null,
    user_agent: row.user_agent ? String(row.user_agent) : null,
    created_at: row.created_at as string,
  };
}

export function mapTokenPassRow(row: Record<string, unknown>): TokenPass {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    label: row.label as string,
    classification_scope: row.classification_scope as TokenPass['classification_scope'],
    allowed_roles: (row.allowed_roles as TokenPass['allowed_roles']) ?? [
      'employee',
      'manager',
      'executive',
      'admin',
    ],
    issued_to: (row.issued_to as string | null) ?? null,
    created_by: (row.created_by as string) ?? 'system',
    expires_at: row.expires_at as string,
    is_active: Boolean(row.is_active),
    used_count: Number(row.used_count ?? 0),
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    revoked_at: (row.revoked_at as string | null) ?? null,
    last_used_at: (row.last_used_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export function mapFileConnectionRow(row: Record<string, unknown>): FileConnection {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    name: row.name as string,
    provider: row.provider as FileConnection['provider'],
    status: row.status as FileConnection['status'],
    sync_path: row.sync_path as string,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    department_id: (row.department_id as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    company_id: String(row.company_id ?? 'demo-company'),
    email: row.email as string,
    full_name: row.full_name as string,
    role: row.role as UserRole,
    department_id: (row.department_id as string | null) ?? null,
    department_name: deptName(row.departments as DeptJoin),
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string,
  };
}
