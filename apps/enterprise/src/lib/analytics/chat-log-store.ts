import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ChatAssistantPayload, ChatLog, FeedbackResult, SessionUser } from '@/types';
import { MOCK_CHAT_LOGS } from '@/lib/analytics/mock-chat-logs';
import { detectUnresolvedFromChat } from '@/lib/analytics/compute';

const STORE_FILE = 'chat-logs-store.json';

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
  const logs = await readStore();
  return logs
    .filter((l) => l.company_id === companyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getChatLog(id: string): Promise<ChatLog | null> {
  const logs = await readStore();
  return logs.find((l) => l.id === id) ?? null;
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

  logs.unshift(log);
  if (logs.length > 500) logs.length = 500;
  await writeStore(logs);
  return log;
}

export async function updateChatLog(
  id: string,
  patch: Partial<ChatLog>
): Promise<ChatLog | null> {
  const logs = await readStore();
  const idx = logs.findIndex((l) => l.id === id);
  if (idx < 0) return null;
  logs[idx] = { ...logs[idx], ...patch };
  await writeStore(logs);
  return logs[idx];
}

export async function setChatLogFeedback(
  chatLogId: string,
  feedback: FeedbackResult
): Promise<void> {
  await updateChatLog(chatLogId, { feedback_result: feedback });
}
