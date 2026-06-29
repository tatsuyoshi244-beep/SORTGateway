/**
 * Embedding 基盤（ダミー実装）
 *
 * 本番差し替え:
 * 1. EMBEDDING_PROVIDER 環境変数を openai | azure | vertex に設定
 * 2. embedTexts() 内の provider 分岐を実装
 * 3. document_chunks.embedding カラム + pgvector 検索を lib/rag/search.ts に追加
 */

export type EmbeddingProvider = 'dummy' | 'openai' | 'azure' | 'vertex';

export interface EmbeddingResult {
  vectors: number[][];
  provider: EmbeddingProvider;
  model: string;
}

function getProvider(): EmbeddingProvider {
  const p = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  if (p === 'openai' || p === 'azure' || p === 'vertex') return p;
  return 'dummy';
}

/** ダミーベクトル（決定的ハッシュベース・本番検索には使用しない） */
function dummyVector(text: string, dimensions = 8): number[] {
  const vec = new Array(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % dimensions] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * テキスト配列をベクトル化。
 * 現状はダミー。OpenAI 等へ差し替え時はこの関数のみ変更すればよい。
 */
export async function embedTexts(texts: string[]): Promise<EmbeddingResult> {
  const provider = getProvider();

  switch (provider) {
    case 'openai':
      // TODO: OpenAI text-embedding-3-small
      // return embedWithOpenAI(texts);
      break;
    case 'azure':
      // TODO: Azure OpenAI Embeddings
      break;
    case 'vertex':
      // TODO: Vertex AI text-embedding
      break;
    default:
      break;
  }

  return {
    vectors: texts.map((t) => dummyVector(t)),
    provider: 'dummy',
    model: 'dummy-hash-v1',
  };
}

/** 単一テキストの Embedding（将来のベクトル検索用） */
export async function embedText(text: string): Promise<number[]> {
  const { vectors } = await embedTexts([text]);
  return vectors[0] ?? [];
}
