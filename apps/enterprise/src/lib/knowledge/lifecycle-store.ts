import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  AppNotification,
  KnowledgeApprovalStatus,
  KnowledgeFeedback,
  KnowledgeItem,
  KnowledgeVersion,
  FeedbackRating,
} from '@/types';
import {
  MOCK_KNOWLEDGE,
  MOCK_KNOWLEDGE_VERSIONS,
  MOCK_FEEDBACK,
  MOCK_NOTIFICATIONS,
} from '@/lib/mock-lifecycle';
import { snapshotVersion, buildPublishNotification } from '@/lib/knowledge/workflow';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/env';

const STORE_FILE = 'lifecycle-store.json';

interface LifecycleStore {
  knowledge: KnowledgeItem[];
  versions: KnowledgeVersion[];
  feedback: KnowledgeFeedback[];
  notifications: AppNotification[];
  chat_usage_count: number;
}

function storePath(): string {
  return path.join(process.cwd(), '.data', STORE_FILE);
}

async function readStore(): Promise<LifecycleStore> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8');
    return JSON.parse(raw) as LifecycleStore;
  } catch {
    return {
      knowledge: [...MOCK_KNOWLEDGE],
      versions: [...MOCK_KNOWLEDGE_VERSIONS],
      feedback: [...MOCK_FEEDBACK],
      notifications: [...MOCK_NOTIFICATIONS],
      chat_usage_count: 42,
    };
  }
}

async function writeStore(store: LifecycleStore): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf-8');
}

export async function listKnowledge(companyId: string): Promise<KnowledgeItem[]> {
  const store = await readStore();
  return store.knowledge.filter((k) => k.company_id === companyId);
}

export async function getKnowledge(id: string): Promise<KnowledgeItem | null> {
  const store = await readStore();
  return store.knowledge.find((k) => k.id === id) ?? null;
}

export async function listKnowledgeVersions(knowledgeId: string): Promise<KnowledgeVersion[]> {
  const store = await readStore();
  return store.versions
    .filter((v) => v.knowledge_id === knowledgeId)
    .sort((a, b) => b.version - a.version);
}

export async function saveKnowledge(
  input: Partial<KnowledgeItem> & { id?: string; company_id: string },
  userId: string,
  userName: string,
  changeReason?: string
): Promise<KnowledgeItem> {
  const store = await readStore();
  const now = new Date().toISOString();

  if (input.id) {
    const idx = store.knowledge.findIndex((k) => k.id === input.id);
    if (idx < 0) throw new Error('ナレッジが見つかりません');
    const prev = store.knowledge[idx];
    store.versions.push(
      snapshotVersion(prev, changeReason ?? '内容更新', userId, userName)
    );
    const next: KnowledgeItem = {
      ...prev,
      ...input,
      version: prev.version + 1,
      approval_status: 'draft',
      updated_at: now,
      updated_by: userId,
      updated_by_name: userName,
    };
    store.knowledge[idx] = next;
    await writeStore(store);
    return next;
  }

  const item: KnowledgeItem = {
    id: `kn-${randomUUID().slice(0, 8)}`,
    company_id: input.company_id,
    title: input.title ?? '',
    content: input.content ?? '',
    summary: input.summary ?? '',
    category: input.category ?? 'その他',
    classification: input.classification ?? 'internal',
    department_id: input.department_id ?? null,
    department_name: input.department_name,
    tags: input.tags ?? [],
    created_by: userId,
    updated_at: now,
    approval_status: 'draft',
    version: 1,
    responsible_person_id: input.responsible_person_id ?? userId,
    responsible_person_name: input.responsible_person_name ?? userName,
    updated_by: userId,
    updated_by_name: userName,
    approved_by: null,
    approved_by_name: null,
  };
  store.knowledge.push(item);
  store.versions.push(snapshotVersion(item, '初回作成', userId, userName));
  await writeStore(store);
  return item;
}

