import { createAdminClient } from '@/lib/supabase/admin';
import {
  allowsDemoAuth,
  isOpenAIConfigured,
  isProduction,
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from '@/lib/env';

export const EXPECTED_SCHEMA_VERSION = 'phase14';

export async function checkSupabaseConnection(): Promise<boolean> {
  const client = createAdminClient();
  if (!client) return false;
  const { error } = await client.from('schema_migrations').select('version').limit(1);
  return !error;
}

export async function checkStorageBucket(): Promise<boolean> {
  const client = createAdminClient();
  if (!client) return false;
  const { data, error } = await client.storage.getBucket('documents');
  return !error && !!data;
}

export async function getSchemaVersion(): Promise<string | null> {
  const client = createAdminClient();
  if (!client) return null;
  const { data, error } = await client
    .from('schema_migrations')
    .select('version')
    .order('applied_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.version as string;
}

export interface ProductionReadiness {
  checks: Record<string, boolean>;
  warnings: string[];
  schema_version: string | null;
  ready: boolean;
}

export async function evaluateProductionReadiness(): Promise<ProductionReadiness> {
  const [connectionOk, storageOk, schemaVersion] = await Promise.all([
    checkSupabaseConnection(),
    checkStorageBucket(),
    getSchemaVersion(),
  ]);

  const checks = {
    supabase: isSupabaseConfigured(),
    supabase_connection: connectionOk,
    supabase_admin: isSupabaseAdminConfigured(),
    auth: isSupabaseConfigured(),
    storage_bucket: storageOk,
    cron_secret: !!process.env.CRON_SECRET,
    openai: isOpenAIConfigured(),
    schema_version: schemaVersion === EXPECTED_SCHEMA_VERSION,
  };

  const warnings: string[] = [];
  if (!checks.openai) {
    warnings.push('OPENAI_API_KEY が未設定です。本番では AI 回答がモックになります。');
  }

  const ready =
    checks.supabase &&
    checks.supabase_connection &&
    checks.supabase_admin &&
    checks.auth &&
    checks.storage_bucket &&
    checks.cron_secret &&
    checks.schema_version;

  return { checks, warnings, schema_version: schemaVersion, ready };
}

export function evaluateDevelopmentReadiness(dataStoreWritable: boolean) {
  return {
    checks: {
      supabase: isSupabaseConfigured(),
      supabase_admin: isSupabaseAdminConfigured(),
      openai: isOpenAIConfigured(),
      data_store: dataStoreWritable,
    },
    warnings: [] as string[],
    schema_version: null as string | null,
    ready: dataStoreWritable,
  };
}

export function evaluateDemoReadiness() {
  const demoAuth = allowsDemoAuth();
  return {
    checks: {
      demo_auth: demoAuth,
      supabase: false,
      supabase_admin: false,
      openai: isOpenAIConfigured(),
    },
    warnings: [
      '公開デモモードです。実在する顧客情報・個人情報・機密情報は登録しないでください。',
    ],
    schema_version: null as string | null,
    ready: demoAuth,
  };
}

export type ReadinessMode = 'production' | 'demo' | 'development';

export function readinessMode(): ReadinessMode {
  if (isProduction()) return 'production';
  if (process.env.NODE_ENV === 'production') return 'demo';
  return 'development';
}
