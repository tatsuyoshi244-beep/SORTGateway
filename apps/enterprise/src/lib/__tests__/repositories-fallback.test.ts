import { afterEach, describe, expect, it, vi } from 'vitest';

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({ createBrowserClient }));

import { fetchKnowledgeItems } from '@/lib/repositories';

describe('repository data source boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    createBrowserClient.mockReset();
  });

  it('uses demo data only when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    const result = await fetchKnowledgeItems('demo-company');

    expect(result.source).toBe('mock');
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it('fails closed instead of exposing demo data when the configured client is unavailable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    createBrowserClient.mockReturnValue(null);

    const result = await fetchKnowledgeItems('demo-company');

    expect(result).toEqual({
      data: [],
      source: 'supabase',
      error: 'Supabaseクライアントを初期化できませんでした。',
    });
  });
});
