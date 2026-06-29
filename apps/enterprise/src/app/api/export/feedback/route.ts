import { NextRequest } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listFeedback } from '@/lib/knowledge/lifecycle-store';
import { toCsv, csvResponse } from '@/lib/analytics/csv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const feedback = await listFeedback(auth.companyId);

  const csv = toCsv(
    ['日時', 'ユーザー', '評価', '質問', '回答要約'],
    feedback.map((f) => [
      f.created_at,
      f.user_name,
      f.rating,
      f.question,
      f.answer_summary,
    ])
  );

  return csvResponse(csv, `feedback-${auth.companyId}.csv`);
}
