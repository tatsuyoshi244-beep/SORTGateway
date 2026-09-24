import type { AIUsagePolicy } from '@/types';

type PolicyValues = Omit<AIUsagePolicy, 'company_id' | 'updated_at'>;

const LIMITS = {
  monthly_request_limit: [10, 100_000],
  daily_user_limit: [1, 1_000],
  per_minute_limit: [1, 100],
  max_input_chars: [100, 4_000],
  max_output_chars: [200, 10_000],
} as const;

function booleanValue(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${field} は true / false で指定してください`);
  return value;
}

function integerValue(
  value: unknown,
  field: keyof typeof LIMITS
): number {
  const [min, max] = LIMITS[field];
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${field} は ${min}〜${max} の整数で指定してください`);
  }
  return Number(value);
}

export function validateAIUsagePolicyBody(body: unknown): PolicyValues {
  if (!body || typeof body !== 'object') throw new Error('設定内容が不正です');
  const value = body as Record<string, unknown>;
  return {
    general_ai_enabled: booleanValue(value.general_ai_enabled, 'general_ai_enabled'),
    emergency_stop: booleanValue(value.emergency_stop, 'emergency_stop'),
    monthly_request_limit: integerValue(value.monthly_request_limit, 'monthly_request_limit'),
    daily_user_limit: integerValue(value.daily_user_limit, 'daily_user_limit'),
    per_minute_limit: integerValue(value.per_minute_limit, 'per_minute_limit'),
    max_input_chars: integerValue(value.max_input_chars, 'max_input_chars'),
    max_output_chars: integerValue(value.max_output_chars, 'max_output_chars'),
    allow_internal_context: false,
  };
}
