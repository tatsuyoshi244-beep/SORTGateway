import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/api/auth-guard';
import { validateUserCreateBody, validateUserPatchBody } from '@/lib/api/validate';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTenantUser, ProvisioningError } from '@/lib/identity/provisioning';
import { recordAdminOperation } from '@/lib/audit';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: '入力内容が不正です' } }, { status: 400 });
  }

  const auth = await authenticateRequest(req, body);
  if (auth instanceof NextResponse) return auth;
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const validated = validateUserCreateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: { message: validated.message } }, { status: 400 });
  }

  const client = createAdminClient();
  if (!client) {
    return NextResponse.json(
      { error: { message: '社員登録は本番認証の設定後に利用できます' } },
      { status: 503 }
    );
  }

  try {
    const user = await createTenantUser(client, {
      companyId: auth.companyId,
      fullName: validated.fullName!,
      employeeNumber: validated.employeeNumber!,
      email: validated.email!,
      password: validated.password!,
      role: validated.role!,
      departmentId: validated.departmentId,
    });

    await recordAdminOperation(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      `社員登録: ${user.full_name} (${user.employee_number})`,
      'user',
      user.id,
      getClientIp(req),
      getUserAgent(req)
    );

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ProvisioningError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { message: '社員登録に失敗しました' } }, { status: 500 });
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
  const denied = requireAdmin(auth);
  if (denied) return denied;

  const validated = validateUserPatchBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: { message: validated.message } }, { status: 400 });
  }
  if (validated.id === auth.user.id) {
    return NextResponse.json(
      { error: { message: '自分自身の権限・利用状態はこの画面から変更できません' } },
      { status: 400 }
    );
  }

  const client = createAdminClient();
  if (!client) {
    return NextResponse.json(
      { error: { message: '社員管理は本番認証の設定後に利用できます' } },
      { status: 503 }
    );
  }

  const { data: target, error: targetError } = await client
    .from('users')
    .select('id, full_name, employee_number, role, is_active')
    .eq('id', validated.id!)
    .eq('company_id', auth.companyId)
    .maybeSingle();
  if (targetError || !target || target.role === 'super_admin') {
    return NextResponse.json({ error: { message: '社員が見つかりません' } }, { status: 404 });
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (validated.role != null) changes.role = validated.role;
  if (validated.isActive != null) changes.is_active = validated.isActive;

  const { data: updated, error: updateError } = await client
    .from('users')
    .update(changes)
    .eq('id', validated.id!)
    .eq('company_id', auth.companyId)
    .select('*, departments:department_id(name)')
    .single();
  if (updateError || !updated) {
    return NextResponse.json({ error: { message: '社員情報を更新できませんでした' } }, { status: 500 });
  }

  const action = validated.isActive == null
    ? `ロール変更: ${target.full_name} → ${validated.role}`
    : `利用状態変更: ${target.full_name} → ${validated.isActive ? '有効' : '停止'}`;
  await recordAdminOperation(
    auth.user.id,
    auth.user.full_name,
    auth.companyId,
    action,
    'user',
    validated.id!,
    getClientIp(req),
    getUserAgent(req)
  );

  const joined = updated.departments as { name?: string } | { name?: string }[] | null;
  const departmentName = Array.isArray(joined) ? joined[0]?.name : joined?.name;
  return NextResponse.json({
    user: {
      id: String(updated.id),
      company_id: String(updated.company_id),
      employee_number: String(updated.employee_number),
      email: String(updated.email),
      full_name: String(updated.full_name),
      role: updated.role,
      department_id: updated.department_id ? String(updated.department_id) : null,
      department_name: departmentName,
      is_active: Boolean(updated.is_active),
      created_at: String(updated.created_at),
    },
  });
}
