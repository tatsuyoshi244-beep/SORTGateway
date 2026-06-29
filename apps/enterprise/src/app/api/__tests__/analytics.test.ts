import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/analytics/route';
import { encodeSessionHeader, SESSION_HEADER } from '@/lib/api/auth-guard';
import type { SessionUser } from '@/types';

const adminUser: SessionUser = {
  id: 'user-4',
  email: 'admin@sortgateway.local',
  full_name: '管理者 システム',
  display_name: '管理者 システム',
  role: 'admin',
  company_id: 'demo-company',
  company_name: 'デモ株式会社',
  department_id: null,
};

describe('analytics API', () => {
  it('returns overview for admin', async () => {
    const req = new NextRequest('http://localhost/api/admin/analytics', {
      headers: { [SESSION_HEADER]: encodeSessionHeader(adminUser) },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview).toBeDefined();
    expect(body.overview.question_count).toBeGreaterThan(0);
  });

  it('rejects unauthenticated', async () => {
    const req = new NextRequest('http://localhost/api/admin/analytics');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
