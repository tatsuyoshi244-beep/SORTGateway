import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { InformationClassification, TokenPass, UserRole } from '@/types';
import { isProduction } from '@/lib/env';

const PREFIX = 'SGD1';

interface DemoTokenPayload {
  v: 1;
  id: string;
  c: string;
  u: string;
  by: string;
  l: string;
  s: InformationClassification[];
  r: UserRole[];
  exp: number;
  max: number | null;
  iat: number;
}

function secret(): string | null {
  const configured = process.env.TOKEN_PASS_GRANT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  return isProduction() ? null : 'sort-gateway-public-demo-token-grant';
}

function sign(encoded: string, signingSecret: string): string {
  return createHmac('sha256', signingSecret).update(`${PREFIX}.${encoded}`).digest('base64url');
}

function safeSignatureMatches(expected: string, supplied: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function payloadToPass(payload: DemoTokenPayload): TokenPass {
  return {
    id: payload.id,
    company_id: payload.c,
    label: payload.l,
    classification_scope: payload.s,
    allowed_roles: payload.r,
    issued_to: payload.u,
    created_by: payload.by,
    expires_at: new Date(payload.exp).toISOString(),
    is_active: true,
    used_count: 0,
    max_uses: payload.max,
    revoked_at: null,
    last_used_at: null,
    created_at: new Date(payload.iat).toISOString(),
  };
}

export function issueDemoTokenPass(input: {
  companyId: string;
  issuedTo: string;
  createdBy: string;
  label: string;
  scopes: InformationClassification[];
  allowedRoles: UserRole[];
  expiresAt: string;
  maxUses: number | null;
}): { code: string; pass: TokenPass } | null {
  const signingSecret = secret();
  if (!signingSecret) return null;
  const now = Date.now();
  const payload: DemoTokenPayload = {
    v: 1,
    id: `demo-${randomUUID()}`,
    c: input.companyId,
    u: input.issuedTo,
    by: input.createdBy,
    l: input.label,
    s: input.scopes,
    r: input.allowedRoles,
    exp: new Date(input.expiresAt).getTime(),
    max: input.maxUses,
    iat: now,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return {
    code: `${PREFIX}.${encoded}.${sign(encoded, signingSecret)}`,
    pass: payloadToPass(payload),
  };
}

export function verifyDemoTokenPass(code: string): TokenPass | null {
  const signingSecret = secret();
  if (!signingSecret || !code.startsWith(`${PREFIX}.`)) return null;
  const [prefix, encoded, supplied] = code.split('.');
  if (prefix !== PREFIX || !encoded || !supplied) return null;
  if (!safeSignatureMatches(sign(encoded, signingSecret), supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DemoTokenPayload;
    if (
      payload.v !== 1 ||
      !payload.id ||
      !payload.c ||
      !payload.u ||
      !payload.l ||
      !Array.isArray(payload.s) ||
      !Array.isArray(payload.r) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now()
    ) {
      return null;
    }
    return payloadToPass(payload);
  } catch {
    return null;
  }
}
