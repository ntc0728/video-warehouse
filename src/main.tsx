// 应用入口文件，挂载 React 根组件并初始化路由
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './assets/styles/index.css';
import { adjustFontSizeForNative } from './lib/platform';
import { preventPinchZoom } from './lib/preventZoom';
import { preloadInitialRoute } from './components/Layout/routeConfig';

// Android 原生平台：缩小字体和图标以适配 dp 单位
adjustFontSizeForNative();
// 移动端阻止双指缩放
preventPinchZoom();

// 预拉并 await「当前路由」chunk 再首屏渲染：lazyWithRetry 缓存了 load Promise
// （preload 与 React.lazy 共用同一实例），await 后该 Promise 已 resolved，
// 首屏 Suspense 直接同步渲染、绝不闪 fallback，从而彻底消除
// 「Suspense fallback（chunk 加载中）→ 页面自身 loading」的双重 AppLoading
// （冷刷新 chunk 需重新 fetch/eval，与 SPA 二次进入 warm 均成立）。
preloadInitialRoute().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <Routes />
    </ErrorBoundary>
  );
});