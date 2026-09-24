import type { AIUsagePolicy, AIUsageSummary } from '@/types';

export type AIUsageBlockReason =
  | 'general_disabled'
  | 'emergency_stop'
  | 'input_too_long'
  | 'monthly_limit'
  | 'daily_user_limit'
  | 'per_minute_limit'
  | 'persistence_required';

export type AIUsageDecision =
  | { allowed: true }
  | { allowed: false; reason: AIUsageBlockReason };

export const DEFAULT_AI_USAGE_LIMITS = {
  monthly_request_limit: 500,
  daily_user_limit: 20,
  per_minute_limit: 5,
  max_input_chars: 2000,
  max_output_chars: 3000,
} as const;

export function createDefaultAIUsagePolicy(companyId: string): AIUsagePolicy {
  return {
    company_id: companyId,
    general_ai_enabled: false,
    emergency_stop: false,
    ...DEFAULT_AI_USAGE_LIMITS,
    allow_internal_context: false,
    updated_at: new Date(0).toISOString(),
  };
}

export function evaluateAIUsagePolicy(
  policy: AIUsagePolicy,
  usage: AIUsageSummary,
  inputChars: number,
  persistenceReady: boolean
): AIUsageDecision {
  if (policy.emergency_stop) return { allowed: false, reason: 'emergency_stop' };
  if (!policy.general_ai_enabled) return { allowed: false, reason: 'general_disabled' };
  if (!persistenceReady) return { allowed: false, reason: 'persistence_required' };
  if (inputChars > policy.max_input_chars) return { allowed: false, reason: 'input_too_long' };
  if (usage.monthly_used >= policy.monthly_request_limit) {
    return { allowed: false, reason: 'monthly_limit' };
  }
  if (usage.daily_user_used >= policy.daily_user_limit) {
    return { allowed: false, reason: 'daily_user_limit' };
  }
  if (usage.minute_used >= policy.per_minute_limit) {
    return { allowed: false, reason: 'per_minute_limit' };
  }
  return { allowed: true };
}

export const AI_USAGE_BLOCK_MESSAGES: Record<AIUsageBlockReason, string> = {
  general_disabled: 'この企業では一般AI回答が無効になっています。社内ナレッジ検索は利用できます。',
  emergency_stop: '管理者が外部AI接続を緊急停止しています。社内ナレッジ検索は利用できます。',
  input_too_long: '外部AIへ送信できる入力文字数の上限を超えています。内容を短くして再送してください。',
  monthly_limit: '企業全体の月間AI利用上限に達しました。管理者へ確認してください。',
  daily_user_limit: '本日の個人AI利用上限に達しました。社内ナレッジ検索は引き続き利用できます。',
  per_minute_limit: '短時間のAI利用回数が上限に達しました。少し時間を空けて再試行してください。',
  persistence_required:
    '安全な利用回数管理が未設定のため、外部AI接続を停止しています。管理者が本番データベースを設定してください。',
};
