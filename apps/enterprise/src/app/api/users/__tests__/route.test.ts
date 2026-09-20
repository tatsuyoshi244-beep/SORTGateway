import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, POST } from '@/app/api/users/route';
import { encodeSessionHeader, SESSION_HEADER } from '@/lib/api/auth-guard';
import type { SessionUser } from '@/types';

const baseUser: SessionUser = {
  id: 'user-1',
  email: 'employee@example.com',
  full_name: '一般 社員',
  display_name: '一般 社員',
  role: 'employee',
  company_id: 'demo-company',
  company_name: 'デモ株式会社',
  department_id: null,
};

const body = {
  fullName: '新規 社員',
  employeeNumber: 'EMP-100',
  email: 'new@example.com',
  password: 'long-password-123',
  role: 'employee',
};

function request(user: SessionUser) {
  return new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SESSION_HEADER]: encodeSessionHeader(user),
    },
    body: JSON.stringify(body),
  });
}

function patchRequest(user: SessionUser, patch: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      [SESSION_HEADER]: encodeSessionHeader(user),
    },
    body: JSON.stringify(patch),
  });
}

describe('POST /api/users', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('denies ordinary employees', async () => {
    const response = await POST(request(baseUser));
    expect(response.status).toBe(403);
  });

  it('fails closed for admins until production authentication is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const response = await POST(request({ ...baseUser, role: 'admin' }));
    expect(response.status).toBe(503);
  });

  it('prevents an admin from changing their own access', async () => {
    const admin = { ...baseUser, role: 'admin' as const };
    const response = await PATCH(patchRequest(admin, { id: admin.id, isActive: false }));
    expect(response.status).toBe(400);
  });
});
