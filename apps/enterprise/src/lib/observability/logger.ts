type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

const MAX_BUFFER = 200;
const logBuffer: LogEntry[] = [];

function push(entry: LogEntry): void {
  logBuffer.unshift(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.length = MAX_BUFFER;

  const line = `[${entry.level.toUpperCase()}] ${entry.context}: ${entry.message}`;
  if (entry.level === 'error') console.error(line, entry.meta ?? '');
  else if (entry.level === 'warn') console.warn(line, entry.meta ?? '');
  else console.info(line, entry.meta ?? '');
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>): void {
  push({ level: 'info', context, message, timestamp: new Date().toISOString(), meta });
}

export function logWarn(context: string, message: string, meta?: Record<string, unknown>): void {
  push({ level: 'warn', context, message, timestamp: new Date().toISOString(), meta });
}

export function logError(context: string, err: unknown, meta?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  push({
    level: 'error',
    context,
    message,
    timestamp: new Date().toISOString(),
    meta: { ...meta, stack },
  });
}

export function getRecentLogs(limit = 50): LogEntry[] {
  return logBuffer.slice(0, limit);
}

export type { LogEntry };
