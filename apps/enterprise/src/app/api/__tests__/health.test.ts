import { describe, it, expect } from 'vitest';
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
  it('returns readiness payload', async () => {
    const res = await readyGet();
    const body = await res.json();
    expect(typeof body.ready).toBe('boolean');
    expect(body.checks).toBeDefined();
  });
});
