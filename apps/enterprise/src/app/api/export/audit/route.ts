import { NextRequest } from 'next/server';
import { authenticateRequest, requireManagerOrAbove } from '@/lib/api/auth-guard';
import { MOCK_AUDIT_LOGS } from '@/lib/mock-data';
import { toCsv, csvResponse } from '@/lib/analytics/csv';
import { filterByCompany } from '@/lib/tenant/filter';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;

  const denied = requireManagerOrAbove(auth);
  if (denied) return denied;

  const logs = filterByCompany(MOCK_AUDIT_LOGS, auth.companyId);

  const csv = toCsv(
    ['日時', 'ユーザー', 'アクション', 'リソース', '結果', '詳細', 'IP'],
    logs.map((l) => [
      l.created_at,
      l.user_name ?? l.user_id,
      l.action,
      l.resource_type,
      l.result,
      l.details,
      l.ip_address,
    ])
  );

  return csvResponse(csv, `audit-logs-${auth.companyId}.csv`);
}
