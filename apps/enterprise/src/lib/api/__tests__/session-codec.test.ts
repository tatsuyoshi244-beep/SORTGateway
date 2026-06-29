import { describe, it, expect } from 'vitest';
import { decodeSessionHeader, encodeSessionHeader } from '@/lib/api/session-codec';
import type { SessionUser } from '@/types';

const user: SessionUser = {
  id: 'user-4',
  email: 'admin@sortgateway.local',
  full_name: '管理者 システム',
  display_name: '管理者 システム',
  role: 'admin',
  company_id: 'demo-company',
  company_name: 'デモ株式会社',
  department_id: null,
};

describe('session codec', () => {
  it('round-trips session user', () => {
    const encoded = encodeSessionHeader(user);
    const decoded = JSON.parse(decodeSessionHeader(encoded)) as SessionUser;
    expect(decoded.id).toBe(user.id);
    expect(decoded.role).toBe(user.role);
    expect(decoded.company_id).toBe(user.company_id);
  });
});
