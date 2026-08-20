import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useIPTVStore } from '@/stores/useIPTVStore';

/**
 * IPTV 自动刷新 hook
 * 当 autoRefresh 开启时，按 refreshIntervalHours 间隔自动刷新频道列表
 * 依赖 useIPTVStore 中的 settings.autoRefresh、settings.refreshIntervalHours 和 lastRefresh
 * Keep-Alive 下页面不卸载：仅在 /iptv 路由激活时注册轮询，离开即清理，避免隐藏页后台拉取
 */
export function useIPTVAutoRefresh() {
  const location = useLocation();
  const autoRefresh = useIPTVStore((s) => s.settings.autoRefresh);
  const refreshIntervalHours = useIPTVStore((s) => s.settings.refreshIntervalHours);

  useEffect(() => {
    if (!autoRefresh || refreshIntervalHours <= 0) return;
    // 非 IPTV 页激活时不轮询（Keep-Alive 下组件保持挂载，路由变化由依赖触发本 effect 重建）
    if (location.pathname !== '/iptv') return;

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
  }, [autoRefresh, refreshIntervalHours, location.pathname]);
}
