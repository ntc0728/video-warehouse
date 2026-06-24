// 路由配置文件，定义应用所有页面路由和布局结构
// 优化：所有页面级组件使用 React.lazy 按需加载，减小首屏主 bundle
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AppLoading } from './components/common';
import { isNativePlatform } from '@/lib/platform';

// 路由懒加载时的 Loading 组件（全屏模式，防止白屏透出页面背景）
function LoadingFallback() {
  return <AppLoading />;
}

// ===== 路由级代码分割：每个页面独立 chunk =====
// 切换页面时只下载目标页面 chunk + 首次访问的依赖

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

const HomeRoute = lazyWithRetry(() => import('./pages/Home/HomeRoute'));
const DetailPage = lazyWithRetry(() => import('./pages/Detail'));
const PlayerPage = lazyWithRetry(() => import('./pages/Player'));
const SettingsPage = lazyWithRetry(() => import('./pages/Settings'));
const CollectionsPage = lazyWithRetry(() => import('./pages/Collections'));
const HistoryPage = lazyWithRetry(() => import('./pages/History'));
const IPTVPage = lazyWithRetry(() => import('./pages/IPTV'));
const IPTVPlayerPage = lazyWithRetry(() => import('./pages/IPTV/IPTVPlayer'));
const SourceCheckerPage = lazyWithRetry(() => import('./pages/SourceChecker'));
const BrowsePage = lazyWithRetry(() => import('./pages/Browse'));

/** Suspense 包装：统一处理 lazy 组件的加载状态 */
// React.lazy 返回的 LazyExoticComponent 内部类型是 ComponentType<any>，
// 显式 any 在 React 类型定义中已不可避免，这里用 eslint-disable 抑制
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withSuspense(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  // 显式接收 props，保证路由参数（params/search）正确传递
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => (
    <Suspense fallback={<LoadingFallback />}>
      <Component {...props} />
    </Suspense>
  );
}

const LazyHomeRoute = withSuspense(HomeRoute);
const LazyDetailPage = withSuspense(DetailPage);
const LazyPlayerPage = withSuspense(PlayerPage);
const LazySettingsPage = withSuspense(SettingsPage);
const LazyCollectionsPage = withSuspense(CollectionsPage);
const LazyHistoryPage = withSuspense(HistoryPage);
const LazyIPTVPage = withSuspense(IPTVPage);
const LazyIPTVPlayerPage = withSuspense(IPTVPlayerPage);
const LazySourceCheckerPage = withSuspense(SourceCheckerPage);
const LazyBrowsePage = withSuspense(BrowsePage);

const routes = [
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <LazyHomeRoute />,
      },
      {
        // 影视详情页
        path: 'detail/:id',
        element: <LazyDetailPage />,
      },
      {
        // 视频播放页（无指定集数）
        path: 'play/:id',
        element: <LazyPlayerPage />,
      },
      {
        // 视频播放页（指定集数）
        path: 'play/:id/:episodeId',
        element: <LazyPlayerPage />,
      },
      {
        // 设置页
        path: 'settings',
        element: <LazySettingsPage />,
      },
      {
        // 收藏页
        path: 'collections',
        element: <LazyCollectionsPage />,
      },
      {
        // 历史记录页
        path: 'history',
        element: <LazyHistoryPage />,
      },
      {
        // IPTV 频道列表页（仍走 AppLayout）
        path: 'iptv',
        element: <LazyIPTVPage />,
      },
      {
        path: 'player/:id',
        element: <LazyPlayerPage />,
      },
      {
        path: 'source-checker',
        element: <LazySourceCheckerPage />,
      },
      {
        // 筛选页（独立路由：从首页分类卡片跳转进入）
        path: 'browse',
        element: <LazyBrowsePage />,
      },
    ],
  },
  {
    // IPTV 播放页（顶层独立路由，不走 AppLayout）
    // 设计原因：IPTV 播放本质是"独立全屏应用"，需要占据整个浏览器视口。
    // 走 AppLayout 会被 StickyHeader / CustomScrollbar / TabBar 挤占视口，
    // 且嵌套 overflow + flex 100% 继承链不稳定。独立路由 + fixed 定位
    // 可根本性解决滚动条 / 高度坍缩问题。
    path: '/iptv/play',
    element: <LazyIPTVPlayerPage />,
  },
];

// Capacitor 原生平台使用 HashRouter（兼容 file:// 协议和本地资源加载）
// Web 端使用 BrowserRouter（URL 更干净）
const router = isNativePlatform()
  ? createHashRouter(routes)
  : createBrowserRouter(routes);

export default function Routes() {
  return <RouterProvider router={router} />;
}
