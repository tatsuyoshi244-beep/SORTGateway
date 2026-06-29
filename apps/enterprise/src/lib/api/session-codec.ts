import type { SessionUser } from '@/types';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Browser-safe session header encoding (Node base64url is unavailable in many client bundles). */
export function encodeSessionHeader(user: SessionUser): string {
  const json = JSON.stringify(user);
  if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(json, 'utf8').toString('base64url');
    } catch {
      // Fall through to browser-safe encoding.
    }
  }
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/** Decode session header (API routes / server only). */
export function decodeSessionHeader(raw: string): string {
  if (typeof Buffer !== 'undefined') {
    try {
      return Buffer.from(raw, 'base64url').toString('utf8');
    } catch {
      // Fall through to browser-safe decoding.
    }
  }
  return new TextDecoder().decode(base64UrlToBytes(raw));
}
