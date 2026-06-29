'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = error?.message ?? '不明なエラー';
  return (
    <html lang="ja">
      <body className="flex min-h-screen items-center justify-center bg-slate-100 font-sans">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">システムエラー</h1>
          <p className="mt-2 text-sm text-slate-600">
            アプリケーションで予期しないエラーが発生しました。
          </p>
          <p className="mt-1 text-xs text-slate-400">{message}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-6 rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-900"
          >
            再試行
          </button>
        </div>
      </body>
    </html>
  );
}
