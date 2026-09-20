import { afterEach, describe, it, expect, vi } from 'vitest';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as readyGet } from '@/app/api/ready/route';

describe('health API', () => {
  it('returns ok status', async () => {
    const res = await healthGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
  });
});

describe('ready API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns readiness payload', async () => {
    const res = await readyGet();
    const body = await res.json();
    expect(typeof body.ready).toBe('boolean');
    expect(body.checks).toBeDefined();
  });

  it('reports hosted demo mode as ready without probing local storage', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    const res = await readyGet();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.mode).toBe('demo');
    expect(body.checks.demo_auth).toBe(true);
    expect(body.checks.data_store).toBeUndefined();
  });
});
