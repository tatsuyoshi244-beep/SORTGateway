import { NextRequest, NextResponse } from 'next/server';
import { uploadAndProcessDocument } from '@/lib/documents/document-store';
import {
  authenticateRequest,
  requireManagerOrAbove,
  SESSION_HEADER,
} from '@/lib/api/auth-guard';
import { validateClassification, validateUploadFile } from '@/lib/api/validate';
import { recordDocumentUpload } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import type { InformationClassification } from '@/types';
import { SUPPORTED_DOCUMENT_TYPES } from '@/lib/env';
import { inferFileType } from '@/lib/documents/extract';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const userRaw = req.headers.get(SESSION_HEADER) ?? form.get('session');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: 'ファイルが必要です' } }, { status: 400 });
    }

    let sessionUser = null;
    if (userRaw && typeof userRaw === 'string') {
      try {
        const decoded = Buffer.from(userRaw, 'base64url').toString('utf8');
        sessionUser = JSON.parse(decoded);
      } catch {
        /* fall through */
      }
    }

    const auth = await authenticateRequest(req, sessionUser ? { user: sessionUser } : undefined);
    if (auth instanceof NextResponse) return auth;

    const denied = requireManagerOrAbove(auth);
    if (denied) return denied;

    const fileType = inferFileType(file.name);
    if (!fileType || !SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: { message: '対応形式: PDF, DOCX, XLSX, PPTX, TXT, MD' } },
        { status: 400 }
      );
    }

    const fileCheck = validateUploadFile(file, fileType);
    if (!fileCheck.ok) {
      return NextResponse.json({ error: { message: fileCheck.message } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const title = String(form.get('title') || file.name).slice(0, 200);
    const department = form.get('department') ? String(form.get('department')).slice(0, 100) : null;
    const department_id = form.get('department_id')
      ? String(form.get('department_id'))
      : auth.user.department_id;
    const classification = validateClassification(
      form.get('classification')
    ) as InformationClassification;

    const doc = await uploadAndProcessDocument({
      buffer,
      filename: file.name,
      title,
      department,
      department_id,
      classification,
      owner: auth.user,
      company_id: auth.companyId,
    });

    await recordDocumentUpload(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      doc.id,
      doc.filename,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ document: doc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'アップロードに失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
