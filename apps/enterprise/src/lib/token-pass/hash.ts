import { createHash, randomBytes } from 'crypto';

/** 平文トークンを SHA-256 ハッシュ（DB 保存用） */
export function hashToken(plain: string): string {
  const normalized = plain.trim().toUpperCase();
  return createHash('sha256').update(normalized).digest('hex');
}

/** 新規発行用の平文トークン（表示は1回のみ） */
export function generatePlainToken(): string {
  const segment = randomBytes(4).toString('hex').toUpperCase();
  const year = new Date().getFullYear();
  return `TKN-${year}-${segment}`;
}

export function tokensMatch(plain: string, storedHash: string): boolean {
  if (!plain?.trim() || !storedHash) return false;
  return hashToken(plain) === storedHash;
}
