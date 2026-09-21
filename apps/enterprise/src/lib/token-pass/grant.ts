import { createHmac, timingSafeEqual } from 'crypto';
import type { TokenPass } from '@/types';
import { isProduction } from '@/lib/env';

interface TokenPassGrantPayload {
  passId: string;
  userId: string;
  companyId: string;
  expiresAt: number;
}

function signingSecret(): string | null {
  const configured = process.env.TOKEN_PASS_GRANT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  return isProduction() ? null : 'sort-gateway-public-demo-token-grant';
}

function signature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueTokenPassGrant(
  pass: TokenPass,
  userId: string,
  companyId: string
): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const passExpiry = new Date(pass.expires_at).getTime();
  const sessionExpiry = Date.now() + 15 * 60 * 1000;
  const payload: TokenPassGrantPayload = {
    passId: pass.id,
    userId,
    companyId,
    expiresAt: Math.min(passExpiry, sessionExpiry),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyTokenPassGrant(
  grant: string | null | undefined,
  userId: string,
  companyId: string
): boolean {
  const secret = signingSecret();
  if (!secret || !grant) return false;
  const [encoded, suppliedSignature] = grant.split('.');
  if (!encoded || !suppliedSignature) return false;
  const expectedSignature = signature(encoded, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPassGrantPayload;
    return (
      payload.userId === userId &&
      payload.companyId === companyId &&
      payload.expiresAt > Date.now()
    );
  } catch {
    return false;
  }
}
