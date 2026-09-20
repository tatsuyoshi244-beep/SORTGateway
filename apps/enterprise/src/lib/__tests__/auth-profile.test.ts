import { describe, expect, it, vi } from 'vitest';
import { fetchUserProfile } from '@/lib/auth/profile';

describe('fetchUserProfile', () => {
  it('fails closed when the profile cannot be loaded', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: new Error('offline') });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle })),
        })),
      })),
    };

    const profile = await fetchUserProfile(
      client as never,
      'user-1'
    );

    expect(profile).toBeNull();
  });
});
