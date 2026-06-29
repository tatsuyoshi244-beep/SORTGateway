import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/env';

let browserClient: SupabaseClient | null = null;

/** ブラウザ用 Supabase クライアント（未設定時は null） */
export function createBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  if (typeof window !== 'undefined' && browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createSupabaseClient(url, key);

  if (typeof window !== 'undefined') {
    browserClient = client;
  }
  return client;
}

/** @deprecated createBrowserClient を使用 */
export function createClient() {
  return createBrowserClient();
}

export { isSupabaseConfigured } from '@/lib/env';
