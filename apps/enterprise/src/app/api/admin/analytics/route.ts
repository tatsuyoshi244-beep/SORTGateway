import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listChatLogs } from '@/lib/analytics/chat-log-store';
import { listFeedback } from '@/lib/knowledge/lifecycle-store';
import { computeAnalyticsOverview } from '@/lib/analytics/compute';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const [logs, feedback] = await Promise.all([
    listChatLogs(auth.companyId),
    listFeedback(auth.companyId),
  ]);

  const overview = computeAnalyticsOverview(logs, feedback);

  return NextResponse.json({ overview, question_count: logs.length });
}
