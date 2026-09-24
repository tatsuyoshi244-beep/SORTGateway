import { describe, expect, it } from 'vitest';
import {
  containsSensitiveOutboundData,
  decideChatAnswerMode,
  filterGeneralHistory,
  isCompanySpecificQuestion,
} from '@/lib/chat/policy';
import type { RagSearchResult } from '@/lib/rag/search';

const emptyRag: RagSearchResult = {
  knowledge: [],
  documentChunks: [],
  knowledgeSources: [],
  documentReferences: [],
  hasAnyKnowledge: false,
};

describe('chat governance policy', () => {
  it('routes ordinary questions to general knowledge', () => {
    expect(decideChatAnswerMode('情報セキュリティの基本を教えて', emptyRag)).toBe('general');
  });

  it('does not fill missing company facts with general guesses', () => {
    expect(isCompanySpecificQuestion('当社の経費申請ルールを教えて')).toBe(true);
    expect(decideChatAnswerMode('当社の経費申請ルールを教えて', emptyRag)).toBe('restricted');
  });

  it('uses authorized internal knowledge when retrieval succeeds', () => {
    expect(
      decideChatAnswerMode('営業活動ガイドラインについて教えて', {
        ...emptyRag,
        hasAnyKnowledge: true,
      })
    ).toBe('internal');
  });

  it('blocks likely secrets before an external AI call', () => {
    const question = 'API key: sk-example-secret-1234567890 を確認して';
    expect(containsSensitiveOutboundData(question)).toBe(true);
    expect(decideChatAnswerMode(question, emptyRag)).toBe('restricted');
  });

  it('removes sensitive and company-specific turns from general history', () => {
    expect(
      filterGeneralHistory([
        { role: 'user', content: 'ガバナンスとは何ですか' },
        { role: 'assistant', content: '組織統治の仕組みです', answer_mode: 'general' },
        { role: 'assistant', content: '社内限定の回答です', answer_mode: 'internal' },
        { role: 'user', content: '当社の承認者は誰ですか' },
        { role: 'assistant', content: '当社の承認者は営業部長です' },
        { role: 'user', content: 'password: top-secret-value' },
      ])
    ).toEqual([
      { role: 'user', content: 'ガバナンスとは何ですか' },
      { role: 'assistant', content: '組織統治の仕組みです' },
    ]);
  });
});
