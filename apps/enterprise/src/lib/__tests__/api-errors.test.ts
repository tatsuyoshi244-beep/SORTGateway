import { describe, it, expect } from 'vitest';
import { apiError } from '@/lib/api/errors';

describe('api errors', () => {
  it('returns unified error shape', async () => {
    const res = apiError('UNAUTHORIZED');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toContain('ログイン');
  });

  it('maps validation to 400', async () => {
    const res = apiError('VALIDATION_ERROR', '必須項目です');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe('必須項目です');
  });

  it('maps forbidden to 403', () => {
    expect(apiError('FORBIDDEN').status).toBe(403);
  });
});
