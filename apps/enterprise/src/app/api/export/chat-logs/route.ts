import { NextRequest } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { listChatLogs } from '@/lib/analytics/chat-log-store';
import { toCsv, csvResponse } from '@/lib/analytics/csv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const logs = await listChatLogs(auth.companyId);

  const csv = toCsv(
    [
      '日時',
      '質問者',
      '部署',
      '質問',
      '回答',
      '根拠あり',
      '信頼度',
      '参照数',
      'フィードバック',
      '未解決',
      'ステータス',
    ],
    logs.map((l) => [
      l.created_at,
      l.user_name,
      l.department,
      l.question,
      l.answer_summary,
      l.has_knowledge,
      l.confidence_score,
      l.source_count,
      l.feedback_result,
      l.unresolved,
      l.status,
    ])
  );

  return csvResponse(csv, `chat-logs-${auth.companyId}.csv`);
}