export async function transitionKnowledgeStatus(
  id: string,
  to: KnowledgeApprovalStatus,
  userId: string,
  userName: string
): Promise<KnowledgeItem> {
  const store = await readStore();
  const idx = store.knowledge.findIndex((k) => k.id === id);
  if (idx < 0) throw new Error('ナレッジが見つかりません');

  const item = store.knowledge[idx];
  const now = new Date().toISOString();
  const updated: KnowledgeItem = {
    ...item,
    approval_status: to,
    updated_at: now,
    updated_by: userId,
    updated_by_name: userName,
  };

  if (to === 'approved' || to === 'published') {
    updated.approved_by = userId;
    updated.approved_by_name = userName;
  }

  if (to === 'published') {
    store.notifications.unshift(buildPublishNotification(updated, item.company_id));
  }

  store.knowledge[idx] = updated;
  store.versions.push(
    snapshotVersion(updated, `ステータス変更: ${to}`, userId, userName)
  );
  await writeStore(store);
  return updated;
}

export async function listFeedback(companyId: string): Promise<KnowledgeFeedback[]> {
  const store = await readStore();
  return store.feedback
    .filter((f) => f.company_id === companyId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addFeedback(input: {
  company_id: string;
  user_id: string;
  user_name: string;
  question: string;
  answer_summary: string;
  rating: FeedbackRating;
  chat_message_id?: string | null;
}): Promise<KnowledgeFeedback> {
  const store = await readStore();
  const fb: KnowledgeFeedback = {
    id: `fb-${randomUUID().slice(0, 8)}`,
    company_id: input.company_id,
    user_id: input.user_id,
    user_name: input.user_name,
    question: input.question,
    answer_summary: input.answer_summary.slice(0, 500),
    rating: input.rating,
    chat_message_id: input.chat_message_id ?? null,
    created_at: new Date().toISOString(),
  };
  store.feedback.unshift(fb);
  await writeStore(store);

  if (isSupabaseAdminConfigured()) {
    const admin = createAdminClient();
    if (admin) {
      await admin.from('feedback').insert({
        company_id: fb.company_id,
        user_id: fb.user_id,
        question: fb.question,
        answer_summary: fb.answer_summary,
        rating: fb.rating,
        chat_message_id: fb.chat_message_id,
      });
    }
  }

  return fb;
}

export async function listNotifications(
  companyId: string,
  userId?: string | null
): Promise<AppNotification[]> {
  const store = await readStore();
  return store.notifications
    .filter(
      (n) =>
        n.company_id === companyId &&
        (n.user_id === null || n.user_id === userId)
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const store = await readStore();
  const idx = store.notifications.findIndex((n) => n.id === id);
  if (idx < 0) return false;
  store.notifications[idx] = { ...store.notifications[idx], is_read: true };
  await writeStore(store);
  return true;
}

export async function createNotification(
  input: Omit<AppNotification, 'id' | 'created_at' | 'is_read'>
): Promise<AppNotification> {
  const store = await readStore();
  const notification: AppNotification = {
    ...input,
    id: `ntf-${randomUUID().slice(0, 8)}`,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  store.notifications.unshift(notification);
  if (store.notifications.length > 500) store.notifications.length = 500;
  await writeStore(store);
  return notification;
}

export async function incrementChatUsage(): Promise<number> {
  const store = await readStore();
  store.chat_usage_count += 1;
  await writeStore(store);
  return store.chat_usage_count;
}

export async function getChatUsageCount(): Promise<number> {
  const store = await readStore();
  return store.chat_usage_count;
}

export async function getLifecycleStore(companyId: string) {
  const store = await readStore();
  return {
    knowledge: store.knowledge.filter((k) => k.company_id === companyId),
    feedback: store.feedback.filter((f) => f.company_id === companyId),
    chat_usage_count: store.chat_usage_count,
  };
}
