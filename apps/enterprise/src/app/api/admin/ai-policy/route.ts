import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/api/auth-guard';
import {
  getAIUsagePolicy,
  getAIUsageSummary,
  isAIUsagePersistenceReady,
  updateAIUsagePolicy,
} from '@/lib/ai/policy-store';
import { validateAIUsagePolicyBody } from '@/lib/ai/policy-validation';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const [policy, summary] = await Promise.all([
    getAIUsagePolicy(auth.companyId),
    getAIUsageSummary(auth.companyId, auth.user.id),
  ]);
  return NextResponse.json({
    policy,
    summary,
    persistence_ready: isAIUsagePersistenceReady(),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await authenticateRequest(req, body);
    if (auth instanceof NextResponse) return auth;
    const denied = requireAdmin(auth);
    if (denied) return denied;

    const values = validateAIUsagePolicyBody(body);
    const policy = await updateAIUsagePolicy(
      auth.companyId,
      {
        ...values,
        company_id: auth.companyId,
        updated_at: new Date().toISOString(),
      },
      auth.user.id
    );

    await recordAuditLog({
      userId: auth.user.id,
      userName: auth.user.full_name,
      companyId: auth.companyId,
      action: 'admin.operation',
      resourceType: 'ai_usage_policy',
      resourceId: auth.companyId,
      result: 'success',
      details: `AI利用ポリシー更新（一般AI: ${policy.general_ai_enabled ? '有効' : '無効'}、緊急停止: ${policy.emergency_stop ? '有効' : '無効'}）`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({
      policy,
      persistence_ready: isAIUsagePersistenceReady(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI利用ポリシーを保存できませんでした';
    return NextResponse.json({ error: { message } }, { status: 400 });
  }
}
