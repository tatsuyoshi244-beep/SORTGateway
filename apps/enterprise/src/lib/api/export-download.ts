'use client';

import type { SessionUser } from '@/types';
import { apiFetch } from '@/lib/api/client';

export async function downloadCsvExport(
  user: SessionUser,
  path: string,
  filename: string
): Promise<void> {
  const res = await apiFetch(user, path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: { message?: string } }).error?.message ?? 'エクスポートに失敗しました');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
