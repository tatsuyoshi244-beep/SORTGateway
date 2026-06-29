import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/integrations/cron-auth';
import { runScheduledIntegrationSyncs } from '@/lib/integrations/scheduled-sync-job';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runScheduledIntegrationSyncs();
    return NextResponse.json({
      ok: true,
      message: `定期同期完了: ${result.succeeded}/${result.processed} 件成功`,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'ジョブ実行に失敗しました';
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}

/** ヘルスチェック用 */
export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  return NextResponse.json({
    ok: true,
    endpoint: '/api/jobs/sync-integrations',
    cron_secret_configured: Boolean(process.env.CRON_SECRET),
    environment: process.env.NODE_ENV,
  });
}
