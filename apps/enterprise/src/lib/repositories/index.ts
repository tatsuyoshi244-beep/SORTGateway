import { createBrowserClient } from '@/lib/supabase/client';
import { generatePlainToken, hashToken } from '@/lib/token-pass/hash';
import { DEMO_TOKEN_PASS_CODE, isSupabaseConfigured } from '@/lib/env';
import { filterByCompany } from '@/lib/tenant/filter';
import {
  MOCK_AUDIT_LOGS,
  MOCK_CONTACTS,
  MOCK_DEPARTMENTS,
  MOCK_FILE_CONNECTIONS,
  MOCK_HANDOVERS,
  MOCK_KNOWLEDGE,
  MOCK_MEETING_MINUTES,
  MOCK_MINUTE_ACCESS_REQUESTS,
  MOCK_TOKEN_PASSES,
  MOCK_USERS,
} from '@/lib/mock-data';
import type {
  AuditLog,
  Department,
  FileConnection,
  HandoverItem,
  KnowledgeItem,
  MeetingMinute,
  MinuteAccessRequest,
  MinuteAccessRequestStatus,
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
  error?: string;
}

export async function fetchDepartments(companyId: string): Promise<FetchResult<Department[]>> {
  const mock = filterByCompany(MOCK_DEPARTMENTS, companyId);
  return withSupabase(mock, [], async (client) => {
    const { data, error } = await client
      .from('departments')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error || !data) return null;
    return data.map((row) => ({
      id: String(row.id),
      company_id: String(row.company_id),
      name: String(row.name),
      code: String(row.code),
      created_at: String(row.created_at),
    }));
  });
}

async function withSupabase<T>(
  mock: T,
  empty: T,
  query: (client: NonNullable<ReturnType<typeof createBrowserClient>>) => Promise<T | null>
): Promise<FetchResult<T>> {
  if (!isSupabaseConfigured()) {
    return { data: mock, source: 'mock' };
  }
  const client = createBrowserClient();
  if (!client) {
    return {
      data: empty,
      source: 'supabase',
      error: 'Supabaseクライアントを初期化できませんでした。',
    };
  }
  try {
    const result = await query(client);
    if (result === null) {
      return {
        data: empty,
        source: 'supabase',
        error: 'データベースからデータを取得できませんでした。',
      };
    }
    return { data: result, source: 'supabase' };
  } catch (error) {
    return {
      data: empty,
      source: 'supabase',
      error: error instanceof Error ? error.message : 'データ取得中にエラーが発生しました。',
    };
  }
}

