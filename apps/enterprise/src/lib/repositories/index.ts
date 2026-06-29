import { createBrowserClient } from '@/lib/supabase/client';
import { generatePlainToken, hashToken } from '@/lib/token-pass/hash';
import { SECURITY_POLICY } from '@/lib/security/config';
import { isSupabaseConfigured } from '@/lib/env';
import { filterByCompany } from '@/lib/tenant/filter';
import {
  MOCK_AUDIT_LOGS,
  MOCK_CONTACTS,
  MOCK_FILE_CONNECTIONS,
  MOCK_HANDOVERS,
  MOCK_KNOWLEDGE,
  MOCK_TOKEN_PASSES,
  MOCK_USERS,
} from '@/lib/mock-data';
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
import {
  mapAuditRow,
  mapContactRow,
  mapFileConnectionRow,
  mapHandoverRow,
  mapKnowledgeRow,
  mapTokenPassRow,
  mapUserRow,
} from './mappers';

export type DataSource = 'mock' | 'supabase';

export interface FetchResult<T> {
  data: T;
  source: DataSource;
}

async function withSupabase<T>(
  mock: T,
  query: (client: NonNullable<ReturnType<typeof createBrowserClient>>) => Promise<T | null>
): Promise<FetchResult<T>> {
  if (!isSupabaseConfigured()) {
    return { data: mock, source: 'mock' };
  }
  const client = createBrowserClient();
  if (!client) {
    return { data: mock, source: 'mock' };
  }
  try {
    const result = await query(client);
    if (result === null) {
      return { data: mock, source: 'mock' };
    }
    return { data: result, source: 'supabase' };
  } catch {
    return { data: mock, source: 'mock' };
  }
}

export async function fetchKnowledgeItems(
  companyId: string
): Promise<FetchResult<KnowledgeItem[]>> {
  const mock = filterByCompany(MOCK_KNOWLEDGE, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('knowledge_items')
      .select('*, departments:department_id(name)')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => mapKnowledgeRow(row as Record<string, unknown>));
  });
}

export async function fetchHandoverItems(
  companyId: string
): Promise<FetchResult<HandoverItem[]>> {
  const mock = filterByCompany(MOCK_HANDOVERS, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('handover_items')
      .select('*, departments:department_id(name)')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => mapHandoverRow(row as Record<string, unknown>));
  });
}

export async function createHandoverItem(
  item: Omit<HandoverItem, 'id' | 'updated_at'> & { created_by?: string }
): Promise<HandoverItem | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createBrowserClient();
  if (!client) return null;

  const { data, error } = await client
    .from('handover_items')
    .insert({
      company_id: item.company_id,
      title: item.title,
      content: item.content,
      from_person: item.from_person,
      to_person: item.to_person,
      department_id: item.department_id,
      classification: item.classification,
      status: item.status,
      due_date: item.due_date,
      created_by: item.created_by ?? null,
    })
    .select('*, departments:department_id(name)')
    .single();

  if (error || !data) return null;
  return mapHandoverRow(data as Record<string, unknown>);
}

export async function fetchContacts(
  companyId: string
): Promise<FetchResult<ResponsiblePerson[]>> {
  const mock = filterByCompany(MOCK_CONTACTS, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('responsible_persons')
      .select('*, departments:department_id(name)')
      .eq('company_id', companyId)
      .order('full_name');
    if (error || !data) return null;
    return data.map((row) => mapContactRow(row as Record<string, unknown>));
  });
}

export async function fetchAuditLogs(companyId: string): Promise<FetchResult<AuditLog[]>> {
  const mock = filterByCompany(MOCK_AUDIT_LOGS, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('audit_logs')
      .select('*, users:user_id(full_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) return null;
    return data.map((row) => mapAuditRow(row as Record<string, unknown>));
  });
}

export async function fetchTokenPasses(
  companyId: string
): Promise<FetchResult<TokenPass[]>> {
  const mock = filterByCompany(MOCK_TOKEN_PASSES, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('token_passes')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => mapTokenPassRow(row as Record<string, unknown>));
  });
}

export async function createTokenPass(input: {
  company_id: string;
  label: string;
  expires_at: string;
  created_by?: string;
}): Promise<TokenPass | null> {
  const plainCode = generatePlainToken();
  const tokenHash = hashToken(plainCode);

  if (!isSupabaseConfigured()) {
    return {
      id: `tp-${Date.now()}`,
      company_id: input.company_id,
      label: input.label,
      classification_scope: ['confidential'],
      allowed_roles: ['employee', 'manager', 'executive', 'admin'],
      expires_at: input.expires_at,
      issued_to: null,
      created_by: input.created_by ?? 'system',
      is_active: true,
      used_count: 0,
      max_uses: SECURITY_POLICY.token_pass.default_max_uses,
      revoked_at: null,
      last_used_at: null,
      created_at: new Date().toISOString(),
      plain_code: plainCode,
    };
  }

  const client = createBrowserClient();
  if (!client) return null;

  const { data, error } = await client
    .from('token_passes')
    .insert({
      company_id: input.company_id,
      token_hash: tokenHash,
      label: input.label,
      classification_scope: ['confidential'],
      allowed_roles: ['employee', 'manager', 'executive', 'admin'],
      expires_at: input.expires_at,
      created_by: input.created_by ?? null,
      is_active: true,
      max_uses: SECURITY_POLICY.token_pass.default_max_uses,
    })
    .select('*')
    .single();

  if (error || !data) return null;
  return { ...mapTokenPassRow(data as Record<string, unknown>), plain_code: plainCode };
}

export async function updateTokenPassActive(
  id: string,
  is_active: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const client = createBrowserClient();
  if (!client) return false;

  const { error } = await client.from('token_passes').update({ is_active }).eq('id', id);
  return !error;
}

export async function fetchFileConnections(
  companyId: string
): Promise<FetchResult<FileConnection[]>> {
  const mock = filterByCompany(MOCK_FILE_CONNECTIONS, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('file_connections')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => mapFileConnectionRow(row as Record<string, unknown>));
  });
}

export async function updateFileConnectionSync(id: string): Promise<FileConnection | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createBrowserClient();
  if (!client) return null;

  const { data, error } = await client
    .from('file_connections')
    .update({
      status: 'connected',
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) return null;
  return mapFileConnectionRow(data as Record<string, unknown>);
}

export async function fetchUsers(companyId: string): Promise<FetchResult<User[]>> {
  const mock = filterByCompany(MOCK_USERS, companyId);
  return withSupabase(mock, async (client) => {
    const { data, error } = await client
      .from('users')
      .select('*, departments:department_id(name)')
      .eq('company_id', companyId)
      .order('full_name');
    if (error || !data) return null;
    return data.map((row) => mapUserRow(row as Record<string, unknown>));
  });
}

export async function updateUserRole(id: string, role: UserRole): Promise<boolean> {
  if (role === 'super_admin') return false;
  if (!isSupabaseConfigured()) return false;
  const client = createBrowserClient();
  if (!client) return false;

  const { error } = await client
    .from('users')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}
