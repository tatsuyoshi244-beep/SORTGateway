import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAdminConfigured } from '@/lib/env';

/** サービスロール（監査ログ書き込み等・サーバーのみ） */
export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
