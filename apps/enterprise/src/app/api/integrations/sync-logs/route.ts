import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/api/auth-guard';
import { listIntegrationSyncLogs } from '@/lib/integrations/integration-store';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get('connection_id') ?? undefined;

  const logs = await listIntegrationSyncLogs(auth.companyId, connectionId);
  return NextResponse.json({ logs });
}
