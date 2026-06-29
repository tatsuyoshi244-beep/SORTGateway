import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/env';

/** サーバー用 anon クライアント（RLS 適用） */
export function createServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
