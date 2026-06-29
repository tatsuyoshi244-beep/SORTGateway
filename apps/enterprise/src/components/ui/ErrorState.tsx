import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'エラーが発生しました',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 px-6 py-12 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
      <h3 className="text-base font-semibold text-red-800">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          再試行
        </Button>
      )}
    </div>
  );
}
