import type { Company } from '@/types';
import { DEMO_COMPANY_ID, PLATFORM_COMPANY_ID } from '@/lib/tenant/constants';

export const MOCK_COMPANIES: Company[] = [
  {
    id: DEMO_COMPANY_ID,
    name: 'デモ株式会社',
    slug: 'demo-company',
    plan: 'enterprise',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    user_count: 4,
    document_count: 3,
    last_activity_at: '2026-06-04T10:00:00Z',
  },
  {
    id: 'acme-corp',
    name: 'ACME商事株式会社',
    slug: 'acme-corp',
    plan: 'standard',
    status: 'active',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-05-15T00:00:00Z',
    user_count: 12,
    document_count: 8,
    last_activity_at: '2026-06-03T18:30:00Z',
  },
  {
    id: PLATFORM_COMPANY_ID,
    name: 'SORT Gateway 運営',
    slug: 'platform',
    plan: 'enterprise',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    user_count: 1,
    document_count: 0,
    last_activity_at: '2026-06-04T12:00:00Z',
  },
];
