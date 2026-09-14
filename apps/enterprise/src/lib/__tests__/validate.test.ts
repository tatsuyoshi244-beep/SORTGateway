import { describe, expect, it } from 'vitest';
import { validateTokenVerifyBody } from '@/lib/api/validate';

describe('token pass validation', () => {
  it('requires an access reason', () => {
    const result = validateTokenVerifyBody({ code: 'PASS-1234' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('reason');
  });

  it('trims and accepts a valid access reason', () => {
    const result = validateTokenVerifyBody({
      code: 'PASS-1234',
      reason: '  契約内容の確認  ',
    });

    expect(result).toEqual({
      ok: true,
      code: 'PASS-1234',
      reason: '契約内容の確認',
    });
  });
});
