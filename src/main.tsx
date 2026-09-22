// 应用入口文件，挂载 React 根组件并初始化路由
import { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppLoading from './components/common/AppLoading';
import './assets/styles/index.css';
import { preventPinchZoom } from './lib/preventZoom';
import { preloadInitialRoute } from './components/Layout/routeConfig';
import { preloadLogoCache } from './services/channelLogo';

// 移动端阻止双指缩放
preventPinchZoom();

// 首屏加载兜底：路由 chunk 拉取期间渲染全屏 AppLoading。2026-09-22 起它只是
// 「占位」——启动骨架 #boot-splash（index.html 内联、与目标页同构）在其上方便
// 可见，dropBootSplash 会等这份 plain 退场才摘骨架，plain 不再盖住同构骨架。
function BootLoading() {
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
// [2026-08-13] 移除全局 bootstrap()：不再无条件拉取 3 个源 JSON。
// 改为场景级惰性触发——video（浏览/详情/播放按需）、iptv/epg（IPTV 页）、
// 全量（设置页源管理），各场景幂等，见 useSourceManagerStore.bootstrapScene。
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

// 摘除 index.html 的零依赖启动骨架。
// 两个条件（2026-09-22 整改）：
//  1. React 真正提交首帧（#root 有子节点）——否则会出现「splash 已消失、内容还没渲染」
//     的新白屏空档（原单 rAF 实现会抢在 React Scheduler 宏任务提交前触发）；
//  2. 首帧不是 plain AppLoading——chunk 冷加载时首帧提交的是 BootLoading
//     （`.app-loading--fullscreen`）或 AppLayout 的 LoadingFallback（`.page-loading .app-loading`），
//     若此时摘骨架，同构启动骨架会被 plain loading 盖脸（用户 2026-09-22 反馈），
//     故让骨架继续撑到真实页/页级骨架提交。
// 另加 10s 兜底强制摘除：模块顶层抛错 render 从未发生、或 chunk 迟迟不落地时，
// 不让 splash 永久盖屏。
function dropBootSplash(force = false) {
  const splash = document.getElementById('boot-splash');
  const root = document.getElementById('root');
  if (!splash) return true;
  if (force) {
    splash.remove();
    return true;
  }
  if (!root || root.childElementCount === 0) return false;
  if (root.querySelector('.app-loading--fullscreen, .page-loading .app-loading')) return false;
  splash.remove();
  return true;
}
requestAnimationFrame(function waitFirstCommit() {
  if (!dropBootSplash()) requestAnimationFrame(waitFirstCommit);
});
window.setTimeout(() => dropBootSplash(true), 10_000);
