import { describe, expect, it } from 'vitest';
import {
  normalizeLoginIdentifiers,
  validateLoginInput,
} from '@/lib/auth/login-identifiers';

describe('login identifiers', () => {
  it('normalizes company ID and employee number consistently', () => {
    expect(normalizeLoginIdentifiers(' Demo-Company ', ' emp-001 ')).toEqual({
      companyId: 'demo-company',
      employeeNumber: 'EMP-001',
    });
  });

  it('accepts valid enterprise credentials', () => {
    expect(validateLoginInput('demo-company', 'EMP-001', 'password123')).toBeNull();
  });

  it('rejects malformed identifiers without identifying which account exists', () => {
    expect(validateLoginInput('../company', 'EMP 001', 'short')).toBe(
      '企業ID、社員番号、またはパスワードが正しくありません。'
    );
  });
});
