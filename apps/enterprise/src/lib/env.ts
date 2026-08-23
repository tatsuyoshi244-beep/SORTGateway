/** サーバー / クライアント共通の環境ヘルパー */

export function isProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  );
}


/** デモログイン・x-sort-session を許可するか（開発かつ Supabase 未設定のみ） */
export function allowsDemoAuth(): boolean {
  return !isProduction() && !isSupabaseConfigured();
}


export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return !!(
    isSupabaseConfigured() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export const DEMO_TOKEN_PASS_CODE = 'EXEC-2026-Q2-A1B2';

/** ローカルファイル保存（Supabase Storage 未使用時） */
export function getLocalUploadDir(): string {
  return process.env.DOCUMENT_UPLOAD_DIR || '.data/uploads';
}

export const SUPPORTED_DOCUMENT_TYPES = [
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'txt',
  'md',
] as const;
