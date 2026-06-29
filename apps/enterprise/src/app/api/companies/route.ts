import { NextRequest, NextResponse } from 'next/server';
import { listCompanies, createCompany, updateCompanyStatus } from '@/lib/companies/company-store';
import {
  authenticateRequest,
  requireSuperAdmin,
} from '@/lib/api/auth-guard';
import {
  validateCompanyCreateBody,
  validateCompanyPatchBody,
} from '@/lib/api/validate';
import { recordAdminOperation } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireSuperAdmin(auth);
  if (denied) return denied;

  try {
    const companies = await listCompanies();
    return NextResponse.json({ companies });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '企業一覧の取得に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireSuperAdmin(auth);
  if (denied) return denied;

  const validated = validateCompanyCreateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: { message: validated.message } }, { status: 400 });
  }

  try {
    const company = await createCompany({
      name: validated.name!,
      slug: validated.slug!,
      plan: validated.plan,
    });

    await recordAdminOperation(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      `企業登録: ${company.name}`,
      'company',
      company.id,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ company });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '企業登録に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireSuperAdmin(auth);
  if (denied) return denied;

  const validated = validateCompanyPatchBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: { message: validated.message } }, { status: 400 });
  }

  try {
    const company = await updateCompanyStatus(validated.id!, validated.status!);
    if (!company) {
      return NextResponse.json({ error: { message: '企業が見つかりません' } }, { status: 404 });
    }

    await recordAdminOperation(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      `企業ステータス変更: ${company.name} → ${validated.status}`,
      'company',
      company.id,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ company });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '更新に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
