import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';

describe('POST /api/auth/login', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects malformed identifiers without querying an account', async () => {
    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          companyId: '../demo',
          employeeNumber: 'EMP 001',
          password: 'short',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '企業ID、社員番号、またはパスワードが正しくありません。',
    });
  });

  it('fails closed when production authentication is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          companyId: 'demo-company',
          employeeNumber: 'EMP-001',
          password: 'password123',
        }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'ログイン機能を利用できません。',
    });
  });
});
