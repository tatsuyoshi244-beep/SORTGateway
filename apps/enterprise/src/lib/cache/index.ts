import { MemoryCache } from './memory-cache';

export interface CacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

let cacheInstance: CacheAdapter | null = null;

export function getCache(): CacheAdapter {
  if (!cacheInstance) cacheInstance = new MemoryCache();
  return cacheInstance;
}

/** テスト用 */
export function resetCache(): void {
  cacheInstance = new MemoryCache();
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const cache = getCache();
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await factory();
  await cache.set(key, value, ttlMs);
  return value;
}

export { MemoryCache };
