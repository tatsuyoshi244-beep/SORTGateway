import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listChatLogs } from '@/lib/analytics/chat-log-store';
import { buildUnresolvedViews } from '@/lib/analytics/compute';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const logs = await listChatLogs(auth.companyId);
  const questions = buildUnresolvedViews(logs);

  return NextResponse.json({ questions });
}
