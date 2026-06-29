import type {
  AnalyticsOverview,
  ChatLog,
  DepartmentAnalyticsRow,
  KnowledgeFeedback,
  KnowledgeItem,
  UnresolvedQuestionView,
} from '@/types';
import { daysSince } from '@/lib/knowledge/freshness';
import { countSimilarQuestions } from '@/lib/analytics/grouping';

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const ACTIVE_USER_DAYS = 30;
const STALE_DAYS = 180;

export function isUnresolvedLog(log: ChatLog): boolean {
  if (log.status === 'hidden') return false;
  if (log.resolved_by_admin || log.status === 'resolved') return false;
  return log.unresolved;
}

export function isKnowledgeGap(log: ChatLog): boolean {
  return !log.has_knowledge || log.confidence_score < LOW_CONFIDENCE_THRESHOLD;
}

export function computeAnalyticsOverview(
  logs: ChatLog[],
  feedback: KnowledgeFeedback[]
): AnalyticsOverview {
  const total = logs.length || 1;
  const withKnowledge = logs.filter((l) => l.has_knowledge && l.source_count > 0);
  const withoutKnowledge = logs.filter((l) => !l.has_knowledge || l.source_count === 0);
  const activeCutoff = Date.now() - ACTIVE_USER_DAYS * 24 * 60 * 60 * 1000;
  const activeUsers = new Set(
    logs.filter((l) => new Date(l.created_at).getTime() >= activeCutoff).map((l) => l.user_id)
  );

  const referencedKnowledge = logs.reduce(
    (sum, l) => sum + (l.has_knowledge ? l.source_count : 0),
    0
  );

  const staleRefs = logs.filter(
    (l) =>
      (l.has_knowledge && l.no_knowledge_reason?.includes('古い')) ||
      (l.has_knowledge &&
        l.confidence_score < LOW_CONFIDENCE_THRESHOLD &&
        l.source_count > 0)
  ).length;

  const negativeFb = feedback.filter((f) => f.rating === 'negative').length;

  return {
    question_count: logs.length,
    active_user_count: activeUsers.size,
    referenced_knowledge_count: referencedKnowledge,
    with_knowledge_rate: Math.round((withKnowledge.length / total) * 100),
    without_knowledge_rate: Math.round((withoutKnowledge.length / total) * 100),
    feedback_count: feedback.length,
    negative_feedback_count: negativeFb,
    unresolved_count: logs.filter(isUnresolvedLog).length,
    stale_knowledge_reference_count: staleRefs,
  };
}

export function computeDepartmentAnalytics(
  logs: ChatLog[],
  knowledge: KnowledgeItem[]
): DepartmentAnalyticsRow[] {
  const deptMap = new Map<string, DepartmentAnalyticsRow>();

  for (const log of logs) {
    const key = log.department_id ?? 'unknown';
    const name = log.department ?? '未所属';
    const row = deptMap.get(key) ?? {
      department_id: log.department_id,
      department: name,
      question_count: 0,
      unresolved_count: 0,
      negative_feedback_count: 0,
      top_knowledge_titles: [],
      stale_knowledge_count: 0,
    };
    row.question_count += 1;
    if (isUnresolvedLog(log)) row.unresolved_count += 1;
    if (log.feedback_result === 'negative') row.negative_feedback_count += 1;
    deptMap.set(key, row);
  }

  for (const item of knowledge) {
    if (!item.department_id) continue;
    const row = deptMap.get(item.department_id);
    if (!row) continue;
    if (daysSince(item.updated_at) >= STALE_DAYS) {
      row.stale_knowledge_count += 1;
    }
    if (item.approval_status === 'published' && row.top_knowledge_titles.length < 3) {
      row.top_knowledge_titles.push(item.title);
    }
  }

  return Array.from(deptMap.values()).sort((a, b) => b.question_count - a.question_count);
}

export function buildUnresolvedViews(logs: ChatLog[]): UnresolvedQuestionView[] {
  const gapLogs = logs.filter(
    (l) =>
      isKnowledgeGap(l) &&
      l.status !== 'hidden' &&
      !(l.resolved_by_admin && l.status === 'resolved')
  );

  const allQuestions = logs.map((l) => l.question);

  return gapLogs
    .map((log) => {
      const { similar_count, group_keywords } = countSimilarQuestions(log.question, allQuestions);
      return { ...log, similar_count, group_keywords };
    })
    .sort((a, b) => b.similar_count - a.similar_count || b.created_at.localeCompare(a.created_at));
}

export function detectUnresolvedFromChat(
  hasKnowledge: boolean,
  confidenceScore: number,
  noKnowledgeReason: string | null
): boolean {
  if (!hasKnowledge) return true;
  if (confidenceScore < LOW_CONFIDENCE_THRESHOLD) return true;
  if (noKnowledgeReason?.includes('古い')) return true;
  return false;
}
