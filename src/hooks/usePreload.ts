// 预加载、交叉观察相关 Hook
import { useEffect, useRef, useCallback } from 'react';

interface UsePreloadOptions {
  enabled?: boolean;
}

// 数据预加载 Hook，在当前项变化时自动预加载下一项数据
export function usePreload<T>(
  items: T[],
  currentIndex: number,
  onPreload: (nextIndex: number) => void,
  options: UsePreloadOptions = {}
) {
  const {
    enabled = true,
  } = options;

  // 记录已预加载的索引，避免重复加载
  const preloadedRef = useRef<Set<number>>(new Set());

  const preload = useCallback(
    (index: number) => {
      if (
        enabled &&
        index >= 0 &&
        index < items.length &&
        !preloadedRef.current.has(index)
      ) {
        preloadedRef.current.add(index);
        onPreload(index);
      }
    },
    [enabled, items.length, onPreload]
  );

  // 当前索引变化时预加载下一项
  useEffect(() => {
    if (!enabled) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < items.length) {
      preload(nextIndex);
    }
  }, [currentIndex, items.length, preload, enabled]);

  // 滚动时也触发预加载
  useEffect(() => {
    if (!enabled) return;

    const preloadNext = () => {
      const nextIndex = currentIndex + 1;
      if (nextIndex < items.length) {
        preload(nextIndex);
      }
    };

    window.addEventListener('scroll', preloadNext, { passive: true });
    return () => window.removeEventListener('scroll', preloadNext);
  }, [currentIndex, items.length, preload, enabled]);

  // 重置预加载记录，用于数据源切换时清除缓存
  const reset = useCallback(() => {
    preloadedRef.current.clear();
  }, []);

  return { reset };
}

// 交叉观察器 Hook，封装 IntersectionObserver API
export function useIntersectionObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {}
) {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!targetRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(callback);
      },
      {
        root: null,
        rootMargin: '200px', // 提前 200px 触发回调
        threshold: 0,
        ...options,
      }
    );

    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [callback, options]);

  return targetRef;
}

export default usePreload;
