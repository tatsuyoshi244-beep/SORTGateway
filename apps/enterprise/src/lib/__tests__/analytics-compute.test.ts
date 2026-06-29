import { describe, it, expect } from 'vitest';
import { computeAnalyticsOverview } from '@/lib/analytics/compute';
import { MOCK_CHAT_LOGS } from '@/lib/analytics/mock-chat-logs';
import type { KnowledgeFeedback } from '@/types';

const feedback: KnowledgeFeedback[] = [
  {
    id: 'fb-1',
    company_id: 'demo-company',
    user_id: 'u1',
    user_name: 'Test',
    question: 'q',
    answer_summary: 'a',
    rating: 'negative',
    chat_message_id: null,
    created_at: '2026-06-01T00:00:00Z',
  },
];

describe('analytics compute', () => {
  it('produces overview metrics from mock logs', () => {
    const overview = computeAnalyticsOverview(MOCK_CHAT_LOGS, feedback);
    expect(overview.question_count).toBe(MOCK_CHAT_LOGS.length);
    expect(overview.negative_feedback_count).toBe(1);
    expect(overview.with_knowledge_rate).toBeGreaterThan(0);
  });

  it('counts active users', () => {
    const overview = computeAnalyticsOverview(MOCK_CHAT_LOGS, []);
    expect(overview.active_user_count).toBeGreaterThan(0);
  });
});
