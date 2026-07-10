/**
 * 路由配置 — 路径模式 → 懒加载组件的映射
 *
 * 用于 AppLayout 的 Keep-Alive 容器：根据当前路径匹配对应的页面组件，
 * 保持所有已访问页面挂载，仅切换 CSS 可见性。
 *
 * 注意：/iptv/play 是独立顶层路由，不走 AppLayout，不在此配置中。
 */
import { lazy } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LazyComponent = React.LazyExoticComponent<React.ComponentType<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err: Error) => {
      console.error('[RouteChunk] failed to load, retrying:', err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Promise<{ default: React.ComponentType<any> }>((resolve) => {
        setTimeout(() => resolve(factory()), 800);
      });
    }),
  );
}

/** 路径模式 → 懒加载组件 */
const routeComponentMap: Record<string, LazyComponent> = {
  '/': lazyWithRetry(() => import('@/pages/Home/HomeRoute')),
  '/iptv': lazyWithRetry(() => import('@/pages/IPTV')),
  '/browse': lazyWithRetry(() => import('@/pages/Browse')),
  '/settings': lazyWithRetry(() => import('@/pages/Settings')),
  '/collections': lazyWithRetry(() => import('@/pages/Collections')),
  '/history': lazyWithRetry(() => import('@/pages/History')),
  '/source-checker': lazyWithRetry(() => import('@/pages/SourceChecker')),
  '/detail': lazyWithRetry(() => import('@/pages/Detail')),
  '/play': lazyWithRetry(() => import('@/pages/Player')),
  '/player': lazyWithRetry(() => import('@/pages/Player')),
  '/person': lazyWithRetry(() => import('@/pages/Person')),
};

/** 路径前缀列表（按长度降序排列，确保最长前缀优先匹配） */
const routePrefixes = Object.keys(routeComponentMap).sort((a, b) => b.length - a.length);

/**
 * 将 URL pathname 匹配到路由模式
 * @example matchRoute('/detail/123') → '/detail'
 * @example matchRoute('/iptv') → '/iptv'
 * @example matchRoute('/') → '/'
 */
export function matchRoute(pathname: string): string | null {
  for (const prefix of routePrefixes) {
    if (prefix === '/') return '/';
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return prefix;
    }
  }
  return null;
}

/**
 * 根据路径获取对应的懒加载组件
 */
export function getRouteComponent(pathname: string): LazyComponent | null {
  const routeKey = matchRoute(pathname);
  return routeKey ? routeComponentMap[routeKey] ?? null : null;
}

export { routeComponentMap };
