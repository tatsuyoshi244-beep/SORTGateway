import type { IntegrationSyncFrequency } from '@/types';

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
const MS_WEEK = 7 * MS_DAY;

export const SYNC_FREQUENCY_LABELS: Record<IntegrationSyncFrequency, string> = {
  manual: '手動のみ',
  hourly: '1時間ごと',
  daily: '1日ごと',
  weekly: '1週間ごと',
};

/** 次回同期時刻を計算。manual の場合は null */
export function computeNextSyncAt(
  frequency: IntegrationSyncFrequency,
  from: Date = new Date()
): string | null {
  if (frequency === 'manual') return null;

  const next = new Date(from);
  switch (frequency) {
    case 'hourly':
      next.setTime(next.getTime() + MS_HOUR);
      break;
    case 'daily':
      next.setTime(next.getTime() + MS_DAY);
      break;
    case 'weekly':
      next.setTime(next.getTime() + MS_WEEK);
      break;
  }
  return next.toISOString();
}

export function syncDurationMs(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

export function formatSyncDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}分${rem}秒` : `${min}分`;
}
