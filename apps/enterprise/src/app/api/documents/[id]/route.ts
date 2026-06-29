import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, getDocument, getDocumentChunks } from '@/lib/documents/document-store';
import { MOCK_DOCUMENTS, MOCK_DOCUMENT_CHUNKS } from '@/lib/mock-documents';
import {
  authenticateRequest,
  assertCompanyScope,
  requireManagerOrAbove,
} from '@/lib/api/auth-guard';
import { recordDocumentDelete } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  try {
    let doc = await getDocument(params.id);
    let chunks = await getDocumentChunks(params.id);

    if (!doc) {
      doc = MOCK_DOCUMENTS.find((d) => d.id === params.id) ?? null;
      if (doc) {
        chunks = MOCK_DOCUMENT_CHUNKS.filter((c) => c.document_id === params.id);
      }
    }

    if (!doc) {
      return NextResponse.json({ error: { message: 'ドキュメントが見つかりません' } }, { status: 404 });
    }

    const scope = assertCompanyScope(auth, doc.company_id);
    if (scope) return scope;

    return NextResponse.json({ document: doc, chunks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '取得に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  try {
    const existing = (await getDocument(params.id)) ??
      MOCK_DOCUMENTS.find((d) => d.id === params.id) ??
      null;

    if (!existing) {
      return NextResponse.json({ error: { message: 'ドキュメントが見つかりません' } }, { status: 404 });
    }

    const scope = assertCompanyScope(auth, existing.company_id);
    if (scope) return scope;

    const ok = await deleteDocument(params.id);
    if (!ok) {
      return NextResponse.json({ error: { message: '削除に失敗しました' } }, { status: 404 });
    }

    await recordDocumentDelete(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      params.id,
      existing.filename,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '削除に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
