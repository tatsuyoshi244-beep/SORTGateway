import { NextRequest } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listChatLogs } from '@/lib/analytics/chat-log-store';
import { buildUnresolvedViews } from '@/lib/analytics/compute';
import { toCsv, csvResponse } from '@/lib/analytics/csv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const logs = await listChatLogs(auth.companyId);
  const questions = buildUnresolvedViews(logs);

  const csv = toCsv(
    [
      '日時',
      '質問者',
      '部署',
      '質問',
      'AI回答',
      '根拠なし理由',
      '類似質問数',
      'ステータス',
      '担当者',
    ],
    questions.map((q) => [
      q.created_at,
      q.user_name,
      q.department,
      q.question,
      q.answer_summary,
      q.no_knowledge_reason,
      q.similar_count,
      q.status,
      q.assigned_to_name,
    ])
  );

  return csvResponse(csv, `unresolved-questions-${auth.companyId}.csv`);
}
