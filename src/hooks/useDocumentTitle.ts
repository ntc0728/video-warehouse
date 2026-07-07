/**
 * useDocumentTitle — 动态设置浏览器页签标题
 *
 * 用法：
 *   useDocumentTitle()           — 仅路由标题
 *   useDocumentTitle('海王')      — 路由 + 内容标题
 *   useDocumentTitle(null, true)  — 沉浸模式，只显示内容标题
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'kinoTV';

const routeTitles: Record<string, string> = {
  '/': '首页',
  '/browse': '搜索中心',
  '/iptv': 'IPTV',
  '/collections': '收藏',
  '/history': '历史记录',
  '/settings': '设置',
};

export function useDocumentTitle(contentTitle?: string | null, immersive = false) {
  const location = useLocation();

  useEffect(() => {
    let title: string;

    if (immersive && contentTitle) {
      title = `${contentTitle} - ${APP_NAME}`;
    } else if (contentTitle) {
      const routeTitle = getRouteTitle(location.pathname);
      title = routeTitle
        ? `${contentTitle} · ${routeTitle} - ${APP_NAME}`
        : `${contentTitle} - ${APP_NAME}`;
    } else {
      const routeTitle = getRouteTitle(location.pathname);
      title = routeTitle ? `${routeTitle} - ${APP_NAME}` : APP_NAME;
    }

    document.title = title;
  }, [location.pathname, contentTitle, immersive]);
}

function getRouteTitle(pathname: string): string | null {
  if (pathname === '/') return routeTitles['/'];
  const match = Object.entries(routeTitles).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );
  return match ? match[1] : null;
}
