import { describe, expect, it } from 'vitest';
import {
  validateCompanyCreateBody,
  validateChatBody,
  validateTokenVerifyBody,
  validateUserCreateBody,
} from '@/lib/api/validate';

describe('chat validation', () => {
  it('accepts a bounded conversation history', () => {
    const result = validateChatBody({
      message: '続けて教えて',
      history: [
        { role: 'user', content: '情報セキュリティとは何ですか' },
        { role: 'assistant', content: '情報を守るための仕組みです', answer_mode: 'general' },
      ],
    });

    expect(result).toMatchObject({ ok: true, message: '続けて教えて' });
    if (result.ok) expect(result.history).toHaveLength(2);
  });

  it('rejects unbounded conversation history', () => {
    const result = validateChatBody({
      message: '続けて',
      history: Array.from({ length: 9 }, () => ({ role: 'user', content: '質問' })),
    });

    expect(result.ok).toBe(false);
  });
});

describe('token pass validation', () => {
  it('requires an access reason', () => {
    const result = validateTokenVerifyBody({ code: 'PASS-1234' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('reason');
  });

  it('trims and accepts a valid access reason', () => {
    const result = validateTokenVerifyBody({
      code: 'PASS-1234',
      reason: '  契約内容の確認  ',
    });

    expect(result).toEqual({
      ok: true,
      code: 'PASS-1234',
      reason: '契約内容の確認',
    });
  });
});

describe('identity onboarding validation', () => {
  it('normalizes a complete company and initial admin request', () => {
    const result = validateCompanyCreateBody({
      name: ' テスト株式会社 ',
      loginId: 'test-company',
      plan: 'standard',
      adminFullName: ' 管理 太郎 ',
      adminEmployeeNumber: ' adm-001 ',
      adminEmail: 'ADMIN@example.com',
      adminPassword: 'long-password-123',
    });

    expect(result).toMatchObject({
      ok: true,
      name: 'テスト株式会社',
      loginId: 'test-company',
      adminFullName: '管理 太郎',
      adminEmployeeNumber: 'ADM-001',
      adminEmail: 'admin@example.com',
    });
  });

  it('rejects reserved super admin creation through tenant user input', () => {
    const result = validateUserCreateBody({
      fullName: '不正 管理者',
      employeeNumber: 'ROOT-001',
      email: 'root@example.com',
      password: 'long-password-123',
      role: 'super_admin',
    });

    expect(result.ok).toBe(false);
  });
});
