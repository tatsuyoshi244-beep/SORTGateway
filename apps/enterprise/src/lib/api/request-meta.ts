import type { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest | Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return req.headers.get('x-real-ip')?.trim() ?? null;
}

export function getUserAgent(req: NextRequest | Request): string | null {
  return req.headers.get('user-agent');
}
