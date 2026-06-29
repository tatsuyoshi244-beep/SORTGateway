import type {
  KnowledgeApprovalStatus,
  KnowledgeFeedback,
  KnowledgeItem,
  KnowledgeVersion,
  AppNotification,
  UserRole,
} from '@/types';
import { isSuperAdmin } from '@/lib/tenant/filter';
import { daysSince, freshnessTier, type FreshnessTier } from '@/lib/knowledge/freshness';

export const APPROVAL_STATUS_LABELS: Record<KnowledgeApprovalStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  published: 'Published',
};

const WORKFLOW_NEXT: Record<KnowledgeApprovalStatus, KnowledgeApprovalStatus[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['published', 'review'],
  published: ['draft'],
};

export function canTransitionWorkflow(
  role: UserRole,
  from: KnowledgeApprovalStatus,
  to: KnowledgeApprovalStatus
): boolean {
  if (!WORKFLOW_NEXT[from]?.includes(to)) return false;
  if (to === 'review') {
    return ['manager', 'executive', 'admin', 'super_admin'].includes(role);
  }
  if (to === 'approved' || to === 'published') {
    return role === 'admin' || isSuperAdmin(role);
  }
  if (to === 'draft') {
    return ['manager', 'executive', 'admin', 'super_admin'].includes(role);
  }
  return false;
}

export interface KnowledgeHealthRow {
  item: KnowledgeItem;
  days_since_update: number;
  tier: FreshnessTier;
}

export function computeKnowledgeHealth(items: KnowledgeItem[]): KnowledgeHealthRow[] {
  return items
    .map((item) => ({
      item,
      days_since_update: daysSince(item.updated_at),
      tier: freshnessTier(item.updated_at),
    }))
    .sort((a, b) => b.days_since_update - a.days_since_update);
}

export function countByTier(rows: KnowledgeHealthRow[]): Record<FreshnessTier | 'total', number> {
  const counts = { ok: 0, 30: 0, 90: 0, 180: 0, 365: 0, total: rows.length } as Record<
    FreshnessTier | 'total',
    number
  >;
  for (const r of rows) {
    if (r.tier === 'ok') counts.ok += 1;
    else counts[r.tier] += 1;
  }
  return counts;
}

export interface AdminLifecycleStats {
  ai_usage_count: number;
  knowledge_count: number;
  stale_knowledge_count: number;
  pending_approval_count: number;
  feedback_count: number;
  unpublished_count: number;
}

export function computeAdminStats(
  knowledge: KnowledgeItem[],
  feedback: KnowledgeFeedback[],
  chatUsageCount = 0
): AdminLifecycleStats {
  const health = computeKnowledgeHealth(knowledge.filter((k) => k.approval_status === 'published'));
  const stale = health.filter((h) => h.tier !== 'ok').length;
  const pending = knowledge.filter((k) =>
    ['draft', 'review', 'approved'].includes(k.approval_status)
  ).length;

  return {
    ai_usage_count: chatUsageCount,
    knowledge_count: knowledge.length,
    stale_knowledge_count: stale,
    pending_approval_count: pending,
    feedback_count: feedback.length,
    unpublished_count: knowledge.filter((k) => k.approval_status !== 'published').length,
  };
}

export function snapshotVersion(
  item: KnowledgeItem,
  changeReason: string | null,
  updatedBy: string | null,
  updatedByName?: string | null
): KnowledgeVersion {
  return {
    id: `kv-${item.id}-v${item.version}`,
    knowledge_id: item.id,
    company_id: item.company_id,
    version: item.version,
    title: item.title,
    content: item.content,
    summary: item.summary,
    updated_by: updatedBy,
    updated_by_name: updatedByName,
    approved_by: item.approved_by,
    approved_by_name: item.approved_by_name,
    approval_status: item.approval_status,
    change_reason: changeReason,
    created_at: new Date().toISOString(),
  };
}

export function buildPublishNotification(
  item: KnowledgeItem,
  companyId: string
): AppNotification {
  return {
    id: `ntf-${Date.now()}`,
    company_id: companyId,
    user_id: null,
    type: 'knowledge_published',
    title: 'ナレッジが公開されました',
    message: `「${item.title}」が Published になりました（v${item.version}）`,
    resource_type: 'knowledge_item',
    resource_id: item.id,
    is_read: false,
    created_at: new Date().toISOString(),
  };
}
