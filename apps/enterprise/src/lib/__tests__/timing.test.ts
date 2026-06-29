import { describe, it, expect, beforeEach } from 'vitest';
import { measureAsync, getSlowQueries, resetTimings } from '@/lib/observability/timing';

describe('timing', () => {
  beforeEach(() => {
    resetTimings();
  });

  it('records slow operations', async () => {
    await measureAsync(
      'test.slow',
      async () => {
        await new Promise((r) => setTimeout(r, 10));
      },
      5
    );
    const slow = getSlowQueries();
    expect(slow.some((s) => s.name === 'test.slow')).toBe(true);
  });
});
