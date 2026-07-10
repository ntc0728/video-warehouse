/**
 * usePrefetch — 应用启动时预取首页数据
 *
 * 解决的问题:
 * 1. 用户首次打开应用时,HomePage 内的"无数据 → 拉取 → 有数据"渲染序列
 *    会让用户感知到"页面闪一下"。
 * 2. HomePage 之前在 mount 时无条件调 fetchAllHomeData(包含 checkToken + 8 个 TMDB 请求),
 *    即便 store 已有缓存,checkToken 这一步仍会跑。
 *
 * 此 hook:
 * - 仅在「数据为空」时触发,避免重复拉取;
 * - 用 requestIdleCallback 调度,不阻塞首屏;
 * - 失败静默,错误已在 store 中记录,UI 后续自行展示。
 *
 * 注意: IPTV 数据不再在此预取,改由 IPTVPage 进入时自行加载(loadFromCache + useIPTVAutoRefresh)。
 */
import { useEffect } from 'react';
import { useTMDBStore } from '@/stores';

/** 应用启动时预取首页数据，避免首次加载闪白 */
export function usePrefetch(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const idle =
      typeof window.requestIdleCallback === 'function'
        ? (cb: () => void) => window.requestIdleCallback(cb)
        : (cb: () => void) => setTimeout(cb, 0);

    const tasks: Array<() => void> = [];

    // 首页 TMDB 数据
    const tmdb = useTMDBStore.getState();
    const hasHomeData = tmdb.trending.length > 0 || tmdb.popularMovies.length > 0;
    if (!hasHomeData && typeof tmdb.fetchAllHomeData === 'function') {
      tasks.push(() => {
        void tmdb.fetchAllHomeData();
      });
    }

    if (tasks.length === 0) return;

    const handle = idle(() => {
      for (const t of tasks) t();
    });

    return () => {
      if (typeof window.cancelIdleCallback === 'function' && typeof handle === 'number') {
        window.cancelIdleCallback(handle);
      }
    };
  }, []);
}
