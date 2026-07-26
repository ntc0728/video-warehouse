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

// 首屏渲染前预拉「当前路由」chunk：warm 命中缓存时 Suspense 同步解析，
// 避免首屏出现「Suspense fallback → 页面自身 loading」的双重 AppLoading。
preloadInitialRoute();

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason instanceof DOMException && e.reason.name === 'AbortError' && e.reason.message.includes('Transition')) return;
  console.error('[unhandledrejection]', e.reason);
  e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Routes />
  </ErrorBoundary>
);