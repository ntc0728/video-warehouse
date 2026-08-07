// 路由配置文件，定义应用所有页面路由和布局结构
// 页面组件的懒加载和 Suspense 由 AppLayout 的 Keep-Alive 容器统一管理
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import IPTVPlayerPage from './pages/IPTV/IPTVPlayer';
import { isNativePlatform } from '@/lib/platform';

const routes = [
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <div /> },
      { path: 'detail/:id', element: <div /> },
      { path: 'play/:id', element: <div /> },
      { path: 'settings', element: <div /> },
      { path: 'collections', element: <div /> },
      { path: 'history', element: <div /> },
      { path: 'iptv', element: <div /> },
      { path: 'player/:id', element: <div /> },
      { path: 'source-checker', element: <div /> },
      { path: 'browse', element: <div /> },
      { path: 'person/:id', element: <div /> },
      { path: 'proxy-setup', element: <div /> },
    ],
  },
  {
    // IPTV 播放页（顶层独立路由，不走 AppLayout）
    // 设计原因：IPTV 播放本质是"独立全屏应用"，需要占据整个浏览器视口。
    // 走 AppLayout 会被 StickyHeader / CustomScrollbar / TabBar 挤占视口，
    // 且嵌套 overflow + flex 100% 继承链不稳定。独立路由 + fixed 定位
    // 可根本性解决滚动条 / 高度坍缩问题。
    path: '/iptv/play',
    element: <IPTVPlayerPage />,
  },
];

const router = isNativePlatform()
  ? createHashRouter(routes)
  : createBrowserRouter(routes);

export default function Routes() {
  return <RouterProvider router={router} />;
}
