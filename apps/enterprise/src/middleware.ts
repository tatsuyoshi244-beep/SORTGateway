import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { recordTiming } from '@/lib/observability/timing';

export function middleware(request: NextRequest) {
  const start = Date.now();
  const response = NextResponse.next();
  const duration = Date.now() - start;

  if (request.nextUrl.pathname.startsWith('/api/')) {
    recordTiming(`api:${request.method}:${request.nextUrl.pathname}`, duration, 1000);
    response.headers.set('X-Response-Time', `${duration}ms`);
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
