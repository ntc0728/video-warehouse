import { useCallback, useRef, useEffect } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (..._args: any[]) => void;

/**
 * 基于 requestAnimationFrame 的节流 Hook
 * 适用于 scroll/resize/mousemove 等高频事件
 * 返回的函数引用稳定，适合传给 addEventListener
 */
export function useThrottle<T extends AnyFunction>(callback: T): T {
  const callbackRef = useRef(callback);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttled = useCallback((...args: Parameters<T>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      callbackRef.current(...args);
      rafRef.current = 0;
    });
  }, []) as T;

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return throttled;
}
