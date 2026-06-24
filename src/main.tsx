// 应用入口文件，挂载 React 根组件并初始化路由
import ReactDOM from 'react-dom/client';
import Routes from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import './assets/styles/index.css';
import { adjustFontSizeForNative } from './lib/platform';
import { preventPinchZoom } from './lib/preventZoom';

// Android 原生平台：缩小字体和图标以适配 dp 单位
adjustFontSizeForNative();
// 移动端阻止双指缩放
preventPinchZoom();

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