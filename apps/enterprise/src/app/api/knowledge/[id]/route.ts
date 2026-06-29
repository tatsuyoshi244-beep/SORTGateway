import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  assertCompanyScope,
  requireManagerOrAbove,
} from '@/lib/api/auth-guard';
import { getKnowledge, saveKnowledge, transitionKnowledgeStatus } from '@/lib/knowledge/lifecycle-store';
import { canTransitionWorkflow } from '@/lib/knowledge/workflow';
import type { KnowledgeApprovalStatus } from '@/types';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const existing = await getKnowledge(params.id);
  if (!existing) {
    return NextResponse.json({ error: { message: 'ナレッジが見つかりません' } }, { status: 404 });
  }

  const scope = assertCompanyScope(auth, existing.company_id);
  if (scope) return scope;

  if (body.status) {
    const to = body.status as KnowledgeApprovalStatus;
    if (!canTransitionWorkflow(auth.user.role, existing.approval_status, to)) {
      return NextResponse.json({ error: { message: 'このステータス変更は許可されていません' } }, { status: 403 });
    }
    const updated = await transitionKnowledgeStatus(
      params.id,
      to,
      auth.user.id,
      auth.user.full_name
    );
    return NextResponse.json({ knowledge: updated });
  }

  const updated = await saveKnowledge(
    {
      id: params.id,
      company_id: existing.company_id,
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
      summary: body.summary ?? existing.summary,
      category: body.category ?? existing.category,
      classification: body.classification ?? existing.classification,
    },
    auth.user.id,
    auth.user.full_name,
    body.change_reason
  );

  return NextResponse.json({ knowledge: updated });
}
