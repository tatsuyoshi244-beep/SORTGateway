import type { ChatAssistantPayload } from '@/types';
import type { RagSearchResult } from '@/lib/rag/search';
import { buildDocumentContext } from '@/lib/rag/search';
import { toEnrichedKnowledgeSources, attachQualityToPayload } from '@/lib/knowledge/quality';
import { allowsExternalInternalContext, isOpenAIConfigured } from '@/lib/env';
import {
  containsSensitiveOutboundData,
  decideChatAnswerMode,
  filterGeneralHistory,
  type ChatHistoryTurn,
} from '@/lib/chat/policy';

const NO_KNOWLEDGE_WARNING =
  '登録された社内ナレッジ・ドキュメントに該当する情報が見つかりませんでした。推測による回答は行っていません。担当者検索またはドキュメント管理をご確認ください。';

const GENERAL_KNOWLEDGE_WARNING =
  '一般知識による回答です。自社の規程・正式手順・法務判断としては使用せず、必要に応じて社内責任者へ確認してください。';

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
        answer_mode: 'restricted',
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
      answer_mode: 'internal',
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
      answer_mode: hasKnowledge ? 'internal' : 'restricted',
    },
    rag
  );
}

function buildRestrictedPayload(question: string): ChatAssistantPayload {
  const containsPotentialSecret = containsSensitiveOutboundData(question);

  return {
    answer: containsPotentialSecret
      ? '機密情報・認証情報・個人情報の可能性がある内容を検出したため、外部AIへ送信せず回答を停止しました。必要な情報を伏せて質問し直してください。'
      : '社内固有の質問として確認しましたが、閲覧可能な社内資料に根拠が見つかりませんでした。一般論で会社のルールを推測せず、担当部署または管理者へ確認してください。',
    rationale: '社内情報の誤回答と外部への不要なデータ送信を防ぐガバナンス判定です。',
    sources: [],
    references: [],
    document_references: [],
    warnings: [
      containsPotentialSecret
        ? '入力内容は生成AI APIへ送信されていません。'
        : NO_KNOWLEDGE_WARNING,
    ],
    has_knowledge: false,
    answer_mode: 'restricted',
    quality: EMPTY_QUALITY,
  };
}

function buildGeneralUnavailablePayload(): ChatAssistantPayload {
  return {
    answer: '一般的な質問への回答機能は準備されていますが、この環境では生成AI APIが未接続のため回答を生成できません。社内ナレッジ検索は引き続き利用できます。',
    rationale: '社内資料を使用しない一般回答として処理しましたが、生成AI接続が設定されていません。',
    sources: [],
    references: [],
    document_references: [],
    warnings: [GENERAL_KNOWLEDGE_WARNING],
    has_knowledge: false,
    answer_mode: 'general',
    quality: EMPTY_QUALITY,
  };
}

async function buildGeneralOpenAIPayload(
  question: string,
  history: ChatHistoryTurn[]
): Promise<ChatAssistantPayload> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const safeHistory = filterGeneralHistory(history);
  const system = `あなたは企業内で利用される一般相談AIです。
社内ナレッジや会社固有の規程を知っていると装わず、一般知識として自然な日本語で会話してください。
セキュリティ・ガバナンス・法令順守・プライバシーを優先し、機密情報や個人情報の入力を求めないでください。
医療・法律・金融など高リスクな質問では、一般情報と専門家への確認が必要な範囲を明確に分けてください。
必ず JSON のみを返してください。形式:
{
  "answer": "ユーザーへの回答（日本語）",
  "rationale": "一般知識として回答した根拠と限界",
  "warnings": ["必要な注意事項。不要なら空配列"]
}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        ...safeHistory.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: 'user', content: question },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  let parsed: { answer?: string; rationale?: string; warnings?: string[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { answer: raw, rationale: '一般知識として生成', warnings: [] };
  }

  return {
    answer: parsed.answer ?? '回答を生成できませんでした。',
    rationale: parsed.rationale ?? '社内資料を使用せず、一般知識として回答しました。',
    sources: [],
    references: [],
    document_references: [],
    warnings: [GENERAL_KNOWLEDGE_WARNING, ...(parsed.warnings ?? [])],
    has_knowledge: false,
    answer_mode: 'general',
    quality: EMPTY_QUALITY,
  };
}

export async function generateChatResponse(
  question: string,
  rag: RagSearchResult,
  history: ChatHistoryTurn[] = []
): Promise<ChatAssistantPayload> {
  const mode = decideChatAnswerMode(question, rag);
  if (mode === 'restricted') return buildRestrictedPayload(question);
  if (mode === 'general') {
    if (!isOpenAIConfigured()) return buildGeneralUnavailablePayload();
    try {
      return await buildGeneralOpenAIPayload(question, history);
    } catch {
      return buildGeneralUnavailablePayload();
    }
  }

  if (isOpenAIConfigured() && allowsExternalInternalContext()) {
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
