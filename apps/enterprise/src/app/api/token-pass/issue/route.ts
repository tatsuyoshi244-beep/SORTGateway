import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/api/auth-guard';
import { allowsDemoAuth } from '@/lib/env';
import { MOCK_USERS } from '@/lib/mock-data';
import { issueDemoTokenPass } from '@/lib/token-pass/demo-token';
import type { InformationClassification, UserRole } from '@/types';

export const runtime = 'nodejs';

const ALLOWED_SCOPES: InformationClassification[] = ['confidential', 'executive_only'];
const ALLOWED_ROLES: UserRole[] = ['employee', 'manager', 'executive', 'admin'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const auth = await authenticateRequest(request, body);
    if (auth instanceof NextResponse) return auth;
    const denied = requireAdmin(auth);
    if (denied) return denied;
    if (!allowsDemoAuth()) {
      return NextResponse.json({ error: { message: 'デモ発行APIはデモ環境専用です' } }, { status: 400 });
    }

    const label = String(body.label ?? '').trim();
    const issuedTo = String(body.issued_to ?? '');
    const expiresAt = String(body.expires_at ?? '');
    const scopes = Array.isArray(body.classification_scope)
      ? body.classification_scope.filter((value): value is InformationClassification => ALLOWED_SCOPES.includes(value as InformationClassification))
      : [];
    const roles = Array.isArray(body.allowed_roles)
      ? body.allowed_roles.filter((value): value is UserRole => ALLOWED_ROLES.includes(value as UserRole))
      : [];
    const maxUses = body.max_uses == null || body.max_uses === '' ? null : Number(body.max_uses);
    const expiry = new Date(expiresAt);
    const target = MOCK_USERS.find(
      (candidate) => candidate.id === issuedTo && candidate.company_id === auth.companyId && candidate.is_active
    );

    if (!label || label.length > 100 || !target || scopes.length === 0 || roles.length === 0) {
      return NextResponse.json({ error: { message: '発行内容を確認してください' } }, { status: 400 });
    }
    if (!roles.includes(target.role)) {
      return NextResponse.json({ error: { message: '対象社員のロールを利用可能ロールに含めてください' } }, { status: 400 });
    }
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      return NextResponse.json({ error: { message: '有効期限は現在より後にしてください' } }, { status: 400 });
    }
    if (expiry.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: { message: 'デモパスの有効期限は90日以内です' } }, { status: 400 });
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000)) {
      return NextResponse.json({ error: { message: '最大利用回数は1〜1000回で指定してください' } }, { status: 400 });
    }

    const issued = issueDemoTokenPass({
      companyId: auth.companyId,
      issuedTo,
      createdBy: auth.user.id,
      label,
      scopes,
      allowedRoles: roles,
      expiresAt: expiry.toISOString(),
      maxUses,
    });
    if (!issued) {
      return NextResponse.json({ error: { message: '署名付きトークンを発行できませんでした' } }, { status: 503 });
    }
    return NextResponse.json({ pass: { ...issued.pass, plain_code: issued.code } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'トークンパスを発行できませんでした' } },
      { status: 500 }
    );
  }
}
