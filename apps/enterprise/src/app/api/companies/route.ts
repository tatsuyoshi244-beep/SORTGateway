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
import { createAdminClient } from '@/lib/supabase/admin';
import { createTenantUser, ProvisioningError } from '@/lib/identity/provisioning';

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: '入力内容が不正です' } }, { status: 400 });
  }
  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;

  const denied = requireSuperAdmin(auth);
  if (denied) return denied;

  const validated = validateCompanyCreateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: { message: validated.message } }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        { error: { message: '企業発行は本番認証の設定後に利用できます' } },
        { status: 503 }
      );
    }

    const company = await createCompany({
      name: validated.name!,
      loginId: validated.loginId!,
      plan: validated.plan,
    });

    const { data: department } = await admin
      .from('departments')
      .select('id')
      .eq('company_id', company.id)
      .eq('code', 'HQ')
      .single();

    try {
      await createTenantUser(admin, {
        companyId: company.id,
        fullName: validated.adminFullName!,
        employeeNumber: validated.adminEmployeeNumber!,
        email: validated.adminEmail!,
        password: validated.adminPassword!,
        role: 'admin',
        departmentId: department?.id ? String(department.id) : null,
      });
    } catch (error) {
      await admin.from('companies').delete().eq('id', company.id);
      throw error;
    }

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

    return NextResponse.json({ company }, { status: 201 });
  } catch (err) {
    if (err instanceof ProvisioningError) {
      return NextResponse.json({ error: { message: err.message } }, { status: err.status });
    }
    return NextResponse.json(
      { error: { message: '企業発行に失敗しました。企業IDやメールの重複を確認してください。' } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: '入力内容が不正です' } }, { status: 400 });
  }
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
