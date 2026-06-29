import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchUserProfile } from '@/lib/auth/profile';
import { isSuperAdmin, resolveEffectiveCompanyId } from '@/lib/tenant/filter';
import { isProduction, isSupabaseConfigured } from '@/lib/env';
import { decodeSessionHeader } from '@/lib/api/session-codec';
import { isUserRole } from '@/lib/api/validate';
import type { SessionUser, UserRole } from '@/types';

export { encodeSessionHeader } from '@/lib/api/session-codec';

export const SESSION_HEADER = 'x-sort-session';

export interface AuthContext {
  user: SessionUser;
  companyId: string;
}

function parseSessionHeader(req: NextRequest): SessionUser | null {
  const raw = req.headers.get(SESSION_HEADER);
  if (!raw) return null;
  try {
    const decoded = decodeSessionHeader(raw);
    const parsed = JSON.parse(decoded) as SessionUser;
    if (!parsed?.id || !parsed?.role || !parsed?.company_id || !isUserRole(parsed.role)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseBodyUser(body: unknown): SessionUser | null {
  if (!body || typeof body !== 'object') return null;
  const u = (body as { user?: SessionUser }).user;
  if (!u?.id || !u?.role || !u?.company_id || !isUserRole(u.role)) return null;
  return u;
}

async function verifyBearerToken(req: NextRequest): Promise<SessionUser | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token || !isSupabaseConfigured()) return null;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  return fetchUserProfile(admin, data.user.id, data.user.email);
}

export async function authenticateRequest(
  req: NextRequest,
  body?: unknown
): Promise<AuthContext | NextResponse> {
  if (isProduction()) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: { message: '本番環境では Supabase 設定が必須です' } },
        { status: 503 }
      );
    }

    const bearerUser = await verifyBearerToken(req);
    if (!bearerUser) {
      return NextResponse.json({ error: { message: '認証が必要です' } }, { status: 401 });
    }

    return {
      user: bearerUser,
      companyId: resolveEffectiveCompanyId(bearerUser),
    };
  }

  const user =
    (await verifyBearerToken(req)) ??
    parseSessionHeader(req) ??
    (body ? parseBodyUser(body) : null);

  if (!user) {
    return NextResponse.json({ error: { message: '認証が必要です' } }, { status: 401 });
  }

  return {
    user,
    companyId: resolveEffectiveCompanyId(user),
  };
}

export function requireRoles(
  auth: AuthContext,
  allowed: UserRole[]
): NextResponse | null {
  if (!allowed.includes(auth.user.role)) {
    return NextResponse.json({ error: { message: '権限がありません' } }, { status: 403 });
  }
  return null;
}

export function requireSuperAdmin(auth: AuthContext): NextResponse | null {
  if (!isSuperAdmin(auth.user.role)) {
    return NextResponse.json({ error: { message: 'SORT運営権限が必要です' } }, { status: 403 });
  }
  return null;
}

export function requireManagerOrAbove(auth: AuthContext): NextResponse | null {
  const ok = ['manager', 'executive', 'admin', 'super_admin'].includes(auth.user.role);
  if (!ok) {
    return NextResponse.json({ error: { message: '責任者以上の権限が必要です' } }, { status: 403 });
  }
  return null;
}

export function requireAdmin(auth: AuthContext): NextResponse | null {
  if (!['admin', 'super_admin'].includes(auth.user.role)) {
    return NextResponse.json({ error: { message: '管理者権限が必要です' } }, { status: 403 });
  }
  return null;
}

/** リソースの company_id が操作テナントと一致するか */
export function assertCompanyScope(
  auth: AuthContext,
  resourceCompanyId: string | null | undefined
): NextResponse | null {
  if (!resourceCompanyId) {
    return NextResponse.json({ error: { message: 'リソースが見つかりません' } }, { status: 404 });
  }
  if (resourceCompanyId !== auth.companyId) {
    return NextResponse.json({ error: { message: '他社データにはアクセスできません' } }, { status: 403 });
  }
  return null;
}

