import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ChatAssistantPayload, ChatLog, FeedbackResult, SessionUser } from '@/types';
import { MOCK_CHAT_LOGS } from '@/lib/analytics/mock-chat-logs';
import { detectUnresolvedFromChat } from '@/lib/analytics/compute';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';

const STORE_FILE = 'chat-logs-store.json';

type UserJoin = { full_name?: string } | { full_name?: string }[] | null | undefined;

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error('本番用データベース接続が未設定です');
  return admin;
}

function userName(value: UserJoin): string {
  if (!value) return '—';
  const row = Array.isArray(value) ? value[0] : value;
  return row?.full_name ? String(row.full_name) : '—';
}

function mapChatLogRow(row: Record<string, unknown>): ChatLog {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    user_id: String(row.user_id),
    user_name: userName(row.users as UserJoin),
    department: row.department ? String(row.department) : null,
    department_id: row.department_id ? String(row.department_id) : null,
    question: String(row.question),
    answer_summary: String(row.answer_summary),
    has_knowledge: Boolean(row.has_knowledge),
    confidence_score: Number(row.confidence_score ?? 0),
    source_count: Number(row.source_count ?? 0),
    feedback_result: (row.feedback_result as FeedbackResult) ?? null,
    unresolved: Boolean(row.unresolved),
    resolved_by_admin: Boolean(row.resolved_by_admin),
    no_knowledge_reason: row.no_knowledge_reason ? String(row.no_knowledge_reason) : null,
    status: (row.status as ChatLog['status']) ?? 'open',
    assigned_to_id: row.assigned_to_id ? String(row.assigned_to_id) : null,
    assigned_to_name: row.assigned_to_name ? String(row.assigned_to_name) : null,
    knowledge_item_id: row.knowledge_item_id ? String(row.knowledge_item_id) : null,
    created_at: String(row.created_at),
  };
}

async function storePath(): Promise<string> {
  return path.join(process.cwd(), '.data', STORE_FILE);
}

async function readStore(): Promise<ChatLog[]> {
  try {
    const raw = await fs.readFile(await storePath(), 'utf-8');
    return JSON.parse(raw) as ChatLog[];
  } catch {
    return [...MOCK_CHAT_LOGS];
  }
}

async function writeStore(logs: ChatLog[]): Promise<void> {
  const p = await storePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(logs, null, 2), 'utf-8');
}

export async function listChatLogs(companyId: string): Promise<ChatLog[]> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('chat_logs')
      .select('*,users:user_id(full_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`チャット履歴を読み込めませんでした: ${error.message}`);
    return (data ?? []).map((row) => mapChatLogRow(row as Record<string, unknown>));
  }
  const logs = await readStore();
  return logs
    .filter((l) => l.company_id === companyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getChatLog(id: string, companyId?: string): Promise<ChatLog | null> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    let query = admin
      .from('chat_logs')
      .select('*,users:user_id(full_name)')
      .eq('id', id);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`チャット履歴を読み込めませんでした: ${error.message}`);
    return data ? mapChatLogRow(data as Record<string, unknown>) : null;
  }
  const logs = await readStore();
  return logs.find((l) => l.id === id && (!companyId || l.company_id === companyId)) ?? null;
}

export async function appendChatLog(input: {
  company_id: string;
  user: SessionUser;
  question: string;
  payload: ChatAssistantPayload;
}): Promise<ChatLog> {
  const logs = await readStore();
  const noKnowledgeReason =
    input.payload.warnings.find((w) => w.includes('ナレッジ') || w.includes('古い')) ??
    (!input.payload.has_knowledge ? '該当する社内ナレッジが見つかりませんでした' : null);

  const log: ChatLog = {
    id: `cl-${randomUUID().slice(0, 8)}`,
    company_id: input.company_id,
    user_id: input.user.id,
    user_name: input.user.full_name,
    department: input.user.department_name ?? null,
    department_id: input.user.department_id,
    question: input.question.slice(0, 500),
    answer_summary: input.payload.answer.slice(0, 500),
    has_knowledge: input.payload.has_knowledge,
    confidence_score: input.payload.quality.confidence_score,
    source_count: input.payload.quality.source_count,
    feedback_result: null,
    unresolved: detectUnresolvedFromChat(
      input.payload.has_knowledge,
      input.payload.quality.confidence_score,
      noKnowledgeReason
    ),
    resolved_by_admin: false,
    no_knowledge_reason: noKnowledgeReason,
    status: 'open',
    assigned_to_id: null,
    assigned_to_name: null,
    knowledge_item_id: null,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('chat_logs')
      .insert({
        company_id: log.company_id,
        user_id: log.user_id,
        question: log.question,
        answer_summary: log.answer_summary,
        source_ids: [],
        has_knowledge: log.has_knowledge,
        confidence_score: log.confidence_score,
        source_count: log.source_count,
        feedback_result: log.feedback_result,
        unresolved: log.unresolved,
        resolved_by_admin: log.resolved_by_admin,
        department: log.department,
        no_knowledge_reason: log.no_knowledge_reason,
        status: log.status,
        assigned_to_id: log.assigned_to_id,
        assigned_to_name: log.assigned_to_name,
        knowledge_item_id: log.knowledge_item_id,
      })
      .select('*,users:user_id(full_name)')
      .single();
    if (error) throw new Error(`チャット履歴を保存できませんでした: ${error.message}`);
    return mapChatLogRow(data as Record<string, unknown>);
  }

  logs.unshift(log);
  if (logs.length > 500) logs.length = 500;
  await writeStore(logs);
  return log;
}

export async function updateChatLog(
  id: string,
  patch: Partial<ChatLog>,
  companyId?: string
): Promise<ChatLog | null> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const allowedKeys: (keyof ChatLog)[] = [
      'feedback_result',
      'unresolved',
      'resolved_by_admin',
      'no_knowledge_reason',
      'status',
      'assigned_to_id',
      'assigned_to_name',
      'knowledge_item_id',
    ];
    const dbPatch: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in patch) dbPatch[key] = patch[key];
    }
    if (Object.keys(dbPatch).length === 0) return getChatLog(id, companyId);

    let query = admin.from('chat_logs').update(dbPatch).eq('id', id);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query.select('*,users:user_id(full_name)').maybeSingle();
    if (error) throw new Error(`チャット履歴を更新できませんでした: ${error.message}`);
    return data ? mapChatLogRow(data as Record<string, unknown>) : null;
  }
  const logs = await readStore();
  const idx = logs.findIndex((l) => l.id === id && (!companyId || l.company_id === companyId));
  if (idx < 0) return null;
  logs[idx] = { ...logs[idx], ...patch };
  await writeStore(logs);
  return logs[idx];
}

export async function setChatLogFeedback(
  chatLogId: string,
  feedback: FeedbackResult,
  companyId: string
): Promise<void> {
  await updateChatLog(chatLogId, { feedback_result: feedback }, companyId);
}
