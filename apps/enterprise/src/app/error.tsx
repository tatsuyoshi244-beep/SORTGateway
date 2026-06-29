'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600">エラー</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">問題が発生しました</h1>
        <p className="mt-3 text-sm text-slate-600">
          一時的な障害の可能性があります。ページを再読み込みするか、しばらくしてから再度お試しください。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => reset()}>再試行</Button>
          <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
            ダッシュボードへ
          </Button>
        </div>
      </div>
    </div>
  );
}
