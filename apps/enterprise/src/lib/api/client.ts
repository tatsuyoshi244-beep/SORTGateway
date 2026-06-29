'use client';

import { encodeSessionHeader, SESSION_HEADER } from '@/lib/api/auth-guard';
import { allowsDemoAuth, isProduction, isSupabaseConfigured } from '@/lib/env';
import { createBrowserClient } from '@/lib/supabase/client';
import type { SessionUser } from '@/types';

async function applyAuthHeaders(headers: Headers, user: SessionUser | null): Promise<void> {
  if (isProduction() || isSupabaseConfigured()) {
    const client = createBrowserClient();
    const { data } = (await client?.auth.getSession()) ?? { data: null };
    const token = data?.session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
      return;
    }
    if (isProduction()) return;
  }

  if (user && allowsDemoAuth()) {
    headers.set(SESSION_HEADER, encodeSessionHeader(user));
  }
}

export async function apiHeaders(user: SessionUser | null): Promise<HeadersInit> {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  await applyAuthHeaders(headers, user);
  return headers;
}

export async function apiFetch(
  user: SessionUser | null,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  await applyAuthHeaders(headers, user);
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}
