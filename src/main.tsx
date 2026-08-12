// 应用入口文件，挂载 React 根组件并初始化路由
import { Suspense, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLoading from './components/common/AppLoading';
import './assets/styles/index.css';
import { adjustFontSizeForNative } from './lib/platform';
import { preventPinchZoom } from './lib/preventZoom';
import { preloadInitialRoute } from './components/Layout/routeConfig';
import { useSourceManagerStore } from './stores/useSourceManagerStore';
import { preloadLogoCache } from './services/channelLogo';

// Android 原生平台：缩小字体和图标以适配 dp 单位
adjustFontSizeForNative();
// 移动端阻止双指缩放
preventPinchZoom();

// 首屏加载兜底：路由 chunk 拉取期间显示全屏 AppLoading，替代「render 前空白」。
// 与 AppLayout 的 LoadingFallback 一致写入 __kinoSuspenseFallback 时间戳，
// 供首页判断「刚经历过 chunk fallback」从而跳过自身固定 500ms loading，
// 避免 fallback 与页面 loading 两次 AppLoading 叠加（8.3C 机制）。
function BootLoading() {
  useEffect(() => {
    window.__kinoSuspenseFallback = Date.now();
  }, []);
  return <AppLoading fullScreen showProgress={false} tip="正在启动…" />;
}

// 9.1（2026-08-12）：render 不再等待 preloadInitialRoute —— 原逻辑 await 完成后才
// createRoot().render()，冷启动（chunk 需网络 fetch）期间 #root 全空、无任何 UI 兜底，
// 造成「长时间白屏」。改为立即 render：
//  - preload 与 React.lazy 共用 lazyWithRetry 缓存的同一 Promise（routeConfig.ts），
//    warm（chunk 已缓存）时 Suspense 同步解析、绝不闪 fallback；
//  - cold 时 per-route Suspense（AppLayout LoadingFallback）立即显示 AppLoading，
//    加载完成自动进入内容 —— 白屏 → 短暂「加载中」。
// 9.1：preloadAllRoutes() 移除（原在 render 前并发抢拉 12 个路由 chunk，与首屏
// Home chunk 竞争带宽）。AppLayout 挂载后已立即调用（preloadStarted 幂等），
// 预拉发生在 Home chunk 就绪之后，不再拖慢首帧。
useSourceManagerStore.getState().bootstrap();
// 预载台标缓存（库清单 + 成败记忆，IndexedDB/网络拉取，不阻塞首屏）
void preloadLogoCache();
// 预拉「当前路由」chunk（不阻塞渲染）：warm 命中时 Suspense 同步解析
void preloadInitialRoute();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Suspense fallback={<BootLoading />}>
      <Routes />
    </Suspense>
  </ErrorBoundary>
);
