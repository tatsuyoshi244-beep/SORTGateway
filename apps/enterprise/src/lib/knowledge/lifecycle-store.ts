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
import { isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/env';

const STORE_FILE = 'lifecycle-store.json';

const KNOWLEDGE_SELECT =
  '*,departments:department_id(name),responsible_person:responsible_person_id(full_name),updated_user:updated_by(full_name),approved_user:approved_by(full_name)' as const;

const VERSION_SELECT =
  '*,updated_user:updated_by(full_name),approved_user:approved_by(full_name)' as const;

type NameJoin = { full_name?: string } | { full_name?: string }[] | null | undefined;
type DepartmentJoin = { name?: string } | { name?: string }[] | null | undefined;

function joinedName(value: NameJoin): string | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.full_name ? String(row.full_name) : null;
}

function joinedDepartment(value: DepartmentJoin): string | undefined {
  if (!value) return undefined;
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name ? String(row.name) : undefined;
}

function mapKnowledgeRow(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    title: String(row.title),
    content: String(row.content),
    summary: String(row.summary ?? ''),
    category: String(row.category ?? 'その他'),
    classification: row.classification as KnowledgeItem['classification'],
    department_id: row.department_id ? String(row.department_id) : null,
    department_name: joinedDepartment(row.departments as DepartmentJoin),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_by: row.created_by ? String(row.created_by) : '',
    updated_at: String(row.updated_at),
    approval_status: (row.approval_status as KnowledgeItem['approval_status']) ?? 'draft',
    version: Number(row.version ?? 1),
    responsible_person_id: row.responsible_person_id ? String(row.responsible_person_id) : null,
    responsible_person_name: joinedName(row.responsible_person as NameJoin),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_by_name: joinedName(row.updated_user as NameJoin),
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_by_name: joinedName(row.approved_user as NameJoin),
  };
}

function mapVersionRow(row: Record<string, unknown>): KnowledgeVersion {
  return {
    id: String(row.id),
    knowledge_id: String(row.knowledge_id),
    company_id: String(row.company_id),
    version: Number(row.version),
    title: String(row.title),
    content: String(row.content),
    summary: String(row.summary ?? ''),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_by_name: joinedName(row.updated_user as NameJoin),
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_by_name: joinedName(row.approved_user as NameJoin),
    approval_status: row.approval_status as KnowledgeApprovalStatus,
    change_reason: row.change_reason ? String(row.change_reason) : null,
    created_at: String(row.created_at),
  };
}

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error('本番用データベース接続が未設定です');
  return admin;
}

function versionInsert(item: KnowledgeItem, reason: string, userId: string) {
  return {
    knowledge_id: item.id,
    company_id: item.company_id,
    version: item.version,
    title: item.title,
    content: item.content,
    summary: item.summary,
    updated_by: userId,
    approved_by: item.approved_by,
    approval_status: item.approval_status,
    change_reason: reason,
  };
}

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
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('knowledge_items')
      .select(KNOWLEDGE_SELECT)
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`ナレッジを読み込めませんでした: ${error.message}`);
    return (data ?? []).map((row) => mapKnowledgeRow(row as Record<string, unknown>));
  }
  const store = await readStore();
  return store.knowledge.filter((k) => k.company_id === companyId);
}

export async function getKnowledge(id: string): Promise<KnowledgeItem | null> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('knowledge_items')
      .select(KNOWLEDGE_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`ナレッジを読み込めませんでした: ${error.message}`);
    return data ? mapKnowledgeRow(data as Record<string, unknown>) : null;
  }
  const store = await readStore();
  return store.knowledge.find((k) => k.id === id) ?? null;
}

