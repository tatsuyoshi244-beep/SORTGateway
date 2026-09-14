'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { DataSource, FetchResult } from '@/lib/repositories';

export function useRepositoryData<T>(
  key: string,
  fetcher: () => Promise<FetchResult<T>>,
  initial: T,
  options?: { persistMock?: boolean }
) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<DataSource>('mock');

  const readPersistedMock = (fallback: T): T => {
    if (!options?.persistMock || typeof window === 'undefined') return fallback;
    try {
      const value = window.localStorage.getItem(`sort-gateway-demo:${key}`);
      return value ? (JSON.parse(value) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const updateData: Dispatch<SetStateAction<T>> = (nextValue) => {
    setData((previous) => {
      const next = typeof nextValue === 'function'
        ? (nextValue as (value: T) => T)(previous)
        : nextValue;
      if (options?.persistMock && source === 'mock' && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`sort-gateway-demo:${key}`, JSON.stringify(next));
        } catch {
          // Storage may be unavailable in private mode; keep the in-memory state usable.
        }
      }
      return next;
    });
  };

  const reload = async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result.source === 'mock' ? readPersistedMock(result.data) : result.data);
      setSource(result.source);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetcher();
        if (!cancelled) {
          setData(result.source === 'mock' ? readPersistedMock(result.data) : result.data);
          setSource(result.source);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key で再取得を制御
  }, [key]);

  return { data, loading, source, reload, setData: updateData };
}
