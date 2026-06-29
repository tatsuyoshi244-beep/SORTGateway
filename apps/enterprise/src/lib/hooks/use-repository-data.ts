'use client';

import { useEffect, useState } from 'react';
import type { DataSource, FetchResult } from '@/lib/repositories';

export function useRepositoryData<T>(
  key: string,
  fetcher: () => Promise<FetchResult<T>>,
  initial: T
) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<DataSource>('mock');

  const reload = async () => {
    setLoading(true);
    try {
      const result = await fetcher();
      setData(result.data);
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
          setData(result.data);
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

  return { data, loading, source, reload, setData };
}
