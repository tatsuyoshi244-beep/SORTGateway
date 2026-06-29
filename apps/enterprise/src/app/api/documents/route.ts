import { NextRequest, NextResponse } from 'next/server';
import { listDocuments } from '@/lib/documents/document-store';
import { getDocumentStats } from '@/lib/documents/stats';
import { MOCK_DOCUMENTS } from '@/lib/mock-documents';
import { filterByCompany } from '@/lib/tenant/filter';
import { authenticateRequest } from '@/lib/api/auth-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = auth.companyId;

    let documents = await listDocuments(companyId);
    if (documents.length === 0) {
      documents = filterByCompany(MOCK_DOCUMENTS, companyId);
    }
    const stats = getDocumentStats(documents);
    return NextResponse.json({ documents, stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ドキュメント一覧の取得に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