export async function fetchKnowledgeItems(
  companyId: string
): Promise<FetchResult<KnowledgeItem[]>> {
  const mock = filterByCompany(MOCK_KNOWLEDGE, companyId);
  return withSupabase(mock, [], async (client) => {
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
  return withSupabase(mock, [], async (client) => {
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

function joinedName(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    return first?.name ? String(first.name) : undefined;
  }
  const record = value as Record<string, unknown>;
  return record.name ? String(record.name) : undefined;
}

function mapMeetingMinute(row: Record<string, unknown>): MeetingMinute {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    title: String(row.title),
    meeting_date: String(row.meeting_date),
    department_id: String(row.department_id),
    department_name: row.department_name ? String(row.department_name) : joinedName(row.departments),
    participants: String(row.participants ?? ''),
    agenda: String(row.agenda ?? ''),
    decisions: String(row.decisions ?? ''),
    action_items: String(row.action_items ?? ''),
    created_by: String(row.created_by),
    created_by_name: row.created_by_name ? String(row.created_by_name) : joinedName(row.created_user),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapMinuteAccessRequest(row: Record<string, unknown>): MinuteAccessRequest {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    minute_id: String(row.minute_id),
    minute_title: joinedName(row.meeting_minutes) ?? String(row.minute_title ?? ''),
    requester_id: String(row.requester_id),
    requester_name: joinedName(row.requester) ?? String(row.requester_name ?? ''),
    requester_department_id: row.requester_department_id
      ? String(row.requester_department_id)
      : null,
    requester_department_name: joinedName(row.requester_department),
    target_department_id: String(row.target_department_id),
    target_department_name: joinedName(row.target_department),
    reason: String(row.reason),
    status: row.status as MinuteAccessRequestStatus,
    requested_at: String(row.requested_at),
    reviewed_by: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewed_by_name: joinedName(row.reviewer),
    reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

export async function fetchMeetingMinutes(
  companyId: string
): Promise<FetchResult<MeetingMinute[]>> {
  const mock = filterByCompany(MOCK_MEETING_MINUTES, companyId);
  return withSupabase(mock, [], async (client) => {
    const { data, error } = await client.rpc('list_meeting_minutes_for_user');
    if (error || !data) return null;
    return (data as Record<string, unknown>[])
      .map((row) => mapMeetingMinute(row))
      .filter((minute: MeetingMinute) => minute.company_id === companyId);
  });
}

export async function createMeetingMinute(
  item: Omit<MeetingMinute, 'id' | 'created_at' | 'updated_at' | 'department_name' | 'created_by_name'>
): Promise<MeetingMinute | null> {
  const now = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    return { ...item, id: `minute-${Date.now()}`, created_at: now, updated_at: now };
  }
  const client = createBrowserClient();
  if (!client) return null;
  const { data, error } = await client
    .from('meeting_minutes')
    .insert(item)
    .select('*, departments:department_id(name), created_user:created_by(name:full_name)')
    .single();
  if (error || !data) return null;
  return mapMeetingMinute(data as Record<string, unknown>);
}

export async function fetchMinuteAccessRequests(
  companyId: string
): Promise<FetchResult<MinuteAccessRequest[]>> {
  const mock = filterByCompany(MOCK_MINUTE_ACCESS_REQUESTS, companyId);
  return withSupabase(mock, [], async (client) => {
    const { data, error } = await client
      .from('minute_access_requests')
      .select('*, meeting_minutes:minute_id(name:title), requester:requester_id(name:full_name), requester_department:requester_department_id(name), target_department:target_department_id(name), reviewer:reviewed_by(name:full_name)')
      .eq('company_id', companyId)
      .order('requested_at', { ascending: false });
    if (error || !data) return null;
    return data.map((row) => mapMinuteAccessRequest(row as Record<string, unknown>));
  });
}

export async function createMinuteAccessRequest(
  input: Omit<MinuteAccessRequest, 'id' | 'status' | 'requested_at' | 'reviewed_by' | 'reviewed_by_name' | 'reviewed_at'>
): Promise<MinuteAccessRequest | null> {
  if (!isSupabaseConfigured()) {
    return {
      ...input,
      id: `minute-request-${Date.now()}`,
      status: 'pending',
      requested_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
    };
  }
  const client = createBrowserClient();
  if (!client) return null;
  const { data: requestId, error: requestError } = await client.rpc(
    'request_meeting_minute_access',
    { p_minute_id: input.minute_id, p_reason: input.reason }
  );
  if (requestError || !requestId) return null;
  const { data, error } = await client
    .from('minute_access_requests')
    .select('*, meeting_minutes:minute_id(name:title), requester:requester_id(name:full_name), requester_department:requester_department_id(name), target_department:target_department_id(name), reviewer:reviewed_by(name:full_name)')
    .eq('id', requestId)
    .single();
  if (error || !data) return null;
  return mapMinuteAccessRequest(data as Record<string, unknown>);
}

export async function reviewMinuteAccessRequest(
  id: string,
  status: Exclude<MinuteAccessRequestStatus, 'pending'>,
  reviewerId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const client = createBrowserClient();
  if (!client) return false;
  const { error } = await client
    .from('minute_access_requests')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function fetchContacts(
  companyId: string
): Promise<FetchResult<ResponsiblePerson[]>> {
  const mock = filterByCompany(MOCK_CONTACTS, companyId);
  return withSupabase(mock, [], async (client) => {
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
  return withSupabase(mock, [], async (client) => {
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
  return withSupabase(mock, [], async (client) => {
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
  issued_to: string;
  classification_scope: TokenPass['classification_scope'];
  allowed_roles: TokenPass['allowed_roles'];
  max_uses: number | null;
}): Promise<TokenPass | null> {
  const plainCode = isSupabaseConfigured() ? generatePlainToken() : DEMO_TOKEN_PASS_CODE;
  const tokenHash = hashToken(plainCode);

  if (!isSupabaseConfigured()) {
    return {
      id: `tp-${Date.now()}`,
      company_id: input.company_id,
      label: input.label,
      classification_scope: input.classification_scope,
      allowed_roles: input.allowed_roles,
      expires_at: input.expires_at,
      issued_to: input.issued_to,
      created_by: input.created_by ?? 'system',
      is_active: true,
      used_count: 0,
      max_uses: input.max_uses,
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
      classification_scope: input.classification_scope,
      allowed_roles: input.allowed_roles,
      expires_at: input.expires_at,
      issued_to: input.issued_to,
      created_by: input.created_by ?? null,
      is_active: true,
      max_uses: input.max_uses,
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
  return withSupabase(mock, [], async (client) => {
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
  return withSupabase(mock, [], async (client) => {
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
