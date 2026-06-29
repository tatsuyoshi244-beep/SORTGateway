import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  requireAdmin,
} from '@/lib/api/auth-guard';
import {
  createIntegrationConnection,
  listIntegrationConnections,
  getIntegrationSyncSummary,
} from '@/lib/integrations/integration-store';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import { INTEGRATION_PROVIDER_LABELS } from '@/lib/integrations/constants';
import type { IntegrationProvider } from '@/types';

const PROVIDERS: IntegrationProvider[] = [
  'google_drive',
  'microsoft_365',
  'slack',
  'teams',
  'notion',
  'box',
];

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const connections = await listIntegrationConnections(auth.companyId);
  const summary = await getIntegrationSyncSummary(auth.companyId);
  const connectedProviders = new Set(connections.map((c) => c.provider));

  const available = PROVIDERS.filter((p) => !connectedProviders.has(p)).map((p) => ({
    provider: p,
    label: INTEGRATION_PROVIDER_LABELS[p],
  }));

  return NextResponse.json({ connections, available, summary });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const provider = body.provider as IntegrationProvider;
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: { message: '不正なプロバイダーです' } }, { status: 400 });
  }
  if (!body.display_name?.trim()) {
    return NextResponse.json({ error: { message: 'display_name が必要です' } }, { status: 400 });
  }

  try {
    const connection = await createIntegrationConnection({
      company_id: auth.companyId,
      provider,
      display_name: String(body.display_name).trim(),
      config_json: body.config_json,
      credentials: body.credentials ? String(body.credentials) : 'mock-oauth-token',
      created_by: auth.user.id,
    });

    await recordAuditLog({
      userId: auth.user.id,
      userName: auth.user.full_name,
      companyId: auth.companyId,
      action: 'integration.connect',
      resourceType: 'integration_connection',
      resourceId: connection.id,
      result: 'success',
      details: `外部連携接続: ${connection.display_name}（${provider}）`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    return NextResponse.json({ connection });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '接続に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 400 });
  }
}
