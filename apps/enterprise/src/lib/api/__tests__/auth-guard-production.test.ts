import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { authenticateRequest, encodeSessionHeader, SESSION_HEADER } from '@/lib/api/auth-guard';
import type { SessionUser } from '@/types';

const demoUser: SessionUser = {
  id: 'user-4',
  email: 'admin@sortgateway.local',
  full_name: '管理者 システム',
  display_name: '管理者 システム',
  role: 'admin',
  company_id: 'demo-company',
  company_name: 'デモ株式会社',
  department_id: null,
};

describe('authenticateRequest production hardening', () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  });

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it('rejects x-sort-session header in production', async () => {
    const req = new NextRequest('http://localhost/api/admin/analytics', {
      headers: { [SESSION_HEADER]: encodeSessionHeader(demoUser) },
    });
    const res = await authenticateRequest(req);
    expect(res).toBeInstanceOf(Response);
    if (res instanceof Response) {
      expect(res.status).toBe(401);
    }
  });

  it('rejects body user in production', async () => {
    const req = new NextRequest('http://localhost/api/chat', { method: 'POST' });
    const res = await authenticateRequest(req, { user: demoUser });
    expect(res).toBeInstanceOf(Response);
    if (res instanceof Response) {
      expect(res.status).toBe(401);
    }
  });
});

describe('allowsDemoAuth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true in production without supabase', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  const { allowsDemoAuth } = await import('@/lib/env');
  expect(allowsDemoAuth()).toBe(true);
});

  it('is true in development without supabase', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const { allowsDemoAuth } = await import('@/lib/env');
    expect(allowsDemoAuth()).toBe(true);
  });
});
