import { describe, expect, it } from 'vitest';
import { applyAIOutputPolicy } from '@/lib/ai/output-filter';
import {
  createDefaultAIUsagePolicy,
  evaluateAIUsagePolicy,
} from '@/lib/ai/policy';
import { validateAIUsagePolicyBody } from '@/lib/ai/policy-validation';
import type { AIUsagePolicy, AIUsageSummary, ChatAssistantPayload } from '@/types';

const emptyUsage: AIUsageSummary = {
  monthly_used: 0,
  daily_user_used: 0,
  minute_used: 0,
};

function enabledPolicy(overrides: Partial<AIUsagePolicy> = {}): AIUsagePolicy {
  return {
    ...createDefaultAIUsagePolicy('company-1'),
    general_ai_enabled: true,
    ...overrides,
  };
}

function generalPayload(answer: string): ChatAssistantPayload {
  return {
    answer,
    rationale: '一般知識として回答しました。',
    sources: [],
    references: [],
    document_references: [],
    warnings: [],
    has_knowledge: false,
    answer_mode: 'general',
    quality: {
      confidence_score: 0,
      knowledge_version: null,
      source_count: 0,
      last_updated: null,
      responsible_department: null,
      responsible_person: null,
    },
  };
}

describe('AI usage policy', () => {
  it('keeps general AI disabled by default', () => {
    const policy = createDefaultAIUsagePolicy('company-1');
    expect(evaluateAIUsagePolicy(policy, emptyUsage, 20, false)).toEqual({
      allowed: false,
      reason: 'general_disabled',
    });
  });

  it('prioritizes the emergency stop', () => {
    const policy = enabledPolicy({ emergency_stop: true });
    expect(evaluateAIUsagePolicy(policy, emptyUsage, 20, true)).toEqual({
      allowed: false,
      reason: 'emergency_stop',
    });
  });

  it('never permits external AI without durable usage accounting', () => {
    expect(evaluateAIUsagePolicy(enabledPolicy(), emptyUsage, 20, false)).toEqual({
      allowed: false,
      reason: 'persistence_required',
    });
  });

  const blockedCases: Array<[
    string,
    { inputChars?: number; usage?: AIUsageSummary },
  ]> = [
    ['input_too_long', { inputChars: 2001 }],
    ['monthly_limit', { usage: { ...emptyUsage, monthly_used: 500 } }],
    ['daily_user_limit', { usage: { ...emptyUsage, daily_user_used: 20 } }],
    ['per_minute_limit', { usage: { ...emptyUsage, minute_used: 5 } }],
  ];

  it.each(blockedCases)('blocks %s', (reason, values) => {
    expect(
      evaluateAIUsagePolicy(
        enabledPolicy(),
        values.usage ?? emptyUsage,
        values.inputChars ?? 20,
        true
      )
    ).toEqual({ allowed: false, reason });
  });

  it('allows a request inside every configured limit', () => {
    expect(evaluateAIUsagePolicy(enabledPolicy(), emptyUsage, 20, true)).toEqual({
      allowed: true,
    });
  });
});

describe('AI output policy', () => {
  it('blocks likely secrets returned by an external model', () => {
    const filtered = applyAIOutputPolicy(
      generalPayload('確認用キーは sk-example-secret-1234567890 です。'),
      enabledPolicy()
    );
    expect(filtered.answer_mode).toBe('restricted');
    expect(filtered.answer).toContain('表示を停止');
  });

  it('truncates a general answer at the company limit', () => {
    const filtered = applyAIOutputPolicy(
      generalPayload('あ'.repeat(250)),
      enabledPolicy({ max_output_chars: 200 })
    );
    expect(filtered.answer).toHaveLength(200);
    expect(filtered.warnings[0]).toContain('200文字');
  });

  it('does not alter internal knowledge answers', () => {
    const payload = { ...generalPayload('あ'.repeat(250)), answer_mode: 'internal' as const };
    expect(applyAIOutputPolicy(payload, enabledPolicy({ max_output_chars: 200 }))).toBe(payload);
  });
});

describe('AI usage policy validation', () => {
  it('forces internal context sharing off', () => {
    const policy = enabledPolicy({ allow_internal_context: true });
    expect(validateAIUsagePolicyBody(policy).allow_internal_context).toBe(false);
  });

  it('rejects limits outside the approved range', () => {
    expect(() =>
      validateAIUsagePolicyBody(enabledPolicy({ daily_user_limit: 0 }))
    ).toThrow('daily_user_limit');
  });
});
