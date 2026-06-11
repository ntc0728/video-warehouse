// 数据请求 Hook，支持自动重试和指数退避策略
import { useState, useCallback } from 'react';

interface UseFetchOptions<T = unknown> extends RequestInit {
  retries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
}

interface UseFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  retryCount: number;
  execute: () => Promise<T | null>;
  reset: () => void;
}

export function useFetch<T = unknown>(
  url: string,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    retries = 2,
    retryDelay = 1000,
    onRetry,
    onError,
    onSuccess,
    ...fetchOptions
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // 执行请求，失败时按指数退避策略自动重试
  const execute = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result === null || (typeof result === 'object' && !Array.isArray(result) && Object.keys(result).length === 0)) {
          setData(null);
          setLoading(false);
          return null;
        }

        setData(result);
        setLoading(false);
        setRetryCount(attempt);
        onSuccess?.(result);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retries) {
          setRetryCount(attempt + 1);
          onRetry?.(attempt + 1, lastError);
          // 指数退避：每次重试延迟翻倍
          await delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // 所有重试均失败
    setError(lastError!);
    setLoading(false);
    onError?.(lastError!);
    return null;
  }, [url, retries, retryDelay, onRetry, onError, onSuccess, fetchOptions]);

  // 重置所有状态
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    setRetryCount(0);
  }, []);

  return {
    data,
    loading,
    error,
    retryCount,
    execute,
    reset,
  };
}

// 带默认重试配置的请求 Hook
export function useRetryFetch<T = unknown>(
  url: string,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  return useFetch<T>(url, {
    retries: 2,
    retryDelay: 1000,
    ...options,
  });
}

export default useFetch;
