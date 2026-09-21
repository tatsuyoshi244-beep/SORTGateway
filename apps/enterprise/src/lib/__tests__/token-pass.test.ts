import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TOKEN_PASS_CODE } from '@/lib/env';
import { issueTokenPassGrant, verifyTokenPassGrant } from '@/lib/token-pass/grant';
import { issueDemoTokenPass, verifyDemoTokenPass } from '@/lib/token-pass/demo-token';
import { verifyTokenPass } from '@/lib/token-pass/verify';
import { MOCK_TOKEN_PASSES } from '@/lib/mock-data';

describe('token pass account binding', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the demo pass only for the employee it was issued to', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');

    const accepted = await verifyTokenPass(
      DEMO_TOKEN_PASS_CODE,
      'demo-company',
      'executive',
      'user-3'
    );
    const rejected = await verifyTokenPass(
      DEMO_TOKEN_PASS_CODE,
      'demo-company',
      'admin',
      'user-4'
    );

    expect(accepted.ok).toBe(true);
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain('別の社員');
  });
});

describe('token pass grants', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('binds a short-lived grant to one user and one company', () => {
    vi.stubEnv('TOKEN_PASS_GRANT_SECRET', 'test-token-pass-secret');
    const pass = MOCK_TOKEN_PASSES[0];
    const grant = issueTokenPassGrant(pass, 'user-3', 'demo-company');

    expect(grant).toBeTruthy();
    expect(verifyTokenPassGrant(grant, 'user-3', 'demo-company')).toBe(true);
    expect(verifyTokenPassGrant(grant, 'user-4', 'demo-company')).toBe(false);
    expect(verifyTokenPassGrant(grant, 'user-3', 'other-company')).toBe(false);
    expect(verifyTokenPassGrant(`${grant}tampered`, 'user-3', 'demo-company')).toBe(false);
  });
});

describe('dynamically issued demo token pass', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps signed issue conditions and detects tampering', () => {
    vi.stubEnv('TOKEN_PASS_GRANT_SECRET', 'test-token-pass-secret');
    const issued = issueDemoTokenPass({
      companyId: 'demo-company', issuedTo: 'user-1', createdBy: 'user-4',
      label: '部署横断改善レビュー', scopes: ['confidential'],
      allowedRoles: ['employee'], expiresAt: new Date(Date.now() + 60_000).toISOString(),
      maxUses: 5,
    });
    expect(issued).not.toBeNull();
    expect(verifyDemoTokenPass(issued!.code)).toMatchObject({
      company_id: 'demo-company', issued_to: 'user-1', label: '部署横断改善レビュー',
      classification_scope: ['confidential'], allowed_roles: ['employee'],
    });
    expect(verifyDemoTokenPass(`${issued!.code}x`)).toBeNull();
  });

  it('can be applied only by the issued employee', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('TOKEN_PASS_GRANT_SECRET', 'test-token-pass-secret');
    const issued = issueDemoTokenPass({
      companyId: 'demo-company', issuedTo: 'user-1', createdBy: 'user-4',
      label: '社員向け機密確認', scopes: ['confidential'], allowedRoles: ['employee'],
      expiresAt: new Date(Date.now() + 60_000).toISOString(), maxUses: 1,
    });
    const accepted = await verifyTokenPass(issued!.code, 'demo-company', 'employee', 'user-1');
    const rejected = await verifyTokenPass(issued!.code, 'demo-company', 'employee', 'user-2');
    expect(accepted.ok).toBe(true);
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toContain('別の社員');
  });
});
