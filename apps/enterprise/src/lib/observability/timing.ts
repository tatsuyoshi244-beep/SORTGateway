export interface TimingRecord {
  name: string;
  duration_ms: number;
  at: string;
  slow: boolean;
}

const SLOW_THRESHOLD_MS = 500;
const timingBuffer: TimingRecord[] = [];
const MAX_TIMING = 100;

export function recordTiming(name: string, durationMs: number, thresholdMs = SLOW_THRESHOLD_MS): void {
  const slow = durationMs >= thresholdMs;
  const entry: TimingRecord = {
    name,
    duration_ms: Math.round(durationMs * 100) / 100,
    at: new Date().toISOString(),
    slow,
  };
  timingBuffer.unshift(entry);
  if (timingBuffer.length > MAX_TIMING) timingBuffer.length = MAX_TIMING;
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  thresholdMs = SLOW_THRESHOLD_MS
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordTiming(name, performance.now() - start, thresholdMs);
  }
}

export function getTimingStats(): {
  records: TimingRecord[];
  slow_count: number;
  avg_ms: number;
} {
  const records = timingBuffer.slice(0, 50);
  const slow = records.filter((r) => r.slow);
  const avg =
    records.length > 0
      ? records.reduce((s, r) => s + r.duration_ms, 0) / records.length
      : 0;
  return {
    records,
    slow_count: slow.length,
    avg_ms: Math.round(avg * 100) / 100,
  };
}

export function getSlowQueries(limit = 20): TimingRecord[] {
  return timingBuffer.filter((r) => r.slow).slice(0, limit);
}

export function resetTimings(): void {
  timingBuffer.length = 0;
}