export async function listKnowledgeVersions(knowledgeId: string): Promise<KnowledgeVersion[]> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('knowledge_versions')
      .select(VERSION_SELECT)
      .eq('knowledge_id', knowledgeId)
      .order('version', { ascending: false });
    if (error) throw new Error(`更新履歴を読み込めませんでした: ${error.message}`);
    return (data ?? []).map((row) => mapVersionRow(row as Record<string, unknown>));
  }
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
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const now = new Date().toISOString();

    if (input.id) {
      const previous = await getKnowledge(input.id);
      if (!previous) throw new Error('ナレッジが見つかりません');

      const { data: version, error: versionError } = await admin
        .from('knowledge_versions')
        .insert(versionInsert(previous, changeReason ?? '内容更新', userId))
        .select('id')
        .single();
      if (versionError) throw new Error(`更新履歴を保存できませんでした: ${versionError.message}`);

      const { data, error } = await admin
        .from('knowledge_items')
        .update({
          title: input.title ?? previous.title,
          content: input.content ?? previous.content,
          summary: input.summary ?? previous.summary,
          category: input.category ?? previous.category,
          classification: input.classification ?? previous.classification,
          department_id: input.department_id ?? previous.department_id,
          tags: input.tags ?? previous.tags,
          responsible_person_id:
            input.responsible_person_id ?? previous.responsible_person_id,
          version: previous.version + 1,
          approval_status: 'draft',
          updated_at: now,
          updated_by: userId,
          approved_by: null,
        })
        .eq('id', previous.id)
        .eq('company_id', previous.company_id)
        .select(KNOWLEDGE_SELECT)
        .single();

      if (error) {
        await admin.from('knowledge_versions').delete().eq('id', version.id);
        throw new Error(`ナレッジを更新できませんでした: ${error.message}`);
      }
      return mapKnowledgeRow(data as Record<string, unknown>);
    }

    const { data, error } = await admin
      .from('knowledge_items')
      .insert({
        company_id: input.company_id,
        title: input.title ?? '',
        content: input.content ?? '',
        summary: input.summary ?? '',
        category: input.category ?? 'その他',
        classification: input.classification ?? 'internal',
        department_id: input.department_id ?? null,
        tags: input.tags ?? [],
        created_by: userId,
        updated_at: now,
        approval_status: 'draft',
        version: 1,
        responsible_person_id: input.responsible_person_id ?? userId,
        updated_by: userId,
        approved_by: null,
      })
      .select(KNOWLEDGE_SELECT)
      .single();
    if (error) throw new Error(`ナレッジを登録できませんでした: ${error.message}`);

    const item = mapKnowledgeRow(data as Record<string, unknown>);
    const { error: versionError } = await admin
      .from('knowledge_versions')
      .insert(versionInsert(item, '初回作成', userId));
    if (versionError) {
      await admin.from('knowledge_items').delete().eq('id', item.id);
      throw new Error(`初回履歴を保存できませんでした: ${versionError.message}`);
    }
    return item;
  }

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
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const item = await getKnowledge(id);
    if (!item) throw new Error('ナレッジが見つかりません');

    const now = new Date().toISOString();
    const approvedBy = to === 'approved' || to === 'published' ? userId : item.approved_by;
    const candidate: KnowledgeItem = {
      ...item,
      approval_status: to,
      updated_at: now,
      updated_by: userId,
      updated_by_name: userName,
      approved_by: approvedBy,
      approved_by_name:
        to === 'approved' || to === 'published' ? userName : item.approved_by_name,
    };

    const { data: version, error: versionError } = await admin
      .from('knowledge_versions')
      .insert(versionInsert(candidate, `ステータス変更: ${to}`, userId))
      .select('id')
      .single();
    if (versionError) throw new Error(`更新履歴を保存できませんでした: ${versionError.message}`);

    const { data, error } = await admin
      .from('knowledge_items')
      .update({
        approval_status: to,
        updated_at: now,
        updated_by: userId,
        approved_by: approvedBy,
      })
      .eq('id', id)
      .eq('company_id', item.company_id)
      .select(KNOWLEDGE_SELECT)
      .single();
    if (error) {
      await admin.from('knowledge_versions').delete().eq('id', version.id);
      throw new Error(`ステータスを変更できませんでした: ${error.message}`);
    }

    const updated = mapKnowledgeRow(data as Record<string, unknown>);
    if (to === 'published') {
      const notification = buildPublishNotification(updated, item.company_id);
      const { error: notificationError } = await admin.from('notifications').insert({
        company_id: notification.company_id,
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        resource_type: notification.resource_type,
        resource_id: notification.resource_id,
        is_read: false,
      });
      if (notificationError) {
        throw new Error(`公開通知を保存できませんでした: ${notificationError.message}`);
      }
    }
    return updated;
  }

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

export async function deleteKnowledge(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const admin = requireAdminClient();
    const { data, error } = await admin
      .from('knowledge_items')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw new Error(`ナレッジを削除できませんでした: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }
  const store = await readStore();
  const before = store.knowledge.length;
  store.knowledge = store.knowledge.filter((item) => item.id !== id);
  if (store.knowledge.length === before) return false;
  store.versions = store.versions.filter((version) => version.knowledge_id !== id);
  await writeStore(store);
  return true;
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
