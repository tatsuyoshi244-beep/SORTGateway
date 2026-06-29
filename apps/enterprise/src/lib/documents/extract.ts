import type { DocumentFileType } from '@/types';

export interface ExtractionResult {
  ok: true;
  text: string;
  pageTexts?: { page: number; text: string }[];
}

export interface ExtractionError {
  ok: false;
  error: string;
}

export type ExtractOutcome = ExtractionResult | ExtractionError;

const EXTRACTABLE: DocumentFileType[] = ['pdf', 'docx', 'txt', 'md'];

export function isExtractable(fileType: DocumentFileType): boolean {
  return EXTRACTABLE.includes(fileType);
}

export function inferFileType(filename: string): DocumentFileType | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, DocumentFileType> = {
    pdf: 'pdf',
    docx: 'docx',
    xlsx: 'xlsx',
    pptx: 'pptx',
    txt: 'txt',
    md: 'md',
  };
  return ext ? map[ext] ?? null : null;
}

/** バイナリから本文抽出（サーバーサイドのみ） */
export async function extractText(
  buffer: Buffer,
  fileType: DocumentFileType
): Promise<ExtractOutcome> {
  if (!isExtractable(fileType)) {
    return {
      ok: false,
      error: `${fileType.toUpperCase()} 形式のテキスト抽出は未対応です（PDF/DOCX/TXT/MD のみ）`,
    };
  }

  try {
    switch (fileType) {
      case 'txt':
      case 'md':
        return { ok: true, text: buffer.toString('utf-8') };
      case 'docx':
        return await extractDocx(buffer);
      case 'pdf':
        return await extractPdf(buffer);
      default:
        return { ok: false, error: '未対応の形式です' };
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'テキスト抽出に失敗しました',
    };
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractOutcome> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value?.trim() ?? '';
  if (!text) return { ok: false, error: 'DOCX からテキストを抽出できませんでした' };
  return { ok: true, text };
}

async function extractPdf(buffer: Buffer): Promise<ExtractOutcome> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const data = await parser.getText();
    const text = data.text?.trim() ?? '';
    if (!text) return { ok: false, error: 'PDF からテキストを抽出できませんでした' };

    const pageTexts = data.pages
      ?.filter((p) => p.text?.trim())
      .map((p) => ({ page: p.num, text: p.text }));

    return {
      ok: true,
      text,
      pageTexts: pageTexts?.length ? pageTexts : undefined,
    };
  } finally {
    await parser.destroy();
  }
}
