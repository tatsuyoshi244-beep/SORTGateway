import { describe, it, expect } from 'vitest';
import { canAccessRoute, canViewClassification } from '@/lib/permissions';
import type { UserRole } from '@/types';

describe('permissions', () => {
  it('allows employee to access chat', () => {
    expect(canAccessRoute('employee', 'chat')).toBe(true);
  });

  it('denies employee from admin users', () => {
    expect(canAccessRoute('employee', 'admin_users')).toBe(false);
  });

  it('allows admin to access integrations', () => {
    expect(canAccessRoute('admin', 'admin_integrations')).toBe(true);
  });

  it('allows manager to access analytics', () => {
    expect(canAccessRoute('manager', 'admin_analytics')).toBe(true);
  });

  it('restricts confidential without token', () => {
    expect(
      canViewClassification('employee', 'confidential', false, 'dept-1', 'dept-1')
    ).toBe(false);
  });

  it('allows manager confidential in same context', () => {
    expect(
      canViewClassification('manager', 'confidential', false, 'dept-1', 'dept-1')
    ).toBe(true);
  });

  const adminOnly: UserRole[] = ['admin', 'super_admin'];
  it.each(adminOnly)('%s can access admin_system', (role) => {
    expect(canAccessRoute(role, 'admin_system')).toBe(true);
  });
});
