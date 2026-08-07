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

/** 带 preload 能力的懒加载组件：可在空闲时提前拉取 chunk */
type PreloadableLazy = LazyComponent & { preload: () => Promise<unknown> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>): PreloadableLazy {
  // 缓存 load 返回的 Promise：preload（main.tsx 首屏前预拉）与 React.lazy（渲染时）共用
  // 同一个 Promise。这样 main.tsx 在 render 前 await 该 Promise 后，React.lazy 拿到的是
  // 已 resolved 的同一实例 → Suspense 直接同步渲染，绝不闪 fallback（消除首屏双重 AppLoading）。
  // 若不缓存，React.lazy 会另起一个全新 pending Promise，await 也救不了首屏 fallback。
  let loadPromise: Promise<{ default: React.ComponentType<any> }> | null = null;
  const load = () => {
    if (!loadPromise) {
      loadPromise = factory().catch((err: Error) => {
        console.error('[RouteChunk] failed to load, retrying:', err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new Promise<{ default: React.ComponentType<any> }>((resolve) => {
          setTimeout(() => {
            // 重试时重置缓存，让后续 load() 复用重试后的 Promise
            loadPromise = factory();
            resolve(loadPromise);
          }, 800);
        });
      });
    }
    return loadPromise;
  };
  const Component = lazy(load) as PreloadableLazy;
  Component.preload = load;
  return Component;
}

/** 路径模式 → 懒加载组件 */
const routeComponentMap: Record<string, PreloadableLazy> = {
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
  '/proxy-setup': lazyWithRetry(() => import('@/pages/ProxySetup/ProxySetup')),
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
 * 预加载所有路由 chunk（应在应用空闲时调用一次）。
 *
 * 目的：提前把各页面的 JS chunk 拉入缓存。这样路由切换到「未访问过」的页面时，
 * Suspense 能立即解析（chunk 已缓存），不再出现
 * 「Suspense fallback（chunk 加载中）→ 页面自身 loading」的双重 AppLoading 闪烁。
 *
 * 注意：import() 只加载并求值模块（定义组件），不会挂载/渲染，也不触发数据请求，
 * 因此没有副作用；真正的数据拉取仍发生在页面被导航挂载时。
 */
let preloadStarted = false;
export function preloadAllRoutes(): void {
  if (preloadStarted) return;
  preloadStarted = true;
  for (const comp of Object.values(routeComponentMap)) {
    // 预加载失败静默处理：真正导航到该页面时 lazyWithRetry 会自动重试
    comp.preload().catch(() => { /* ignore */ });
  }
}

/**
 * 预加载「当前 URL 对应」的路由 chunk，并返回该 Promise。
 *
 * 与 preloadAllRoutes 互补：preloadAllRoutes 负责在空闲时预拉「其他」页面 chunk；
 * 本函数在首屏渲染前就先把「当前正在进入」的页面 chunk 拉起来，
 * 并让 main.tsx 在 render 前 await 它——由于 lazyWithRetry 缓存了 load Promise、
 * preload 与 React.lazy 共用同一实例，await 后该 Promise 已 resolved，
 * 首屏 Suspense 直接同步渲染，**彻底消除**「Suspense fallback → 页面自身 loading」的双重 AppLoading
 * （无论是 SPA 二次进入的 warm，还是硬刷新的 cold 场景都成立）。
 * 注意：import() 只加载并求值模块，不挂载、不触发数据请求，无副作用。
 */
export function preloadInitialRoute(): Promise<void> {
  const key = matchRoute(window.location.pathname);
  const p = key ? routeComponentMap[key]?.preload?.() : undefined;
  return (p ?? Promise.resolve()) as Promise<void>;
}

export { routeComponentMap };
