/**
 * 認証情報の暗号化（スタブ）
 * 本番では KMS / AES-256-GCM 等に差し替え
 */

const PREFIX = 'enc:v1:';

export function encryptCredentials(plain: string): string {
  if (!plain) return '';
  return PREFIX + Buffer.from(plain, 'utf8').toString('base64url');
}

export function decryptCredentials(encrypted: string | null | undefined): string {
  if (!encrypted) return '';
  if (!encrypted.startsWith(PREFIX)) return encrypted;
  return Buffer.from(encrypted.slice(PREFIX.length), 'base64url').toString('utf8');
}

/** UI 表示用 — 平文は絶対に返さない */
export function maskCredentials(): string {
  return '••••••••（暗号化保存済み）';
}
