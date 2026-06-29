import type { ChatAssistantPayload } from '@/types';
import type { RagSearchResult } from '@/lib/rag/search';
import { buildDocumentContext } from '@/lib/rag/search';
import { toEnrichedKnowledgeSources, attachQualityToPayload } from '@/lib/knowledge/quality';
import { isOpenAIConfigured } from '@/lib/env';

const NO_KNOWLEDGE_WARNING =
  '登録された社内ナレッジ・ドキュメントに該当する情報が見つかりませんでした。推測による回答は行っていません。担当者検索またはドキュメント管理をご確認ください。';

const EMPTY_QUALITY = {
  confidence_score: 0,
  knowledge_version: null,
  source_count: 0,
  last_updated: null,
  responsible_department: null,
  responsible_person: null,
};

function buildMockPayload(question: string, rag: RagSearchResult): ChatAssistantPayload {
  const { knowledge, documentChunks, documentReferences } = rag;
  const sources = toEnrichedKnowledgeSources(knowledge);

  if (!rag.hasAnyKnowledge) {
    return attachQualityToPayload(
      {
        answer:
          '社内ナレッジ・ドキュメントを確認しましたが、ご質問に直接対応する登録情報は見つかりませんでした。',
        rationale:
          'キーワード一致する Published ナレッジ・ドキュメントチャンクが存在しないため、社内文書に基づく回答は提供できません。',
        sources: [],
        references: [],
        document_references: [],
        warnings: [NO_KNOWLEDGE_WARNING],
        has_knowledge: false,
      },
      rag
    );
  }

  const primaryKnowledge = knowledge[0];
  const primaryDoc = documentChunks[0];
  const refTitles = [
    ...knowledge.map((k) => k.title),
    ...documentChunks.map((c) => c.document.filename),
  ].join('、');

  let answerBody = '';
  if (primaryKnowledge) {
    answerBody += primaryKnowledge.content.slice(0, 300);
  }
  if (primaryDoc) {
    if (answerBody) answerBody += '\n\n';
    const page = primaryDoc.page_number ? `（P${primaryDoc.page_number}）` : '';
    answerBody += `ドキュメント「${primaryDoc.document.filename}」${page}より:\n${primaryDoc.content.slice(0, 300)}`;
  }

  return attachQualityToPayload(
    {
      answer: `ご質問「${question}」について、社内資料（${refTitles}）を参照しました。\n\n${answerBody}${answerBody.length >= 300 ? '…' : ''}\n\n詳細は参考資料をご確認ください。`,
      rationale: `Published ナレッジ ${knowledge.length} 件、ドキュメントチャンク ${documentChunks.length} 件を参照して回答を構成しました。`,
      sources,
      references: sources,
      document_references: documentReferences,
      warnings: [],
      has_knowledge: true,
    },
    rag
  );
}

async function buildOpenAIPayload(
  question: string,
  rag: RagSearchResult
): Promise<ChatAssistantPayload> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const { knowledge, documentChunks } = rag;
  const sources = toEnrichedKnowledgeSources(knowledge);

  const knowledgeBlock =
    knowledge.length === 0
      ? '（参照可能な社内ナレッジなし）'
      : knowledge
          .map(
            (k, i) =>
              `[K-${i + 1}] タイトル: ${k.title} v${k.version}\n分類: ${k.classification}\n担当: ${k.responsible_person_name ?? '—'}\n内容:\n${k.content}`
          )
          .join('\n\n---\n\n');

  const documentBlock =
    documentChunks.length === 0
      ? '（参照可能なドキュメントチャンクなし）'
      : buildDocumentContext(documentChunks);

  const system = `あなたは企業向け社内AIアシスタントです。
以下の社内ナレッジ（Published のみ）およびドキュメントチャンクのみを根拠に回答してください。
情報がない場合は推測せず、その旨を明確に述べてください。
必ず JSON のみを返してください。形式:
{
  "answer": "ユーザーへの回答（日本語）",
  "rationale": "なぜその回答になったか（根拠の説明）",
  "warnings": ["注意事項の配列。不要なら空配列"]
}`;

  const userContent = `社内ナレッジ:\n${knowledgeBlock}\n\nドキュメント:\n${documentBlock}\n\n質問: ${question}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  let parsed: { answer?: string; rationale?: string; warnings?: string[] } = {};

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { answer: raw, rationale: 'OpenAI 応答のパースに失敗しました', warnings: [] };
  }

  const hasKnowledge = rag.hasAnyKnowledge;
  const warnings = [...(parsed.warnings ?? [])];
  if (!hasKnowledge) {
    warnings.push(NO_KNOWLEDGE_WARNING);
  }

  return attachQualityToPayload(
    {
      answer:
        parsed.answer ??
        (hasKnowledge ? '回答を生成できませんでした。' : '社内ナレッジに該当情報がありません。'),
      rationale: parsed.rationale ?? (hasKnowledge ? 'ナレッジ・ドキュメントを参照して生成' : '該当情報なし'),
      sources,
      references: sources,
      document_references: rag.documentReferences,
      warnings,
      has_knowledge: hasKnowledge,
    },
    rag
  );
}

export async function generateChatResponse(
  question: string,
  rag: RagSearchResult
): Promise<ChatAssistantPayload> {
  if (isOpenAIConfigured()) {
    try {
      return await buildOpenAIPayload(question, rag);
    } catch {
      return buildMockPayload(question, rag);
    }
  }
  return buildMockPayload(question, rag);
}

/** @deprecated 後方互換 */
export async function generateChatResponseFromKnowledge(
  question: string,
  candidates: import('@/types').KnowledgeItem[],
  documentChunks: import('@/types').DocumentChunkWithMeta[] = [],
  documentReferences: RagSearchResult['documentReferences'] = []
): Promise<ChatAssistantPayload> {
  const rag: RagSearchResult = {
    knowledge: candidates,
    documentChunks,
    knowledgeSources: toEnrichedKnowledgeSources(candidates),
    documentReferences,
    hasAnyKnowledge: candidates.length > 0 || documentChunks.length > 0,
  };
  return generateChatResponse(question, rag);
}

export { EMPTY_QUALITY };
