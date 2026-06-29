import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { getLifecycleStore } from '@/lib/knowledge/lifecycle-store';
import { computeAdminStats } from '@/lib/knowledge/workflow';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const { knowledge, feedback, chat_usage_count } = await getLifecycleStore(auth.companyId);
  const stats = computeAdminStats(knowledge, feedback, chat_usage_count);

  return NextResponse.json({ stats });
}
