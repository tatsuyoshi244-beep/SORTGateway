import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/api/auth-guard';
import { getTimingStats, getSlowQueries } from '@/lib/observability/timing';
import { getRecentLogs } from '@/lib/observability/logger';
import { getCache, MemoryCache } from '@/lib/cache';
import { getBuildInfo } from '@/lib/build-info';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const denied = requireAdmin(auth);
  if (denied) return denied;

  const timing = getTimingStats();
  const cache = getCache();
  const cacheEntries = cache instanceof MemoryCache ? cache.size() : 0;

  return NextResponse.json({
    build: getBuildInfo(),
    timing,
    slow_queries: getSlowQueries(10),
    recent_errors: getRecentLogs(20).filter((l) => l.level === 'error'),
    cache_entries: cacheEntries,
  });
}
