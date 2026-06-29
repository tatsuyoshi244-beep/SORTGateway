import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listChatLogs } from '@/lib/analytics/chat-log-store';
import { listKnowledge } from '@/lib/knowledge/lifecycle-store';
import { computeDepartmentAnalytics } from '@/lib/analytics/compute';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const [logs, knowledge] = await Promise.all([
    listChatLogs(auth.companyId),
    listKnowledge(auth.companyId),
  ]);

  const departments = computeDepartmentAnalytics(logs, knowledge);

  return NextResponse.json({ departments });
}
