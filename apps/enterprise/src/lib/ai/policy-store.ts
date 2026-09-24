import type { AIUsagePolicy, AIUsageSummary } from '@/types';
import {
  createDefaultAIUsagePolicy,
  evaluateAIUsagePolicy,
  type AIUsageBlockReason,
} from '@/lib/ai/policy';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAdminConfigured, isSupabaseConfigured } from '@/lib/env';

interface ReservationResult {
  allowed: boolean;
  reason?: AIUsageBlockReason;
  eventId?: string;
  policy: AIUsagePolicy;
  summary: AIUsageSummary;
}

const demoPolicies = new Map<string, AIUsagePolicy>();

function requireAdminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error('AI利用制御用の本番データベース接続が未設定です');
  return admin;
}

function mapPolicy(row: Record<string, unknown>, companyId: string): AIUsagePolicy {
  const fallback = createDefaultAIUsagePolicy(companyId);
  return {
    company_id: companyId,
    general_ai_enabled: Boolean(row.general_ai_enabled),
    emergency_stop: Boolean(row.emergency_stop),
    monthly_request_limit: Number(row.monthly_request_limit ?? fallback.monthly_request_limit),
    daily_user_limit: Number(row.daily_user_limit ?? fallback.daily_user_limit),
    per_minute_limit: Number(row.per_minute_limit ?? fallback.per_minute_limit),
    max_input_chars: Number(row.max_input_chars ?? fallback.max_input_chars),
    max_output_chars: Number(row.max_output_chars ?? fallback.max_output_chars),
    // External transmission of internal knowledge is intentionally not configurable.
    allow_internal_context: false,
    updated_at: String(row.updated_at ?? fallback.updated_at),
  };
}

export function isAIUsagePersistenceReady(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export async function getAIUsagePolicy(companyId: string): Promise<AIUsagePolicy> {
  if (!isAIUsagePersistenceReady()) {
    return demoPolicies.get(companyId) ?? createDefaultAIUsagePolicy(companyId);
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from('ai_usage_policies')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new Error(`AI利用ポリシーを読み込めませんでした: ${error.message}`);
  return data
    ? mapPolicy(data as Record<string, unknown>, companyId)
    : createDefaultAIUsagePolicy(companyId);
}

export async function updateAIUsagePolicy(
  companyId: string,
  policy: AIUsagePolicy,
  userId: string
): Promise<AIUsagePolicy> {
  const next = { ...policy, company_id: companyId, updated_at: new Date().toISOString() };
  if (!isAIUsagePersistenceReady()) {
    demoPolicies.set(companyId, next);
    return next;
  }

  const admin = requireAdminClient();
  const { data, error } = await admin
    .from('ai_usage_policies')
    .upsert({ ...next, updated_by: userId }, { onConflict: 'company_id' })
    .select('*')
    .single();
  if (error) throw new Error(`AI利用ポリシーを保存できませんでした: ${error.message}`);
  return mapPolicy(data as Record<string, unknown>, companyId);
}

export async function getAIUsageSummary(
  companyId: string,
  userId: string
): Promise<AIUsageSummary> {
  if (!isAIUsagePersistenceReady()) {
    return { monthly_used: 0, daily_user_used: 0, minute_used: 0 };
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const minuteStart = new Date(now.getTime() - 60_000).toISOString();
  const admin = requireAdminClient();

  const [monthly, daily, minute] = await Promise.all([
    admin
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', monthStart),
    admin
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .gte('created_at', dayStart),
    admin
      .from('ai_usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', minuteStart),
  ]);

  const error = monthly.error ?? daily.error ?? minute.error;
  if (error) throw new Error(`AI利用状況を読み込めませんでした: ${error.message}`);
  return {
    monthly_used: monthly.count ?? 0,
    daily_user_used: daily.count ?? 0,
    minute_used: minute.count ?? 0,
  };
}

export async function reserveGeneralAIUsage(input: {
  companyId: string;
  userId: string;
  inputChars: number;
}): Promise<ReservationResult> {
  const policy = await getAIUsagePolicy(input.companyId);
  const summary = await getAIUsageSummary(input.companyId, input.userId);
  const persistenceReady = isAIUsagePersistenceReady();
  const localDecision = evaluateAIUsagePolicy(
    policy,
    summary,
    input.inputChars,
    persistenceReady
  );
  if (!localDecision.allowed) return { ...localDecision, policy, summary };

  const admin = requireAdminClient();
  const { data, error } = await admin.rpc('reserve_ai_usage', {
    p_company_id: input.companyId,
    p_user_id: input.userId,
    p_input_chars: input.inputChars,
  });
  if (error) throw new Error(`AI利用枠を確保できませんでした: ${error.message}`);

  const result = (data ?? {}) as Record<string, unknown>;
  const rpcSummary = (result.summary ?? {}) as Record<string, unknown>;
  return {
    allowed: Boolean(result.allowed),
    reason: result.reason
      ? (String(result.reason) as AIUsageBlockReason)
      : result.allowed
        ? undefined
        : 'persistence_required',
    eventId: result.event_id ? String(result.event_id) : undefined,
    policy,
    summary: {
      monthly_used: Number(rpcSummary.monthly_used ?? summary.monthly_used),
      daily_user_used: Number(rpcSummary.daily_user_used ?? summary.daily_user_used),
      minute_used: Number(rpcSummary.minute_used ?? summary.minute_used),
    },
  };
}

export async function finalizeAIUsage(eventId: string | undefined, outputChars: number): Promise<void> {
  if (!eventId || !isAIUsagePersistenceReady()) return;
  const admin = requireAdminClient();
  const { error } = await admin
    .from('ai_usage_events')
    .update({ output_chars: outputChars, completed_at: new Date().toISOString() })
    .eq('id', eventId);
  if (error) throw new Error(`AI利用記録を更新できませんでした: ${error.message}`);
}
