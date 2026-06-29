import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenPass } from '@/lib/token-pass/verify';
import { recordTokenPassVerify } from '@/lib/audit';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { validateTokenVerifyBody } from '@/lib/api/validate';
import { getClientIp, getUserAgent } from '@/lib/api/request-meta';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await authenticateRequest(req, body);
    if (auth instanceof NextResponse) return auth;

    const validated = validateTokenVerifyBody(body);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.message }, { status: 400 });
    }

    const result = await verifyTokenPass(
      validated.code!,
      auth.companyId,
      auth.user.role
    );

    await recordTokenPassVerify(
      auth.user.id,
      auth.user.full_name,
      auth.companyId,
      result.pass?.id ?? null,
      result.ok,
      getClientIp(req),
      getUserAgent(req)
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({ ok: true, pass: result.pass });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '検証に失敗しました';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
