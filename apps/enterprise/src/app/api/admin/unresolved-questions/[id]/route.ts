import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  requireManagerOrAbove,
  assertCompanyScope,
} from '@/lib/api/auth-guard';
import { getChatLog, updateChatLog } from '@/lib/analytics/chat-log-store';
import { saveKnowledge } from '@/lib/knowledge/lifecycle-store';
import { createNotification } from '@/lib/knowledge/lifecycle-store';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import { recordAuditLog } from '@/lib/audit';

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

  const log = await getChatLog(params.id);
  if (!log) {
    return NextResponse.json({ error: { message: '質問が見つかりません' } }, { status: 404 });
  }

  const scope = assertCompanyScope(auth, log.company_id);
  if (scope) return scope;

  const action = body.action as string;

  if (action === 'create_knowledge') {
    const item = await saveKnowledge(
      {
        company_id: log.company_id,
        title: body.title ?? `【未解決】${log.question.slice(0, 40)}`,
        content: body.content ?? `質問: ${log.question}\n\nAI回答: ${log.answer_summary}\n\n※未解決質問から自動作成`,
        summary: log.question.slice(0, 120),
        category: 'FAQ',
        department_id: log.department_id,
        department_name: log.department ?? undefined,
        responsible_person_id: body.responsible_person_id ?? auth.user.id,
        responsible_person_name: body.responsible_person_name ?? auth.user.full_name,
        tags: ['未解決質問', '要レビュー'],
      },
      auth.user.id,
      auth.user.full_name,
      '未解決質問からナレッジ Draft を作成'
    );

    const updated = await updateChatLog(log.id, {
      knowledge_item_id: item.id,
      resolved_by_admin: true,
      unresolved: false,
      status: 'resolved',
    });

    await createNotification({
      company_id: log.company_id,
      user_id: null,
      type: 'knowledge_review',
      title: '未解決質問からナレッジ Draft が作成されました',
      message: `「${item.title}」が Draft として登録されました。レビュー・公開を進めてください。`,
      resource_type: 'knowledge_item',
      resource_id: item.id,
    });

    await recordAuditLog({
      userId: auth.user.id,
      userName: auth.user.full_name,
      companyId: auth.companyId,
      action: 'admin.operation',
      resourceType: 'chat_log',
      resourceId: log.id,
      result: 'success',
      details: `未解決質問をナレッジ化: ${item.title}`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ log: updated, knowledge: item });
  }

  if (action === 'assign') {
    const updated = await updateChatLog(log.id, {
      assigned_to_id: body.assigned_to_id ?? null,
      assigned_to_name: body.assigned_to_name ?? null,
      status: 'assigned',
    });
    return NextResponse.json({ log: updated });
  }

  if (action === 'resolve') {
    const updated = await updateChatLog(log.id, {
      resolved_by_admin: true,
      unresolved: false,
      status: 'resolved',
    });
    return NextResponse.json({ log: updated });
  }

  if (action === 'hide') {
    const updated = await updateChatLog(log.id, {
      unresolved: false,
      status: 'hidden',
    });
    return NextResponse.json({ log: updated });
  }

  return NextResponse.json({ error: { message: '不正な action です' } }, { status: 400 });
}
