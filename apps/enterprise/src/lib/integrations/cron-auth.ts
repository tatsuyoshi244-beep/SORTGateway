import { NextRequest, NextResponse } from 'next/server';

function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** CRON_SECRET または開発環境でのみジョブ実行を許可 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (isDevelopment()) return null;
    return NextResponse.json(
      { error: { message: 'CRON_SECRET が未設定です。本番では環境変数を設定してください。' } },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const headerSecret = req.headers.get('x-cron-secret');
  const provided = bearer ?? headerSecret;

  if (provided !== secret) {
    return NextResponse.json({ error: { message: '認証に失敗しました' } }, { status: 401 });
  }

  return null;
}
