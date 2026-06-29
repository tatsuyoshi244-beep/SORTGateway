import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  requireAdmin,
  assertCompanyScope,
} from '@/lib/api/auth-guard';
import {
  disconnectIntegrationConnection,
  getIntegrationConnection,
} from '@/lib/integrations/integration-store';
import { getIntegrationAdapter } from '@/lib/integrations/registry';
import { recordAuditLog } from '@/lib/audit';
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

  const adapter = getIntegrationAdapter(conn.provider);
  await adapter.disconnect();

  const updated = await disconnectIntegrationConnection(params.id);

  await recordAuditLog({
    userId: auth.user.id,
    userName: auth.user.full_name,
    companyId: auth.companyId,
    action: 'integration.disconnect',
    resourceType: 'integration_connection',
    resourceId: params.id,
    result: 'success',
    details: `外部連携切断: ${conn.display_name}`,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });

  return NextResponse.json({ connection: updated });
}
