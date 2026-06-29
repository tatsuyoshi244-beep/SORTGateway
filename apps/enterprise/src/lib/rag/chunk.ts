/** 本文を約500文字単位でチャンク分割 */

export interface TextChunk {
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

/** トークン数の簡易推定（本番は tiktoken 等に差し替え） */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function splitIntoChunks(
  text: string,
  options?: { chunkSize?: number; pageTexts?: { page: number; text: string }[] }
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? CHUNK_SIZE;

  if (options?.pageTexts?.length) {
    return splitByPages(options.pageTexts, chunkSize);
  }

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let index = 0;
  let chunkIndex = 0;

  while (index < normalized.length) {
    const end = Math.min(index + chunkSize, normalized.length);
    const slice = normalized.slice(index, end).trim();
    if (slice) {
      chunks.push({
        chunk_index: chunkIndex,
        content: slice,
        token_count: estimateTokenCount(slice),
        page_number: null,
      });
      chunkIndex += 1;
    }
    if (end >= normalized.length) break;
    index = end - CHUNK_OVERLAP;
    if (index < 0) index = 0;
  }

  return chunks;
}

function splitByPages(
  pageTexts: { page: number; text: string }[],
  chunkSize: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const { page, text } of pageTexts) {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) continue;

    let index = 0;
    while (index < normalized.length) {
      const end = Math.min(index + chunkSize, normalized.length);
      const slice = normalized.slice(index, end).trim();
      if (slice) {
        chunks.push({
          chunk_index: chunkIndex,
          content: slice,
          token_count: estimateTokenCount(slice),
          page_number: page,
        });
        chunkIndex += 1;
      }
      if (end >= normalized.length) break;
      index = end - CHUNK_OVERLAP;
    }
  }

  return chunks;
}
