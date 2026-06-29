import type { TokenPass, UserRole } from '@/types';
import { MOCK_TOKEN_PASSES } from '@/lib/mock-data';
import { DEMO_TOKEN_PASS_CODE } from '@/lib/env';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured, isSupabaseAdminConfigured } from '@/lib/env';
import { hashToken, tokensMatch } from '@/lib/token-pass/hash';

export interface TokenPassVerifyResult {
  ok: boolean;
  pass?: TokenPass;
  error?: string;
}

function mapTokenRow(row: Record<string, unknown>): TokenPass {
  return {
    id: String(row.id),
    company_id: String(row.company_id ?? 'demo-company'),
    label: String(row.label),
    classification_scope: row.classification_scope as TokenPass['classification_scope'],
    allowed_roles: (row.allowed_roles as UserRole[]) ?? ['employee', 'manager', 'executive', 'admin'],
    issued_to: row.issued_to ? String(row.issued_to) : null,
    created_by: row.created_by ? String(row.created_by) : 'system',
    expires_at: String(row.expires_at),
    is_active: Boolean(row.is_active),
    used_count: Number(row.used_count ?? 0),
    max_uses: row.max_uses != null ? Number(row.max_uses) : null,
    revoked_at: row.revoked_at ? String(row.revoked_at) : null,
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function sanitizePass(pass: TokenPass): TokenPass {
  const { plain_code, ...safe } = pass;
  void plain_code;
  return safe;
}

function validatePass(pass: TokenPass, userRole?: UserRole): TokenPassVerifyResult {
  if (pass.revoked_at) {
    return { ok: false, error: 'トークンパスは失効しています' };
  }
  if (!pass.is_active) {
    return { ok: false, error: 'トークンパスは無効化されています' };
  }
  if (new Date(pass.expires_at) < new Date()) {
    return { ok: false, error: 'トークンパスの有効期限が切れています' };
  }
  if (pass.max_uses !== null && pass.used_count >= pass.max_uses) {
    return { ok: false, error: 'トークンパスの利用上限に達しています' };
  }
  if (userRole && pass.allowed_roles.length > 0 && !pass.allowed_roles.includes(userRole)) {
    return { ok: false, error: 'このロールではトークンパスを使用できません' };
  }
  return { ok: true, pass: sanitizePass(pass) };
}

interface MockTokenRecord extends TokenPass {
  token_hash: string;
}

function findMockPassByHash(plain: string): MockTokenRecord | undefined {
  const hash = hashToken(plain);
  return (MOCK_TOKEN_PASSES as MockTokenRecord[]).find((p) => p.token_hash === hash);
}

function verifyMock(plain: string, userRole?: UserRole): TokenPassVerifyResult {
  const pass = findMockPassByHash(plain);
  if (!pass) {
    if (plain.trim().toUpperCase() === DEMO_TOKEN_PASS_CODE) {
      const demo = findMockPassByHash(DEMO_TOKEN_PASS_CODE);
      if (demo) return validatePass(demo, userRole);
    }
    return { ok: false, error: 'トークンパスが無効です' };
  }
  return validatePass(pass, userRole);
}

async function incrementUsage(passId: string, currentCount: number) {
  if (!isSupabaseAdminConfigured()) return;
  const admin = createAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  await admin
    .from('token_passes')
    .update({ used_count: currentCount + 1, last_used_at: now })
    .eq('id', passId);
}

export async function verifyTokenPass(
  plain: string,
  companyId?: string,
  userRole?: UserRole
): Promise<TokenPassVerifyResult> {
  if (!plain?.trim()) {
    return { ok: false, error: 'トークンコードを入力してください' };
  }

  if (!isSupabaseConfigured()) {
    const result = verifyMock(plain, userRole);
    if (result.ok && result.pass && companyId && result.pass.company_id !== companyId) {
      return { ok: false, error: '他社のトークンパスです' };
    }
    return result;
  }

  const supabase = createServerClient();
  if (!supabase) {
    return verifyMock(plain, userRole);
  }

  const tokenHash = hashToken(plain);
  let query = supabase.from('token_passes').select('*').eq('token_hash', tokenHash);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    // レガシー平文 code 列フォールバック（移行期間）
    const legacy = await supabase
      .from('token_passes')
      .select('*')
      .eq('code', plain.trim().toUpperCase())
      .maybeSingle();
    if (!legacy.data) {
      return { ok: false, error: 'トークンパスが無効です' };
    }
    const legacyRow = legacy.data as Record<string, unknown>;
    if (!tokensMatch(plain, String(legacyRow.token_hash ?? '')) && legacyRow.code) {
      // code 列のみの旧データ
    }
    const result = validatePass(mapTokenRow(legacyRow), userRole);
    if (result.ok && result.pass) {
      await incrementUsage(result.pass.id, result.pass.used_count);
      result.pass = { ...result.pass, used_count: result.pass.used_count + 1 };
    }
    return result;
  }

  const result = validatePass(mapTokenRow(data as Record<string, unknown>), userRole);
  if (result.ok && result.pass) {
    await incrementUsage(result.pass.id, result.pass.used_count);
    result.pass = { ...result.pass, used_count: result.pass.used_count + 1 };
  }
  return result;
}
