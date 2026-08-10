// 应用入口文件，挂载 React 根组件并初始化路由
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './assets/styles/index.css';
import { adjustFontSizeForNative } from './lib/platform';
import { preventPinchZoom } from './lib/preventZoom';
import { preloadInitialRoute, preloadAllRoutes } from './components/Layout/routeConfig';
import { useSourceManagerStore } from './stores/useSourceManagerStore';

// Android 原生平台：缩小字体和图标以适配 dp 单位
adjustFontSizeForNative();
// 移动端阻止双指缩放
preventPinchZoom();

// 预拉并 await「当前路由」chunk 再首屏渲染：lazyWithRetry 缓存了 load Promise
// （preload 与 React.lazy 共用同一实例），await 后该 Promise 已 resolved，
// 首屏 Suspense 直接同步渲染、绝不闪 fallback，从而彻底消除
// 「Suspense fallback（chunk 加载中）→ 页面自身 loading」的双重 AppLoading
// （冷刷新 chunk 需重新 fetch/eval，与 SPA 二次进入 warm 均成立）。
//
// 8.3A（2026-08-04）：在此同时启动 preloadAllRoutes() 预加载全部路由 chunk，
// 让「冷启动后立即导航到未访问页面」也能命中 chunk 缓存（原逻辑等 AppLayout
// 挂载后才预加载，存在「立即导航 → Suspense fallback + 页面 loading」两次
// AppLoading 的窗口期）。preloadStarted 幂等，AppLayout 挂载后的重复调用会跳过。
// 注意：import() 只加载并求值模块，不挂载、不触发数据请求，无副作用。
//
// 8.3B（2026-08-10）：dev 模式跳过 preloadAllRoutes()——dev 下 import() 会触发
// Vite 逐模块 transform（TS→JS + 依赖图解析 + HMR 注入），12 个路由的依赖合计
// 248 个模块全部编译会阻塞主线程 ~5s 白屏。production 无编译步骤（Rollup 已打包
// 成 ~12 个 chunk，import() 仅 fetch+eval），保留以消除后续导航的双重 AppLoading。
if (!import.meta.env.DEV) {
  preloadAllRoutes();
}
// 应用启动即初始化源管理（注入默认源 + 同步消费 indices/aggregatorUrls）。
// 不阻塞首屏（异步 + 模块级 guard 幂等）；保证「直接进入 IPTV 页」时
// aggregatorUrls 与源管理真实启用状态一致，而非只依赖设置页 tab 挂载。
useSourceManagerStore.getState().bootstrap();
preloadInitialRoute().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <Routes />
    </ErrorBoundary>
  );
});