import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api/auth-guard';
import { markNotificationRead } from '@/lib/knowledge/lifecycle-store';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const ok = await markNotificationRead(params.id);
  if (!ok) {
    return NextResponse.json({ error: { message: '通知が見つかりません' } }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
