import type {
  AnswerQualityInfo,
  ChatAssistantPayload,
  KnowledgeItem,
  KnowledgeSource,
} from '@/types';
import type { RagSearchResult } from '@/lib/rag/search';
import { staleWarning } from '@/lib/knowledge/freshness';

export function toEnrichedKnowledgeSources(items: KnowledgeItem[]): KnowledgeSource[] {
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

export function buildAnswerQuality(rag: RagSearchResult): AnswerQualityInfo {
  const primary = rag.knowledge[0];
  const sourceCount = rag.knowledge.length + rag.documentChunks.length;

  let confidence = 0;
  if (sourceCount === 0) confidence = 0;
  else if (sourceCount === 1) confidence = 55;
  else if (sourceCount <= 3) confidence = 72;
  else confidence = 85;

  if (primary) {
    const days = Math.floor(
      (Date.now() - new Date(primary.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days > 180) confidence = Math.max(30, confidence - 25);
    else if (days > 90) confidence = Math.max(40, confidence - 15);
    else if (days > 30) confidence = Math.max(50, confidence - 8);
  }

  return {
    confidence_score: confidence,
    knowledge_version: primary?.version ?? null,
    source_count: sourceCount,
    last_updated: primary?.updated_at ?? rag.documentChunks[0]?.document.updated_at ?? null,
    responsible_department: primary?.department_name ?? null,
    responsible_person: primary?.responsible_person_name ?? null,
  };
}

export function collectStaleWarnings(rag: RagSearchResult): string[] {
  const warnings: string[] = [];
  for (const k of rag.knowledge) {
    const w = staleWarning(k.updated_at);
    if (w && !warnings.includes(w)) warnings.push(w);
  }
  for (const c of rag.documentChunks) {
    const w = staleWarning(c.document.updated_at);
    if (w && !warnings.includes(w)) warnings.push(w);
  }
  return warnings;
}

export function attachQualityToPayload(
  payload: Omit<ChatAssistantPayload, 'quality'>,
  rag: RagSearchResult
): ChatAssistantPayload {
  const stale = collectStaleWarnings(rag);
  return {
    ...payload,
    references: toEnrichedKnowledgeSources(rag.knowledge),
    sources: toEnrichedKnowledgeSources(rag.knowledge),
    warnings: [...payload.warnings, ...stale],
    quality: buildAnswerQuality(rag),
  };
}
