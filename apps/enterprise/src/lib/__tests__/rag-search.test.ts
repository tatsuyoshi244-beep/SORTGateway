import { describe, it, expect } from 'vitest';
import { scoreText } from '@/lib/rag/search';

describe('RAG scoreText', () => {
  it('scores higher when query words match', () => {
    const text = '見積承認のルールについて説明します';
    expect(scoreText(text, '見積承認')).toBeGreaterThan(0);
  });

  it('returns zero for unrelated text', () => {
    expect(scoreText('hello world', '見積')).toBe(0);
  });

  it('gives bonus for full phrase match', () => {
    const phrase = '営業マニュアル';
    const withPhrase = scoreText(`社内の${phrase}です`, phrase);
    const partial = scoreText('社内資料', phrase);
    expect(withPhrase).toBeGreaterThanOrEqual(partial);
  });
});
