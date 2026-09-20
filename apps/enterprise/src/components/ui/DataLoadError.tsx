import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface DataLoadErrorProps {
  message?: string | null;
  onRetry?: () => void;
}

export function DataLoadError({ message, onRetry }: DataLoadErrorProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{message || 'データを取得できませんでした。時間をおいて再度お試しください。'}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          再読み込み
        </Button>
      )}
    </div>
  );
}
