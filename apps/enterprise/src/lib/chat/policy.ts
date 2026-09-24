import type { ChatAnswerMode } from '@/types';
import type { RagSearchResult } from '@/lib/rag/search';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
  answer_mode?: ChatAnswerMode;
}

const COMPANY_SPECIFIC_PATTERNS = [
  /(当社|弊社|自社|うちの会社|この会社|私たちの会社)/,
  /(うちの部署|この部署|私たちの部署)/,
  /社内の(規程|規定|ルール|手順|方針|資料|情報|担当|連絡先|申請|承認)/,
  /(誰が担当|担当者は|どこに申請|承認者は|社内では)/,
];

const SENSITIVE_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /Bearer\s+[A-Za-z0-9._-]{16,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:api[_\s-]?key|secret|password|パスワード|秘密鍵)\s*[:=：]\s*\S+/i,
  /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?<!\d)\d{12}(?!\d)/,
  /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/,
];

export function containsSensitiveOutboundData(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value));
}

export function isCompanySpecificQuestion(value: string): boolean {
  return COMPANY_SPECIFIC_PATTERNS.some((pattern) => pattern.test(value));
}

export function decideChatAnswerMode(
  question: string,
  rag: RagSearchResult
): ChatAnswerMode {
  if (containsSensitiveOutboundData(question)) return 'restricted';
  if (rag.hasAnyKnowledge) return 'internal';
  if (isCompanySpecificQuestion(question)) return 'restricted';
  return 'general';
}

export function filterGeneralHistory(history: ChatHistoryTurn[]): ChatHistoryTurn[] {
  return history
    .filter((turn) => turn.role === 'user' || turn.answer_mode === 'general')
    .filter((turn) => !containsSensitiveOutboundData(turn.content))
    .filter((turn) => !isCompanySpecificQuestion(turn.content))
    .slice(-8)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1500) }));
}
