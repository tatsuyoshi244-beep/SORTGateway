import type { KnowledgeItem, SessionUser } from '@/types';
import { canViewClassification } from '@/lib/permissions';
import { filterByCompany, resolveEffectiveCompanyId } from '@/lib/tenant/filter';
import { MOCK_KNOWLEDGE } from '@/lib/mock-data';
import { listKnowledge } from '@/lib/knowledge/lifecycle-store';
import { freshnessScoreMultiplier } from '@/lib/knowledge/freshness';
import { createServerClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u3000、。,.!?！？「」『』（）()[\]【】]/g, '');
}

function buildSearchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);

  const core = normalized
    .replace(/について教えてください$/, '')
    .replace(/について教えて$/, '')
    .replace(/について説明してください$/, '')
    .replace(/について説明して$/, '')
    .replace(/を教えてください$/, '')
    .replace(/を教えて$/, '')
    .replace(/とは何ですか$/, '')
    .replace(/とは$/, '');

  const terms = new Set<string>([normalized, core]);

  if (core.length >= 4) {
    for (let i = 0; i <= core.length - 4; i += 1) {
      terms.add(core.slice(i, i + 4));
    }
  }

  return [...terms].filter((term) => term.length >= 2);
}

function scoreItem(item: KnowledgeItem, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  const title = normalizeSearchText(item.title);
  const content = normalizeSearchText(item.content);
  const tags = item.tags.map(normalizeSearchText);
  const terms = buildSearchTerms(query);

  let score = 0;

  for (const term of terms) {
    if (title.includes(term)) score += term.length >= 6 ? 5 : 2;
    if (content.includes(term)) score += 1;
    if (tags.some((tag) => tag.includes(term))) score += 3;
  }

  const titleWithoutVersion = title.replace(
    /(?:v)?[0-9]+(?:\.[0-9]+)?$/,
    ''
  );

  if (
    titleWithoutVersion.length >= 4 &&
    normalizedQuery.includes(titleWithoutVersion)
  ) {
    score += 10;
  }

  return score * freshnessScoreMultiplier(item.updated_at);
}: number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  let score = 0;
  const title = item.title.toLowerCase();
  const content = item.content.toLowerCase();
  for (const w of words) {
    if (title.includes(w)) score += 3;
    if (content.includes(w)) score += 1;
    if (item.tags.some((t) => t.toLowerCase().includes(w))) score += 2;
  }
  if (title.includes(q)) score += 5;
  return score * freshnessScoreMultiplier(item.updated_at);
}

function filterByAccess(
  items: KnowledgeItem[],
  user: SessionUser,
  hasToken: boolean
): KnowledgeItem[] {
  return items.filter((item) =>
    canViewClassification(
      user.role,
      item.classification,
      hasToken,
      user.department_id,
      item.department_id
    )
  );
}

function mapRow(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(row.id),
    company_id: String(row.company_id ?? 'demo-company'),
    title: String(row.title),
    content: String(row.content),
    summary: String(row.summary ?? ''),
    category: String(row.category ?? 'その他'),
    classification: row.classification as KnowledgeItem['classification'],
    department_id: row.department_id ? String(row.department_id) : null,
    department_name: row.department_name ? String(row.department_name) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    created_by: row.created_by ? String(row.created_by) : '',
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    approval_status: (row.approval_status as KnowledgeItem['approval_status']) ?? 'published',
    version: Number(row.version ?? 1),
    responsible_person_id: row.responsible_person_id ? String(row.responsible_person_id) : null,
    responsible_person_name: row.responsible_person_name
      ? String(row.responsible_person_name)
      : null,
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_by_name: row.updated_by_name ? String(row.updated_by_name) : null,
    approved_by: row.approved_by ? String(row.approved_by) : null,
    approved_by_name: row.approved_by_name ? String(row.approved_by_name) : null,
  };
}

/** ナレッジ候補を検索（Published のみ AI 対象） */
export async function searchKnowledgeCandidates(
  user: SessionUser,
  query: string,
  hasActiveTokenPass: boolean,
  limit = 5
): Promise<KnowledgeItem[]> {
  let items: KnowledgeItem[] = [];
  const companyId = resolveEffectiveCompanyId(user);

  if (isSupabaseConfigured()) {
    const supabase = createServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('knowledge_items')
        .select('*')
        .eq('company_id', companyId)
        .eq('approval_status', 'published')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        items = data.map((row) => mapRow(row as Record<string, unknown>));
      }
    }
  }

  if (items.length === 0) {
    const local = await listKnowledge(companyId);
    items = local.length > 0 ? local : filterByCompany([...MOCK_KNOWLEDGE], companyId);
  }

  const published = items.filter((i) => i.approval_status === 'published');
  const accessible = filterByAccess(published, user, hasActiveTokenPass);

  return accessible
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function toKnowledgeSources(items: KnowledgeItem[]) {
  return items.map((k) => ({
    id: k.id,
    title: k.title,
    classification: k.classification,
    excerpt: k.content.slice(0, 160) + (k.content.length > 160 ? '…' : ''),
    version: k.version,
    updated_at: k.updated_at,
    responsible_department: k.department_name ?? null,
    responsible_person: k.responsible_person_name ?? null,
  }));
}
