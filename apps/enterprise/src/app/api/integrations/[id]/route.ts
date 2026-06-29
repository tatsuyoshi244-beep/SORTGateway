import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  requireAdmin,
  assertCompanyScope,
} from '@/lib/api/auth-guard';
import {
  getIntegrationConnection,
  updateIntegrationConnection,
} from '@/lib/integrations/integration-store';
import { encryptCredentials } from '@/lib/integrations/crypto';
import { computeNextSyncAt } from '@/lib/integrations/sync-schedule';
import { recordAuditLog } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import type { IntegrationSyncFrequency } from '@/types';

const FREQUENCIES: IntegrationSyncFrequency[] = ['manual', 'hourly', 'daily', 'weekly'];

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const conn = await getIntegrationConnection(params.id);
  if (!conn) {
    return NextResponse.json({ error: { message: '連携が見つかりません' } }, { status: 404 });
  }

  const scope = assertCompanyScope(auth, conn.company_id);
  if (scope) return scope;

  const patch: Parameters<typeof updateIntegrationConnection>[1] = {};

  if (body.display_name) patch.display_name = String(body.display_name);
  if (body.config_json) {
    patch.config_json = { ...conn.config_json, ...body.config_json };
  }
  if (body.credentials) {
    patch.encrypted_credentials = encryptCredentials(String(body.credentials));
    patch.status = 'connected';
  }
  if (body.enabled === false) {
    patch.status = 'disabled';
    patch.config_json = { ...conn.config_json, enabled: false };
  } else if (body.enabled === true) {
    patch.config_json = { ...conn.config_json, enabled: true };
    if (conn.encrypted_credentials) patch.status = 'connected';
  }

  if (typeof body.sync_enabled === 'boolean') {
    patch.sync_enabled = body.sync_enabled;
    const frequency = (body.sync_frequency ?? conn.sync_frequency) as IntegrationSyncFrequency;
    patch.next_sync_at =
      body.sync_enabled && frequency !== 'manual' ? computeNextSyncAt(frequency) : null;
  }

  if (body.sync_frequency && FREQUENCIES.includes(body.sync_frequency)) {
    const frequency = body.sync_frequency as IntegrationSyncFrequency;
    patch.sync_frequency = frequency;
    const syncEnabled = body.sync_enabled ?? conn.sync_enabled;
    patch.next_sync_at =
      syncEnabled && frequency !== 'manual' ? computeNextSyncAt(frequency) : null;
  }

  const updated = await updateIntegrationConnection(params.id, patch);

  if (body.sync_enabled !== undefined || body.sync_frequency) {
    await recordAuditLog({
      userId: auth.user.id,
      userName: auth.user.full_name,
      companyId: auth.companyId,
      action: 'integration.sync',
      resourceType: 'integration_connection',
      resourceId: params.id,
      result: 'success',
      details: `同期スケジュール更新: ${conn.display_name}（${body.sync_frequency ?? conn.sync_frequency} / ${body.sync_enabled ?? conn.sync_enabled ? 'ON' : 'OFF'}）`,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
  }

  return NextResponse.json({ connection: updated });
}
