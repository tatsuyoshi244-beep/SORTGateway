import { NextResponse } from 'next/server';
import { getBuildInfo } from '@/lib/build-info';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export async function GET() {
  const info = getBuildInfo();
  return NextResponse.json({
    status: 'ok',
    ...info,
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
  });
}
