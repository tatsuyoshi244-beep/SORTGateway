import type {
  DocumentChunkWithMeta,
  DocumentReference,
  InformationClassification,
  KnowledgeItem,
  KnowledgeSource,
  SessionUser,
} from '@/types';
import { canViewClassification } from '@/lib/permissions';
import { filterByCompany, resolveEffectiveCompanyId } from '@/lib/tenant/filter';
import { searchKnowledgeCandidates, toKnowledgeSources } from '@/lib/knowledge/search';
import { listDocuments, getAllDocumentChunks } from '@/lib/documents/document-store';
import { MOCK_DOCUMENTS, MOCK_DOCUMENT_CHUNKS } from '@/lib/mock-documents';
import { cached } from '@/lib/cache';
import { measureAsync } from '@/lib/observability/timing';

export interface RagSearchResult {
  knowledge: KnowledgeItem[];
  documentChunks: DocumentChunkWithMeta[];
  knowledgeSources: KnowledgeSource[];
  documentReferences: DocumentReference[];
  hasAnyKnowledge: boolean;
}

function scoreText(text: string, query: string): number {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 1);
  const body = text.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (body.includes(w)) score += 2;
  }
  if (body.includes(q)) score += 5;
  return score;
}

function canAccessDocument(
  user: SessionUser,
  hasToken: boolean,
  classification: InformationClassification,
  departmentId: string | null
): boolean {
  return canViewClassification(
    user.role,
    classification,
    hasToken,
    user.department_id,
    departmentId
  );
}

function toDocumentReference(
  chunk: DocumentChunkWithMeta
): DocumentReference {
  return {
    id: chunk.id,
    document_id: chunk.document_id,
    title: chunk.document.title,
    filename: chunk.document.filename,
    page_number: chunk.page_number,
    department: chunk.document.department,
    classification: chunk.document.classification,
    updated_at: chunk.document.updated_at,
    excerpt: chunk.content.slice(0, 120) + (chunk.content.length > 120 ? '…' : ''),
  };
}

export { scoreText };

/** knowledge_items + document_chunks の簡易キーワード検索 */
export async function searchRagCandidates(
  user: SessionUser,
  query: string,
  hasActiveTokenPass: boolean,
  limit = 5
): Promise<RagSearchResult> {
  const companyId = resolveEffectiveCompanyId(user);
  const cacheKey = `rag:${companyId}:${query}:${hasActiveTokenPass}:${limit}`;

  return measureAsync('rag.search', () =>
    cached(cacheKey, 60_000, async () => {
      const knowledge = await searchKnowledgeCandidates(user, query, hasActiveTokenPass, limit);

      let docs = filterByCompany(await listDocuments(companyId), companyId);
      let chunks = filterByCompany(await getAllDocumentChunks(companyId), companyId);

      if (docs.length === 0) {
        docs = filterByCompany(MOCK_DOCUMENTS, companyId);
        chunks = filterByCompany(MOCK_DOCUMENT_CHUNKS, companyId);
      }

      const docMap = new Map(docs.map((d) => [d.id, d]));

      const accessibleChunks: DocumentChunkWithMeta[] = chunks
        .map((chunk) => {
          const doc = docMap.get(chunk.document_id);
          if (!doc || doc.status !== 'indexed') return null;
          if (
            !canAccessDocument(
              user,
              hasActiveTokenPass,
              doc.classification,
              doc.department_id
            )
          ) {
            return null;
          }
          return {
            ...chunk,
            document: {
              title: doc.title,
              filename: doc.filename,
              department: doc.department,
              classification: doc.classification,
              updated_at: doc.updated_at,
              owner_name: doc.owner_name,
            },
          } satisfies DocumentChunkWithMeta;
        })
        .filter((c): c is DocumentChunkWithMeta => c !== null);

      const scoredChunks = accessibleChunks
        .map((chunk) => ({ chunk, score: scoreText(chunk.content, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(({ chunk }) => chunk);

      const knowledgeSources = toKnowledgeSources(knowledge);
      const documentReferences = scoredChunks.map(toDocumentReference);

      return {
        knowledge,
        documentChunks: scoredChunks,
        knowledgeSources,
        documentReferences,
        hasAnyKnowledge: knowledge.length > 0 || scoredChunks.length > 0,
      };
    })
  );
}

export function buildDocumentContext(chunks: DocumentChunkWithMeta[]): string {
  if (chunks.length === 0) return '';
  return chunks
    .map((c, i) => {
      const page = c.page_number ? `P${c.page_number}` : 'P?';
      const dept = c.document.department ?? '—';
      return `[Doc-${i + 1}] ${c.document.filename} (${page}) 部署:${dept}\n${c.content}`;
    })
    .join('\n\n---\n\n');
}
