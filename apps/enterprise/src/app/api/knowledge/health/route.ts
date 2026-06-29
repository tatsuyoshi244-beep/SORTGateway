import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listKnowledge } from '@/lib/knowledge/lifecycle-store';
import { computeKnowledgeHealth, countByTier } from '@/lib/knowledge/workflow';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const items = await listKnowledge(auth.companyId);
  const rows = computeKnowledgeHealth(items);
  const counts = countByTier(rows);

  return NextResponse.json({ health: rows, counts });
}
