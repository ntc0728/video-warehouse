import { useEffect } from 'react';
import { useIPTVStore } from '@/stores';

/**
 * IPTV 自动刷新 hook
 * 当 autoRefresh 开启时，按 refreshIntervalHours 间隔自动刷新频道列表
 * 依赖 useIPTVStore 中的 settings.autoRefresh、settings.refreshIntervalHours 和 lastRefresh
 */
export function useIPTVAutoRefresh() {
  const autoRefresh = useIPTVStore((s) => s.settings.autoRefresh);
  const refreshIntervalHours = useIPTVStore((s) => s.settings.refreshIntervalHours);

  useEffect(() => {
    if (!autoRefresh || refreshIntervalHours <= 0) return;

    const intervalMs = refreshIntervalHours * 60 * 60 * 1000;

    const checkAndRefresh = () => {
      const { lastRefresh, isLoading } = useIPTVStore.getState();
      if (isLoading) return;

      if (!lastRefresh || Date.now() - lastRefresh >= intervalMs) {
        useIPTVStore.getState().refreshChannels();
      }
    };

    checkAndRefresh();

    const checkInterval = Math.min(intervalMs, 5 * 60 * 1000);
    const intervalId = setInterval(checkAndRefresh, checkInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshIntervalHours]);
}
