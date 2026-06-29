import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  requireAdmin,
  assertCompanyScope,
} from '@/lib/api/auth-guard';
import { getIntegrationConnection } from '@/lib/integrations/integration-store';
import { runIntegrationSync } from '@/lib/integrations/sync-service';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const conn = await getIntegrationConnection(params.id);
  if (!conn) {
    return NextResponse.json({ error: { message: '連携が見つかりません' } }, { status: 404 });
  }

  const scope = assertCompanyScope(auth, conn.company_id);
  if (scope) return scope;

  if (conn.status === 'not_connected') {
    return NextResponse.json({ error: { message: '未接続の連携は同期できません' } }, { status: 400 });
  }

  try {
    const result = await runIntegrationSync({
      connectionId: params.id,
      companyId: auth.companyId,
      user: auth.user,
      syncType: 'manual',
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '同期に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
