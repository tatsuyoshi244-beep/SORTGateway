import { NextRequest, NextResponse } from 'next/server';
import {
  recordAuditLog,
  recordAdminOperation,
  recordKnowledgeView,
  recordRoleChange,
  recordAuthLogin,
  recordAuthLogout,
  recordTenantSwitch,
  type AuditAction,
} from '@/lib/audit';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';
import type { AuditResult } from '@/lib/audit';

export const runtime = 'nodejs';

interface AuditBody {
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: string;
  result?: AuditResult;
  targetUserId?: string;
  targetRole?: string;
  targetCompanyId?: string;
  targetCompanyName?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AuditBody;
    const auth = await authenticateRequest(req, body);
    if (auth instanceof NextResponse) return auth;

    if (!body.action) {
      return NextResponse.json({ error: { message: '不正なリクエスト' } }, { status: 400 });
    }

    const ip = getClientIp(req);
    const ua = getUserAgent(req);
    const result = body.result ?? 'success';

    switch (body.action) {
      case 'auth.login':
        await recordAuthLogin(
          auth.user.id,
          auth.user.full_name,
          auth.companyId,
          result === 'success',
          ip,
          ua
        );
        break;
      case 'auth.logout':
        await recordAuthLogout(auth.user.id, auth.user.full_name, auth.companyId, ip, ua);
        break;
      case 'tenant.switch':
        if (body.targetCompanyId && body.targetCompanyName) {
          await recordTenantSwitch(
            auth.user.id,
            auth.user.full_name,
            auth.companyId,
            body.targetCompanyId,
            body.targetCompanyName,
            ip,
            ua
          );
        }
        break;
      case 'role.change':
        if (body.targetUserId && body.targetRole) {
          await recordRoleChange(
            auth.user.id,
            auth.user.full_name,
            auth.companyId,
            body.targetUserId,
            body.targetRole,
            ip,
            ua
          );
        }
        break;
      case 'knowledge.view':
        if (body.resourceId) {
          await recordKnowledgeView(
            auth.user.id,
            auth.user.full_name,
            auth.companyId,
            body.resourceId,
            body.details ?? '',
            ip,
            ua
          );
        }
        break;
      case 'admin.operation':
        await recordAdminOperation(
          auth.user.id,
          auth.user.full_name,
          auth.companyId,
          body.details ?? '',
          body.resourceType,
          body.resourceId,
          ip,
          ua
        );
        break;
      default:
        await recordAuditLog({
          userId: auth.user.id,
          userName: auth.user.full_name,
          companyId: auth.companyId,
          action: body.action,
          resourceType: body.resourceType,
          resourceId: body.resourceId,
          result,
          details: body.details,
          ipAddress: ip,
          userAgent: ua,
        });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: { message: '監査ログ記録に失敗しました' } }, { status: 500 });
  }
}
