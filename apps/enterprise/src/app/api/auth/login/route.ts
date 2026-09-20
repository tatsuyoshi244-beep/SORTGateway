import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured } from '@/lib/env';
import {
  normalizeLoginIdentifiers,
  validateLoginInput,
} from '@/lib/auth/login-identifiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INVALID_CREDENTIALS = '企業ID、社員番号、またはパスワードが正しくありません。';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 400 });
  }

  const validationError = validateLoginInput(
    body.companyId,
    body.employeeNumber,
    body.password
  );
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: 'ログイン機能を利用できません。' }, { status: 503 });
  }

  const { companyId, employeeNumber } = normalizeLoginIdentifiers(
    body.companyId as string,
    body.employeeNumber as string
  );
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'ログイン機能を利用できません。' }, { status: 503 });
  }

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('email, is_active')
    .eq('company_id', companyId)
    .eq('employee_number', employeeNumber)
    .maybeSingle();

  if (profileError || !profile?.email || !profile.is_active) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await authClient.auth.signInWithPassword({
    email: String(profile.email),
    password: body.password as string,
  });

  if (error || !data.session) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
  }

  return NextResponse.json(
    {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
