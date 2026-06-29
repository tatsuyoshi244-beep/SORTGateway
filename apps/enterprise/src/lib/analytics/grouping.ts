/** 簡易キーワード抽出（日本語・英数字） */
export function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const tokens = normalized.match(/[\u3040-\u30ff\u4e00-\u9fff]{2,}|[a-z0-9]{3,}/g) ?? [];
  const stop = new Set(['です', 'ます', 'ください', '教えて', 'について', 'どこ', 'とは', 'the', 'and']);
  return Array.from(new Set(tokens.filter((t) => !stop.has(t))));
}

export function countSimilarQuestions(
  question: string,
  allQuestions: string[]
): { similar_count: number; group_keywords: string[] } {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) {
    return { similar_count: 0, group_keywords: [] };
  }

  let similar = 0;
  for (const other of allQuestions) {
    if (other === question) continue;
    const otherKw = extractKeywords(other);
    const overlap = keywords.filter((k) => otherKw.includes(k)).length;
    if (overlap >= 2 || (keywords.length === 1 && overlap === 1)) similar += 1;
  }

  return { similar_count: similar, group_keywords: keywords.slice(0, 5) };
}

export function groupQuestionsByKeywords(
  questions: Array<{ id: string; question: string }>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const q of questions) {
    const kw = extractKeywords(q.question);
    const key = kw.slice(0, 2).sort().join('|') || q.id;
    const existing = groups.get(key) ?? [];
    existing.push(q.id);
    groups.set(key, existing);
  }

  return groups;
}
